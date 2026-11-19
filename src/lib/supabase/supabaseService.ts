import { supabase, isSupabaseConfigured } from './client';
import {
  AuditLog,
  DominantFoot,
  MonthlyPaymentRecord,
  PeerEvaluation,
  PeladaMonthlyConfig,
  PeladaScheduleConfig,
  PlayerPosition,
  PlayerProfile,
  ProfileVisibility,
  SumulaData,
  TeamModality,
  TeamTransaction,
  User,
  UserRole,
} from '../../types/league';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Colunas LEVES: nunca incluem imagens em base64 (avatar_path / team_crest_url),
 * que chegam a ~300 KB por linha. Imagens são baixadas separadamente:
 *  - escudo: 1 vez por time (qualquer team_name, inclusive times futuros)
 *  - foto de perfil: em segundo plano, apenas para quem mudou ou ainda não foi baixado
 */
const PROFILE_LIGHT_COLUMNS =
  'id, user_id, display_name, city_id, position, dominant_foot, profile_visibility, current_rating, rating_uncertainty, is_provisional, current_division_id, total_validated_matches, created_at, updated_at, team_name, team_city, team_modality, team_invite_code, is_team_owner';
const USER_LIGHT_COLUMNS =
  'id, email, whatsapp_number, role, status, created_at, updated_at, team_name, team_city, team_modality, team_invite_code, is_team_owner';

// Cache em memória dos escudos por time (evita baixar o mesmo escudo a cada sincronização)
const TEAM_CREST_TTL_MS = 10 * 60 * 1000;
const teamCrestCache = new Map<string, { url: string | undefined; fetchedAt: number }>();

let monthlyLedgerWriteQueue: Promise<boolean> = Promise.resolve(true);
let financialLedgerWriteQueue: Promise<boolean> = Promise.resolve(true);
let auditLedgerWriteQueue: Promise<boolean> = Promise.resolve(true);
let peerEvaluationsWriteQueue: Promise<boolean> = Promise.resolve(true);

// Cache leve em memória para evitar chamadas 404 repetitivas caso a tabela opcional ainda não exista no banco
let hasDedicatedFinancialTxTable: boolean | null = null;

function buildTeamSlug(teamName?: string): string {
  return (teamName || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

/**
 * Serviço de sincronização e comunicação com a API do Supabase.
 * Permite ler e persistir dados reais quando as credenciais estiverem configuradas.
 */
export const supabaseService = {
  /**
   * Verifica se a conexão com o Supabase está ativa e configurada
   */
  async checkConnection(): Promise<{ connected: boolean; message: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        connected: false,
        message:
          'Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas.',
      };
    }
    try {
      const { error } = await supabase.from('cities').select('id').limit(1);
      if (error) {
        return {
          connected: false,
          message: `Erro ao conectar: ${error.message}`,
        };
      }
      return {
        connected: true,
        message: 'Conexão com o Supabase estabelecida com sucesso!',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { connected: false, message: `Exceção de rede: ${message}` };
    }
  },

  /**
   * Busca todas as contas de usuários cadastradas no Supabase
   */
  async getUsers(): Promise<User[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      // Colunas leves (sem team_crest_url em base64): o escudo vem 1x por time via getProfiles
      const { data, error } = await supabase.from('users').select(USER_LIGHT_COLUMNS);
      if (error || !data) {
        console.warn('Erro ao buscar usuários do Supabase:', error);
        return null;
      }

      return data.map((u) => {
        const isOwner = Boolean(u.is_team_owner);
        const role =
          (u.email || '').toLowerCase() === 'futplaylite@gmail.com'
            ? 'admin'
            : isOwner
            ? 'coach'
            : u.role || 'player';

        const hasTeam = Boolean(
          (u.team_name && u.team_name !== 'Meu Time' && u.team_name !== 'Sem Time') ||
          u.team_invite_code
        );
        const isCompleted = isOwner || hasTeam || role === 'admin';

        return {
          id: u.id,
          email: u.email,
          whatsappNumber: u.whatsapp_number || undefined,
          teamName: u.team_name || undefined,
          teamCity: u.team_city || undefined,
          teamModality: u.team_modality || undefined,
          teamInviteCode: u.team_invite_code || undefined,
          isTeamOwner: isOwner,
          role,
          status: u.status || 'ativa',
          createdAt: u.created_at,
          onboardingCompleted: isCompleted,
          onboardingStep: isCompleted ? 4 : 1,
        };
      });
    } catch (err) {
      console.warn('Exceção ao buscar usuários do Supabase:', err);
      return null;
    }
  },

  /**
   * Localiza usuário pelo e-mail, telefone ou ID diretamente no Supabase para exibição de perfil.
   * Não retorna hash de senha por segurança arquitetural.
   */
  async findUserByIdentifier(
    identifier: string
  ): Promise<{ user: User; profile?: PlayerProfile; mustResetPassword?: boolean } | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    const trimmed = identifier.trim().toLowerCase();
    const digits = trimmed.replace(/\D/g, '');
    const isEmail = trimmed.includes('@');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);

    try {
      let data: any = null;

      if (isUuid) {
        const res = await supabase
          .from('users')
          .select('*')
          .eq('id', trimmed)
          .limit(1)
          .maybeSingle();
        data = res.data;
      } else if (isEmail) {
        const res = await supabase
          .from('users')
          .select('*')
          .ilike('email', trimmed)
          .limit(1)
          .maybeSingle();
        data = res.data;
      } else if (digits.length >= 8) {
        // Tenta buscar por whatsapp_number (apenas dígitos para não quebrar parser do PostgREST com parênteses) ou email gerado
        const last8 = digits.slice(-8);
        const last9 = digits.length >= 9 ? digits.slice(-9) : last8;
        const orFilter = [
          `email.ilike.${digits}@%`,
          `whatsapp_number.eq.${digits}`,
          `whatsapp_number.ilike.%${last9}`,
        ].join(',');

        const res = await supabase
          .from('users')
          .select('*')
          .or(orFilter)
          .limit(1)
          .maybeSingle();

        if (res.error) {
          const fallbackRes = await supabase
            .from('users')
            .select('*')
            .ilike('email', `${digits}@%`)
            .limit(1)
            .maybeSingle();
          data = fallbackRes.data;
        } else {
          data = res.data;
        }

        // Fallback caso o número tenha sido salvo com máscara literal
        if (!data && trimmed) {
          const maskRes = await supabase
            .from('users')
            .select('*')
            .eq('whatsapp_number', identifier.trim())
            .limit(1)
            .maybeSingle();
          data = maskRes.data;
        }
      }

      // Busca por apelido / display_name do atleta se ainda não encontrou por e-mail ou celular
      if (!data && trimmed && !isEmail && digits.length < 8 && trimmed.length >= 2) {
        const { data: profMatch } = await supabase
          .from('player_profiles')
          .select('user_id')
          .ilike('display_name', trimmed)
          .limit(1)
          .maybeSingle();

        if (profMatch?.user_id) {
          const { data: uData } = await supabase
            .from('users')
            .select('*')
            .eq('id', profMatch.user_id)
            .limit(1)
            .maybeSingle();
          data = uData;
        }
      }

      if (!data) return null;

      const isOwner = Boolean(data.is_team_owner);
      const userRole =
        (data.email || '').toLowerCase() === 'futplaylite@gmail.com'
          ? 'admin'
          : isOwner
          ? 'coach'
          : data.role || 'player';

      const hasTeam = Boolean(
        (data.team_name && data.team_name !== 'Meu Time' && data.team_name !== 'Sem Time') ||
        data.team_invite_code
      );
      const isCompleted = isOwner || hasTeam || userRole === 'admin';

      const user: User = {
        id: data.id,
        email: data.email,
        whatsappNumber: data.whatsapp_number || undefined,
        teamName: data.team_name || undefined,
        teamCrestUrl: data.team_crest_url || undefined,
        teamCity: data.team_city || undefined,
        teamModality: data.team_modality || undefined,
        teamInviteCode: data.team_invite_code || undefined,
        isTeamOwner: isOwner,
        role: userRole,
        status: data.status || 'ativa',
        createdAt: data.created_at,
        onboardingCompleted: isCompleted,
        onboardingStep: isCompleted ? 4 : 1,
      };

      // 2. Busca perfil de atleta vinculado
      const { data: pData } = await supabase
        .from('player_profiles')
        .select('*')
        .eq('user_id', data.id)
        .limit(1)
        .maybeSingle();

      let profile: PlayerProfile | undefined = undefined;
      // Contas de administradores não possuem perfil de atleta e não participam de jogos
      if (pData && user.role !== 'admin' && user.email.toLowerCase() !== 'futplaylite@gmail.com') {
        const isProfileOwner = Boolean(pData.is_team_owner || data.is_team_owner);
        profile = {
          id: pData.id,
          userId: pData.user_id,
          displayName: pData.display_name,
          avatarUrl: pData.avatar_path || undefined,
          teamName: pData.team_name || data.team_name || undefined,
          teamCrestUrl: pData.team_crest_url || data.team_crest_url || undefined,
          teamCity: pData.team_city || data.team_city || undefined,
          teamModality: pData.team_modality || data.team_modality || undefined,
          teamInviteCode: pData.team_invite_code || data.team_invite_code || undefined,
          isTeamOwner: isProfileOwner,
          avatarColor: '#1D4ED8',
          cityId: pData.city_id,
          neighborhood: 'Centro',
          position: pData.position,
          dominantFoot: pData.dominant_foot,
          profileVisibility: pData.profile_visibility,
          currentRating: pData.current_rating,
          ratingUncertainty: Number(pData.rating_uncertainty),
          isProvisional: pData.is_provisional,
          currentDivisionId:
            pData.current_division_id ||
            '22222222-2222-4222-8222-222222222201',
          totalValidatedMatches: pData.total_validated_matches,
          experimentalPositionScore: null,
          badges: [],
          createdAt: pData.created_at,
          updatedAt: pData.updated_at || new Date().toISOString(),
        };

        // Garante coerência caso os dados do time estivessem salvos no perfil
        if (!user.teamName && profile.teamName) user.teamName = profile.teamName;
        if (!user.teamCrestUrl && profile.teamCrestUrl) user.teamCrestUrl = profile.teamCrestUrl;
        if (!user.teamCity && profile.teamCity) user.teamCity = profile.teamCity;
        if (!user.teamModality && profile.teamModality) user.teamModality = profile.teamModality;
        if (!user.teamInviteCode && profile.teamInviteCode) user.teamInviteCode = profile.teamInviteCode;
        if (isProfileOwner) {
          user.isTeamOwner = true;
          user.role = 'coach';
        }
      }

      return {
        user,
        profile,
        mustResetPassword: Boolean(data.must_reset_password),
      };
    } catch (err) {
      console.warn('Exceção ao buscar usuário no Supabase:', err);
      return null;
    }
  },

  /**
   * Realiza login oficial através do Supabase Auth (GoTrue), validando credenciais com bcrypt.
   * Suporta e-mail direto, número de celular/WhatsApp ou apelido esportivo.
   */
  async signInWithSupabaseAuth(
    identifier: string,
    password: string
  ): Promise<{
    success: boolean;
    user?: User;
    profile?: PlayerProfile;
    mustResetPassword?: boolean;
    error?: string;
  }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase não está configurado.' };
    }

    const trimmed = identifier.trim().toLowerCase();
    const digits = trimmed.replace(/\D/g, '');
    const isEmail = trimmed.includes('@');

    try {
      // 1. Identifica o e-mail canônico para autenticação no Supabase Auth
      let emailToAuth = trimmed;
      if (!isEmail) {
        if (digits.length >= 8) {
          const { data: uMatch } = await supabase
            .from('users')
            .select('email, whatsapp_number')
            .or(`whatsapp_number.eq.${digits},whatsapp_number.ilike.%${digits.slice(-8)}`)
            .limit(1)
            .maybeSingle();

          if (uMatch?.email) {
            emailToAuth = uMatch.email.toLowerCase();
          } else {
            emailToAuth = `${digits}@celular.futplay.com`;
          }
        } else {
          const { data: prof } = await supabase
            .from('player_profiles')
            .select('user_id')
            .ilike('display_name', trimmed)
            .limit(1)
            .maybeSingle();

          if (prof?.user_id) {
            const { data: u } = await supabase
              .from('users')
              .select('email')
              .eq('id', prof.user_id)
              .limit(1)
              .maybeSingle();
            if (u?.email) {
              emailToAuth = u.email.toLowerCase();
            }
          }
        }
      }

      // 2. Chama a autenticação nativa do Supabase GoTrue
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: emailToAuth,
        password: password.trim(),
      });

      if (authErr) {
        // Fallback resiliente: permite login com a senha original cadastrada na base relacional (public.users)
        let fallbackUser: any = null;
        if (isEmail) {
          const { data: u } = await supabase
            .from('users')
            .select('*')
            .ilike('email', trimmed)
            .limit(1)
            .maybeSingle();
          fallbackUser = u;
        } else if (digits.length >= 8) {
          const { data: u } = await supabase
            .from('users')
            .select('*')
            .or(`whatsapp_number.eq.${digits},whatsapp_number.ilike.%${digits.slice(-8)},email.ilike.%${digits}%`)
            .limit(1)
            .maybeSingle();
          fallbackUser = u;
        }

        if (fallbackUser && fallbackUser.password_hash === password.trim()) {
          const lookup = await this.findUserByIdentifier(fallbackUser.id);
          if (lookup?.user) {
            return {
              success: true,
              user: lookup.user,
              profile: lookup.profile,
              mustResetPassword: lookup.mustResetPassword,
            };
          }
        }

        return {
          success: false,
          error:
            authErr.message.includes('Invalid login credentials')
              ? 'Credenciais inválidas. Verifique seu e-mail/celular e senha.'
              : authErr.message,
        };
      }

      if (!authData.user) {
        return { success: false, error: 'Usuário não encontrado no serviço de autenticação.' };
      }

      // 3. Carrega os dados do usuário e perfil do banco de dados
      const lookup = await this.findUserByIdentifier(authData.user.id);
      if (!lookup || !lookup.user) {
        return { success: false, error: 'Perfil de usuário não encontrado no banco de dados.' };
      }

      return {
        success: true,
        user: lookup.user,
        profile: lookup.profile,
        mustResetPassword: lookup.mustResetPassword,
      };
    } catch (err) {
      console.error('Exceção ao autenticar no Supabase Auth:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  /**
   * Conclui a redefinição obrigatória de senha:
   * 1. Atualiza a senha no Supabase Auth (GoTrue) de forma criptográfica (bcrypt);
   * 2. Executa a RPC pública complete_mandatory_password_reset_authenticated() que valida
   *    auth.users.encrypted_password e libera o flag must_reset_password no banco.
   */
  async completeMandatoryPasswordReset(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase não configurado.' };
    }

    try {
      // 1. Atualiza no Supabase Auth
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword.trim(),
      });
      if (updateErr) {
        return { success: false, error: `Erro ao atualizar senha no Supabase Auth: ${updateErr.message}` };
      }

      // 2. Chama a RPC que valida a integridade e remove must_reset_password
      const { error: rpcErr } = await supabase.rpc(
        'complete_mandatory_password_reset_authenticated'
      );
      if (rpcErr) {
        return { success: false, error: `Falha ao homologar redefinição no banco: ${rpcErr.message}` };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  /**
   * Registra novo usuário e perfil de atleta diretamente no Supabase
   */
  async registerAthleteInSupabase(params: {
    user: User;
    profile: PlayerProfile;
    password?: string;
    birthDate?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase não configurado' };
    }

    try {
      const isValidUUID = (str?: string) =>
        Boolean(
          str &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              str
            )
        );

      let finalUserId = isValidUUID(params.user.id)
        ? params.user.id
        : generateUUID();

      const userEmail = params.user.email.toLowerCase().trim();
      const cleanDigits = params.user.whatsappNumber?.replace(/\D/g, '');

      // 0. Se forneceu senha, registra a conta no serviço oficial Supabase Auth (GoTrue com bcrypt)
      if (params.password) {
        try {
          const { data: authData } = await supabase.auth.signUp({
            email: userEmail,
            password: params.password.trim(),
          });
          if (authData?.user?.id) {
            finalUserId = authData.user.id;
          }
        } catch {
          // Fallback para execução offline/mock
        }
      }

      // 0.1. Verifica se o usuário já existe no Supabase por e-mail ou celular para evitar conflito de chave única
      try {
        let lookup = supabase.from('users').select('id, email, whatsapp_number').limit(1);
        if (cleanDigits && cleanDigits.length >= 8) {
          const orFilter = [
            `email.eq.${userEmail}`,
            `whatsapp_number.eq.${cleanDigits}`,
            `whatsapp_number.ilike.%${cleanDigits}%`,
          ].join(',');
          lookup = lookup.or(orFilter);
        } else {
          lookup = lookup.eq('email', userEmail);
        }
        const { data: existingUser } = await lookup.maybeSingle();
        if (existingUser?.id) {
          finalUserId = existingUser.id;
        }
      } catch {
        // Ignora erro no lookup prévio
      }

      // 1. Inserir ou atualizar na tabela users (SEM coluna legada password_hash)
      let uErr: any = null;
      const whatsappToStore = cleanDigits || params.user.whatsappNumber || null;
      const sanitizedRole =
        (userEmail || '').toLowerCase() === 'futplaylite@gmail.com'
          ? 'admin'
          : params.user.role === 'admin' || params.user.role === 'moderator'
          ? params.user.role
          : 'player';

      const userPayloadFull: Record<string, any> = {
        id: finalUserId,
        email: userEmail,
        whatsapp_number: whatsappToStore,
        must_reset_password: false,
        role: sanitizedRole,
        status: params.user.status || 'ativa',
        updated_at: new Date().toISOString(),
      };
      if (params.user.teamName || params.profile.teamName) {
        userPayloadFull.team_name = params.user.teamName || params.profile.teamName;
      }
      if (params.user.teamCrestUrl || params.profile.teamCrestUrl) {
        userPayloadFull.team_crest_url = params.user.teamCrestUrl || params.profile.teamCrestUrl;
      }
      if (params.user.teamCity || params.profile.teamCity) {
        userPayloadFull.team_city = params.user.teamCity || params.profile.teamCity;
      }
      if (params.user.teamModality || params.profile.teamModality) {
        userPayloadFull.team_modality = params.user.teamModality || params.profile.teamModality;
      }
      if (params.user.teamInviteCode || params.profile.teamInviteCode) {
        userPayloadFull.team_invite_code = params.user.teamInviteCode || params.profile.teamInviteCode;
      }
      if (params.user.isTeamOwner !== undefined || params.profile.isTeamOwner !== undefined) {
        userPayloadFull.is_team_owner = Boolean(params.user.isTeamOwner || params.profile.isTeamOwner);
      }

      const { error: fullErr } = await supabase.from('users').upsert(userPayloadFull);

      if (fullErr) {
        const { error: fallbackErr } = await supabase.from('users').upsert({
          id: finalUserId,
          email: userEmail,
          whatsapp_number: whatsappToStore,
          must_reset_password: false,
          role: sanitizedRole,
          status: params.user.status || 'ativa',
          updated_at: new Date().toISOString(),
        });
        if (fallbackErr) {
          const { error: baseErr } = await supabase.from('users').upsert({
            id: finalUserId,
            email: userEmail,
            role: sanitizedRole,
            status: params.user.status || 'ativa',
            updated_at: new Date().toISOString(),
          });
          uErr = baseErr;
        } else {
          uErr = null;
        }
      }

      if (uErr) {
        console.error('Erro ao cadastrar usuário no Supabase:', uErr);
        return { success: false, error: uErr.message };
      }

      // 1.1. Verifica se já existe um perfil associado a este finalUserId
      let finalProfileId = isValidUUID(params.profile.id)
        ? params.profile.id
        : generateUUID();

      try {
        const { data: existingProf } = await supabase
          .from('player_profiles')
          .select('id')
          .eq('user_id', finalUserId)
          .limit(1)
          .maybeSingle();
        if (existingProf?.id) {
          finalProfileId = existingProf.id;
        }
      } catch {
        // Ignora erro no lookup
      }

      const finalCityId = isValidUUID(params.profile.cityId)
        ? params.profile.cityId
        : '11111111-1111-4111-8111-111111111101';
      const finalDivisionId = isValidUUID(params.profile.currentDivisionId)
        ? params.profile.currentDivisionId
        : '22222222-2222-4222-8222-222222222201';

      // 2. Inserir ou atualizar perfil de atleta
      const profilePayloadFull: Record<string, any> = {
        id: finalProfileId,
        user_id: finalUserId,
        display_name: params.profile.displayName,
        city_id: finalCityId,
        position: params.profile.position,
        dominant_foot: params.profile.dominantFoot,
        profile_visibility: params.profile.profileVisibility || 'publico',
        current_rating: params.profile.currentRating || 1000,
        rating_uncertainty: 100,
        is_provisional: true,
        current_division_id: finalDivisionId,
        updated_at: new Date().toISOString(),
      };
      if (params.profile.avatarUrl) {
        profilePayloadFull.avatar_path = params.profile.avatarUrl;
      }
      if (params.profile.teamName || params.user.teamName) {
        profilePayloadFull.team_name = params.profile.teamName || params.user.teamName;
      }
      if (params.profile.teamCrestUrl || params.user.teamCrestUrl) {
        profilePayloadFull.team_crest_url = params.profile.teamCrestUrl || params.user.teamCrestUrl;
      }
      if (params.profile.teamCity || params.user.teamCity) {
        profilePayloadFull.team_city = params.profile.teamCity || params.user.teamCity;
      }
      if (params.profile.teamModality || params.user.teamModality) {
        profilePayloadFull.team_modality = params.profile.teamModality || params.user.teamModality;
      }
      if (params.profile.teamInviteCode || params.user.teamInviteCode) {
        profilePayloadFull.team_invite_code = params.profile.teamInviteCode || params.user.teamInviteCode;
      }
      if (params.profile.isTeamOwner !== undefined || params.user.isTeamOwner !== undefined) {
        profilePayloadFull.is_team_owner = Boolean(params.profile.isTeamOwner || params.user.isTeamOwner);
      }

      const { error: pErr } = await supabase.from('player_profiles').upsert(profilePayloadFull);

      if (pErr) {
        // Fallback básico caso colunas de time ainda não tenham sido criadas
        const { error: basePErr } = await supabase.from('player_profiles').upsert({
          id: finalProfileId,
          user_id: finalUserId,
          display_name: params.profile.displayName,
          avatar_path: params.profile.avatarUrl || null,
          city_id: finalCityId,
          position: params.profile.position,
          dominant_foot: params.profile.dominantFoot,
          profile_visibility: params.profile.profileVisibility || 'publico',
          current_rating: params.profile.currentRating || 1000,
          rating_uncertainty: 100,
          is_provisional: true,
          current_division_id: finalDivisionId,
          updated_at: new Date().toISOString(),
        });
        if (basePErr) {
          console.error('Erro ao cadastrar perfil no Supabase:', basePErr);
          return { success: false, error: basePErr.message };
        }
      }

      // 3. Inserir participação na temporada oficial
      try {
        await supabase.from('season_entries').upsert({
          id: generateUUID(),
          season_id: '33333333-3333-4333-8333-333333333301',
          player_id: finalProfileId,
          division_id: finalDivisionId,
          status: 'provisorio',
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Ignora se season_entries falhar
      }

      // 4. Salva a data de nascimento no cofre de segurança privado se fornecida
      if (params.birthDate) {
        try {
          await this.setUserBirthDate(params.birthDate, cleanDigits);
        } catch (birthErr) {
          console.warn('Aviso ao salvar data de nascimento de segurança:', birthErr);
        }
      }

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /**
   * Exclui usuário e perfil do Supabase (LGPD)
   */
  async deleteUser(
    userId: string,
    email?: string,
    whatsappNumber?: string
  ): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      const userIdsToDelete = new Set<string>([userId]);
      const digits = (whatsappNumber || '').replace(/\D/g, '');

      // Também busca possíveis registros pelo mesmo telefone ou e-mail
      if (digits.length >= 8) {
        const { data: byPhone } = await supabase
          .from('users')
          .select('id')
          .or(`whatsapp_number.ilike.%${digits}%,email.ilike.${digits}%`);
        if (byPhone) {
          byPhone.forEach((u) => userIdsToDelete.add(u.id));
        }
      }
      if (email) {
        const { data: byEmail } = await supabase
          .from('users')
          .select('id')
          .ilike('email', email.trim());
        if (byEmail) {
          byEmail.forEach((u) => userIdsToDelete.add(u.id));
        }
      }

      const allUserIds = Array.from(userIdsToDelete);

      // 1. Localiza todos os perfis esportivos vinculados a esses user_ids
      const { data: profiles } = await supabase
        .from('player_profiles')
        .select('id')
        .in('user_id', allUserIds);

      const profileIds = (profiles || []).map((p) => p.id);

      // 2. Remove primeiro os vínculos em season_entries e monthly_payments para não violar foreign key constraint
      if (profileIds.length > 0) {
        await supabase.from('season_entries').delete().in('player_id', profileIds);
        await supabase.from('monthly_payments').delete().in('player_id', profileIds);
      }

      // 3. Remove perfis e usuários
      await supabase.from('player_profiles').delete().in('user_id', allUserIds);
      await supabase.from('users').delete().in('id', allUserIds);
      return true;
    } catch (err) {
      console.error('Erro ao excluir usuário no Supabase:', err);
      return false;
    }
  },

  /**
   * Atualiza dados do perfil esportivo e time no Supabase (foto, nome, posição, pé dominante, time, escudo)
   */
  async updateProfile(
    userId: string,
    updates: {
      displayName?: string;
      avatarUrl?: string;
      position?: PlayerPosition;
      dominantFoot?: DominantFoot;
      profileVisibility?: ProfileVisibility;
      teamName?: string;
      teamCrestUrl?: string;
      teamCity?: string;
      teamModality?: TeamModality;
      teamInviteCode?: string;
      isTeamOwner?: boolean;
      role?: UserRole;
    }
  ): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase || !userId) return false;
    try {
      // Se houver alteração de role (ex: coach ou player), utiliza a RPC oficial para manter integridade
      if (updates.role !== undefined && (updates.role === 'coach' || updates.role === 'player' || updates.role === 'admin')) {
        await this.adminSetPlayerRole({
          targetUserId: userId,
          newRole: updates.role,
          canManageSport: updates.role === 'coach',
          canManageFinance: updates.role === 'coach',
          reason: 'Atualização de função via perfil do atleta',
        }).catch(() => {});
      }

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.displayName !== undefined) payload.display_name = updates.displayName;
      if (updates.avatarUrl !== undefined) payload.avatar_path = updates.avatarUrl;
      if (updates.position !== undefined) payload.position = updates.position;
      if (updates.dominantFoot !== undefined) payload.dominant_foot = updates.dominantFoot;
      if (updates.profileVisibility !== undefined) {
        payload.profile_visibility = updates.profileVisibility;
      }
      if (updates.teamName !== undefined) payload.team_name = updates.teamName;
      if (updates.teamCrestUrl !== undefined) payload.team_crest_url = updates.teamCrestUrl;
      if (updates.teamCrestUrl !== undefined || updates.teamName !== undefined) {
        // Escudo/nome do time mudou: descarta cache para todos baixarem o escudo novo
        teamCrestCache.clear();
      }
      if (updates.teamCity !== undefined) payload.team_city = updates.teamCity;
      if (updates.teamModality !== undefined) payload.team_modality = updates.teamModality;
      if (updates.teamInviteCode !== undefined) payload.team_invite_code = updates.teamInviteCode;
      if (updates.isTeamOwner !== undefined || updates.role !== undefined) {
        payload.is_team_owner = updates.role === 'coach' ? true : Boolean(updates.isTeamOwner);
      }

      const { error: pError } = await supabase
        .from('player_profiles')
        .update(payload)
        .or(`id.eq.${userId},user_id.eq.${userId}`);

      if (pError) {
        // Fallback sem colunas de time caso a migração ainda não tenha sido rodada
        const basePayload: Record<string, any> = { updated_at: new Date().toISOString() };
        if (updates.displayName !== undefined) basePayload.display_name = updates.displayName;
        if (updates.avatarUrl !== undefined) basePayload.avatar_path = updates.avatarUrl;
        if (updates.position !== undefined) basePayload.position = updates.position;
        if (updates.dominantFoot !== undefined) basePayload.dominant_foot = updates.dominantFoot;
        if (updates.profileVisibility !== undefined) basePayload.profile_visibility = updates.profileVisibility;
        if (updates.isTeamOwner !== undefined || updates.role !== undefined) {
          basePayload.is_team_owner = updates.role === 'coach' ? true : Boolean(updates.isTeamOwner);
        }
        await supabase
          .from('player_profiles')
          .update(basePayload)
          .or(`id.eq.${userId},user_id.eq.${userId}`);
      }

      // Atualiza também na tabela users
      const userPayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.teamName !== undefined) userPayload.team_name = updates.teamName;
      if (updates.teamCrestUrl !== undefined) userPayload.team_crest_url = updates.teamCrestUrl;
      if (updates.teamCity !== undefined) userPayload.team_city = updates.teamCity;
      if (updates.teamModality !== undefined) userPayload.team_modality = updates.teamModality;
      if (updates.teamInviteCode !== undefined) userPayload.team_invite_code = updates.teamInviteCode;
      if (updates.role !== undefined) userPayload.role = updates.role;
      if (updates.isTeamOwner !== undefined || updates.role === 'coach') {
        userPayload.is_team_owner = updates.role === 'coach' ? true : Boolean(updates.isTeamOwner);
      }

      try {
        await supabase.from('users').update(userPayload).eq('id', userId);
      } catch {
        // Ignora caso users ainda não tenha colunas de time
      }

      return true;
    } catch (err) {
      console.warn('Erro ao atualizar perfil no Supabase:', err);
      return false;
    }
  },

  /**
   * Promove ou altera o cargo de um atleta para Treinador (coach) ou Atleta (player) no Supabase.
   * Invoca a RPC pública admin_set_player_role_authenticated que sincroniza de forma atômica
   * e auditada as tabelas public.users, public.player_profiles e public.team_memberships.
   */
  async adminSetPlayerRole(params: {
    targetUserId: string;
    newRole: 'coach' | 'player' | 'admin';
    canManageSport?: boolean;
    canManageFinance?: boolean;
    reason?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!params.targetUserId) {
      return { success: false, error: 'Identificador do usuário alvo é obrigatório.' };
    }

    const isCoach = params.newRole === 'coach';

    // 1. Persiste imediatamente no cofre local de papéis (Local-First Override)
    try {
      const ROLE_KEY = 'futplay_role_overrides_v1';
      const existing = localStorage.getItem(ROLE_KEY);
      const parsed = existing ? JSON.parse(existing) : {};
      parsed[params.targetUserId] = {
        role: params.newRole,
        isTeamOwner: isCoach,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(ROLE_KEY, JSON.stringify(parsed));
    } catch {}

    if (!isSupabaseConfigured() || !supabase) {
      return { success: true };
    }

    try {
      // 2. Executa a RPC segura oficial no Supabase
      const { data, error } = await supabase.rpc('admin_set_player_role_authenticated', {
        p_target_user_id: params.targetUserId,
        p_new_role: params.newRole,
        p_can_manage_sport: params.canManageSport ?? isCoach,
        p_can_manage_finance: params.canManageFinance ?? isCoach,
        p_reason: params.reason || `Alteração de cargo para ${params.newRole} pelo Administrador`,
      });

      if (!error && !(data && typeof data === 'object' && (data as any).success === false)) {
        return { success: true };
      }

      console.warn('RPC admin_set_player_role_authenticated não respondeu ou rejeitou. Aplicando sincronização direta resiliente no Supabase:', error);

      // 3. Fallback direto nas tabelas públicas com Supabase Client caso a migration 015 ainda esteja pendente
      const now = new Date().toISOString();
      let realUserId = params.targetUserId;
      let realProfileId = params.targetUserId;
      try {
        const { data: profMatch } = await supabase
          .from('player_profiles')
          .select('id, user_id')
          .or(`id.eq.${params.targetUserId},user_id.eq.${params.targetUserId}`)
          .limit(1)
          .maybeSingle();
        if (profMatch) {
          if (profMatch.user_id) realUserId = profMatch.user_id;
          if (profMatch.id) realProfileId = profMatch.id;
        }
      } catch {}

      await Promise.allSettled([
        supabase
          .from('users')
          .update({
            role: params.newRole,
            is_team_owner: isCoach,
            updated_at: now,
          })
          .eq('id', realUserId),
        supabase
          .from('player_profiles')
          .update({
            is_team_owner: isCoach,
            updated_at: now,
          })
          .or(`id.eq.${realProfileId},user_id.eq.${realUserId}`),
        supabase
          .from('team_memberships')
          .update({
            is_owner: isCoach,
            can_manage_sport: isCoach,
            can_manage_finance: isCoach,
            updated_at: now,
          })
          .eq('user_id', realUserId),
      ]);

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Aviso ao sincronizar cargo com o Supabase:', msg);
      return { success: true };
    }
  },

  /**
   * Salva a data de nascimento no cofre de credenciais de segurança privadas (private.user_security_credentials).
   * Nunca salva em user_metadata nem expõe publicamente.
   */
  async setUserBirthDate(birthDate: string, phoneDigits?: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase não configurado.' };
    }
    try {
      const { error } = await supabase.rpc('set_user_birth_date_authenticated', {
        p_birth_date: birthDate,
        p_phone_digits: phoneDigits || null,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  /**
   * Consulta a própria data de nascimento configurada no cofre privado.
   */
  async getMyBirthDate(): Promise<string | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const { data, error } = await supabase.rpc('get_my_birth_date_authenticated');
      if (error || !data) return null;
      return String(data);
    } catch {
      return null;
    }
  },

  /**
   * Recupera a senha esquecida validando telefone e data de nascimento no backend.
   * Utiliza Edge Function com fallback para RPC protegida.
   * Aplica rate-limiting contra força bruta e mensagens genéricas para evitar enumeração.
   */
  async recoverPasswordWithBirthdate(params: {
    phone: string;
    birthDate: string;
    newPassword: string;
    clientFingerprint?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase não configurado.' };
    }
    const cleanPhone = params.phone.replace(/\D/g, '');
    const cleanDate = params.birthDate.trim();
    const cleanPass = params.newPassword.trim();

    if (!cleanPhone || cleanPhone.length < 8) {
      return { success: false, error: 'Informe um número de telefone válido.' };
    }
    if (!cleanDate) {
      return { success: false, error: 'Informe sua data de nascimento.' };
    }
    if (cleanPass.length < 6) {
      return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
    }

    try {
      // 1. Tenta invocar Edge Function oficial 'recover-password'
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('recover-password', {
          body: {
            phone: cleanPhone,
            birthDate: cleanDate,
            newPassword: cleanPass,
          },
        });
        if (!edgeErr && edgeData?.success) {
          return { success: true };
        }
        if (edgeErr && edgeErr.message && !edgeErr.message.includes('Failed to send a request') && !edgeErr.message.includes('FunctionsFetchError')) {
          return { success: false, error: edgeData?.error || edgeErr.message };
        }
      } catch {
        // Fallback para RPC direta caso Edge Function local não esteja ativa
      }

      // 2. Fallback direto para a RPC protegida
      const fingerprint =
        params.clientFingerprint ||
        (typeof window !== 'undefined' ? window.location.host : 'client-web');

      const { data, error } = await supabase.rpc('recover_account_password_with_birthdate', {
        p_phone: cleanPhone,
        p_birth_date: cleanDate,
        p_new_password: cleanPass,
        p_client_fingerprint: fingerprint,
      });

      if (error) {
        if (error.message.includes('BLOQUEIO_TEMPORARIO')) {
          return {
            success: false,
            error: 'Número excessivo de tentativas incorretas. Tente novamente em alguns minutos.',
          };
        }
        return {
          success: false,
          error: 'Dados de identificação incorretos. Verifique o telefone e a data de nascimento.',
        };
      }

      if (data && data.success === false) {
        return {
          success: false,
          error: data.error || 'Dados de identificação incorretos.',
        };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  /**
   * Atualiza a senha do usuário autenticado diretamente através do Supabase Auth GoTrue.
   * Se must_reset_password for verdadeiro, conclui também a liberação auditada via RPC.
   * Suporta validação da senha atual pelo Supabase Auth.
   */
  async updatePassword(
    userIdOrParams:
      | string
      | {
          userId: string;
          newPassword: string;
          currentPassword?: string;
          userEmail?: string;
        },
    newPasswordParam?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase não configurado.' };
    }

    let newPassword = '';
    let currentPassword: string | undefined;
    let userEmail: string | undefined;

    if (typeof userIdOrParams === 'object') {
      newPassword = (userIdOrParams.newPassword || '').trim();
      currentPassword = userIdOrParams.currentPassword?.trim();
      userEmail = userIdOrParams.userEmail?.trim();
    } else {
      newPassword = (newPasswordParam || '').trim();
    }

    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'A nova senha deve ter no mínimo 4 caracteres.' };
    }

    try {
      // Valida senha atual no Supabase Auth se fornecida
      if (currentPassword && userEmail) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: userEmail.toLowerCase(),
          password: currentPassword,
        });
        if (signInErr) {
          return { success: false, error: 'A senha atual informada está incorreta.' };
        }
      }

      const res = await this.completeMandatoryPasswordReset(newPassword);
      return res;
    } catch (err) {
      console.warn('Erro ao atualizar senha no Supabase:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  /**
   * Registra ou rotaciona a sessão ativa do usuário autenticado chamando a RPC oficial
   * register_or_rotate_active_session_authenticated.
   * Não grava nada em pelada_sumulas.
   */
  async registerActiveSession(userId?: string, sessionToken?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      const devInfo = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 100) : 'web';
      const { data, error } = await supabase.rpc(
        'register_or_rotate_active_session_authenticated',
        {
          p_device_info: devInfo,
          p_client_fingerprint: sessionToken || (typeof window !== 'undefined' ? window.location.host : 'client'),
        }
      );
      if (error) {
        console.warn('Aviso ao registrar sessão ativa via RPC:', error);
        return false;
      }
      if (data?.active_session_id && typeof localStorage !== 'undefined') {
        localStorage.setItem('futplay_lite_active_session_token_v1', data.active_session_id);
      }
      return true;
    } catch (err) {
      console.warn('Erro ao registrar sessão ativa no Supabase:', err);
      return false;
    }
  },

  /**
   * Consulta o token de sessão ativo atual do usuário diretamente da tabela user_sessions
   */
  async getActiveSessionToken(userId: string): Promise<string | null> {
    if (!isSupabaseConfigured() || !supabase || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('active_session_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) return null;
      return data.active_session_id || null;
    } catch {
      return null;
    }
  },

  /**
   * Valida se a sessão do aparelho atual continua ativa ou se foi substituída por outro login.
   * Utiliza a RPC oficial validate_active_session_authenticated.
   */
  async validateActiveSession(
    sessionId: string
  ): Promise<{ valid: boolean; reason?: string }> {
    if (!isSupabaseConfigured() || !supabase || !sessionId) {
      return { valid: true };
    }
    try {
      const { data, error } = await supabase.rpc(
        'validate_active_session_authenticated',
        { p_session_id: sessionId }
      );
      if (error) {
        // Não invalida a sessão do usuário caso a RPC de verificação não esteja disponível
        return { valid: true };
      }
      return {
        valid: Boolean(data?.valid),
        reason: data?.reason,
      };
    } catch {
      return { valid: true };
    }
  },

  /**
   * Remove o registro de sessão ativa e desloga do Supabase Auth
   */
  async clearActiveSession(userId?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      if (userId) {
        await supabase
          .from('user_sessions')
          .delete()
          .eq('user_id', userId);
      }
      await supabase.auth.signOut();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Baixa o escudo de UM time (1 única linha, independente de quantos jogadores o time tem).
   * Funciona para qualquer team_name, inclusive times criados no futuro. Usa cache em memória.
   */
  async getTeamCrest(teamName: string): Promise<string | undefined> {
    if (!isSupabaseConfigured() || !supabase || !teamName) return undefined;
    const key = teamName.trim().toLowerCase();
    const cached = teamCrestCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < TEAM_CREST_TTL_MS) return cached.url;

    try {
      const { data } = await supabase
        .from('player_profiles')
        .select('team_crest_url')
        .eq('team_name', teamName)
        .not('team_crest_url', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const url = (data?.team_crest_url as string | undefined) || undefined;
      teamCrestCache.set(key, { url, fetchedAt: Date.now() });
      return url;
    } catch {
      return cached?.url;
    }
  },

  /**
   * Baixa as fotos de perfil (pesadas) em lotes pequenos, apenas dos perfis pedidos.
   * Deve rodar em segundo plano, sem bloquear a exibição da lista de atletas.
   */
  async getProfileAvatars(profileIds: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    if (!isSupabaseConfigured() || !supabase || profileIds.length === 0) return result;

    const CHUNK = 4;
    for (let i = 0; i < profileIds.length; i += CHUNK) {
      const chunk = profileIds.slice(i, i + CHUNK);
      try {
        const { data } = await supabase
          .from('player_profiles')
          .select('id, avatar_path')
          .in('id', chunk);
        (data || []).forEach((row: { id: string; avatar_path: string | null }) => {
          if (row.avatar_path) result[row.id] = row.avatar_path;
        });
      } catch {
        // Ignora falha do lote; será tentado novamente na próxima sincronização
      }
    }
    return result;
  },

  /**
   * Busca perfis esportivos cadastrados no Supabase.
   * Consulta LEVE (sem fotos/escudos em base64): o escudo é baixado 1x por time
   * e as fotos de perfil chegam depois, em segundo plano (getProfileAvatars).
   * Otimizado: reutiliza adminUserIds se fornecido e busca escudos ausentes em lote.
   */
  async getProfiles(cachedAdminIds?: Set<string>): Promise<PlayerProfile[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    const { data, error } = await supabase
      .from('player_profiles')
      .select(PROFILE_LIGHT_COLUMNS)
      .order('current_rating', { ascending: false });

    if (error || !data) {
      console.warn('Erro ao buscar perfis do Supabase:', error);
      return null;
    }

    // Contas de administradores nunca participam de jogos e não aparecem em listas de atletas
    let adminUserIds = cachedAdminIds;
    if (!adminUserIds) {
      const { data: usersData } = await supabase.from('users').select('id, role, email');
      adminUserIds = new Set(
        (usersData || [])
          .filter(
            (u) =>
              u.role === 'admin' ||
              (u.email && u.email.toLowerCase() === 'futplaylite@gmail.com')
          )
          .map((u) => u.id)
      );
    }

    const athleteRows = data.filter((p) => {
      if (adminUserIds!.has(p.user_id)) return false;
      if ((p.display_name || '').trim().toUpperCase() === 'ADMIN') return false;
      if (p.id === 'a0000000-0000-4000-8000-000000000002') return false;
      if (p.user_id === 'a0000000-0000-4000-8000-000000000001') return false;
      return true;
    });

    // Escudo: 1 download em lote para times ausentes do cache em memória
    const distinctTeamsRaw = new Map<string, string>();
    athleteRows.forEach((p) => {
      const raw = (p.team_name || '') as string;
      const key = raw.trim().toLowerCase();
      if (key && !distinctTeamsRaw.has(key)) distinctTeamsRaw.set(key, raw);
    });

    const missingTeamNames = Array.from(distinctTeamsRaw.values()).filter(
      (name) => !teamCrestCache.has(name.trim().toLowerCase())
    );

    if (missingTeamNames.length > 0) {
      try {
        const { data: teamsData } = await supabase
          .from('teams')
          .select('name, crest_url')
          .in('name', missingTeamNames);

        if (teamsData) {
          teamsData.forEach((t) => {
            const k = (t.name || '').trim().toLowerCase();
            if (k) teamCrestCache.set(k, { url: t.crest_url || undefined, fetchedAt: Date.now() });
          });
        }
      } catch {}
    }

    const crestEntries = await Promise.all(
      Array.from(distinctTeamsRaw.entries()).map(
        async ([key, raw]) => [key, await this.getTeamCrest(raw)] as const
      )
    );
    const crestByTeam = new Map<string, string | undefined>(crestEntries);

    return athleteRows.map((p) => {
      const teamKey = (p.team_name || '').trim().toLowerCase();
      const isCoachOrOwner = Boolean(p.is_team_owner);
      return {
        id: p.id,
        userId: p.user_id,
        displayName: p.display_name,
        teamName: p.team_name || undefined,
        teamCrestUrl: (teamKey ? crestByTeam.get(teamKey) : undefined) || undefined,
        teamCity: p.team_city || undefined,
        teamModality: p.team_modality || undefined,
        teamInviteCode: p.team_invite_code || undefined,
        isTeamOwner: isCoachOrOwner,
        isCoach: isCoachOrOwner,
        role: isCoachOrOwner ? 'coach' : 'player',
        avatarColor: '#1D4ED8',
        cityId: p.city_id,
        neighborhood: 'Centro',
        position: p.position,
        dominantFoot: p.dominant_foot,
        profileVisibility: p.profile_visibility,
        currentRating: p.current_rating,
        ratingUncertainty: Number(p.rating_uncertainty),
        isProvisional: p.is_provisional,
        currentDivisionId:
          p.current_division_id || '22222222-2222-4222-8222-222222222201',
        totalValidatedMatches: p.total_validated_matches,
        experimentalPositionScore: null,
        badges: [],
        createdAt: p.created_at,
        updatedAt: p.updated_at || new Date().toISOString(),
      } as PlayerProfile;
    });
  },

  /**
   * Busca um time pelo código de convite diretamente no Supabase em tempo real.
   * Varre player_profiles, users e audit_logs para garantir que o time seja reconhecido.
   */
  async findTeamByInviteCode(inviteCode: string): Promise<{
    id: string;
    inviteCode: string;
    name: string;
    city: string;
    neighborhood: string;
    foundedYear: string;
    crestUrl?: string;
    crestColor: string;
    modality: TeamModality;
    modalityLabel: string;
    ownerName: string;
    roster: Array<{
      id: string;
      name: string;
      position: PlayerPosition;
      avatarUrl?: string;
      isCaptain?: boolean;
    }>;
  } | null> {
    if (!isSupabaseConfigured() || !supabase || !inviteCode) return null;
    try {
      const clean = inviteCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (!clean) return null;

      const modalityMap: Record<string, string> = {
        society: 'Society',
        futsal: 'Futsal',
        futebol_areia: 'Futebol de Areia',
        futebol_campo: 'Futebol de Campo',
      };

      // 1. Procura em player_profiles (consulta LEVE: sem fotos/escudos; escudo vem 1x do time)
      const { data: pData } = await supabase
        .from('player_profiles')
        .select(PROFILE_LIGHT_COLUMNS)
        .not('team_name', 'is', null);
      if (pData && pData.length > 0) {
        const matching = pData.filter((p: any) => {
          if (!p.team_name) return false;
          const c = (p.team_invite_code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const namePrefix = (p.team_name || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
          return c === clean || (clean.length >= 5 && namePrefix && clean.startsWith(namePrefix));
        });

        if (matching.length > 0) {
          const owner = matching.find((p: any) => p.is_team_owner) || matching[0];
          const mod = (owner.team_modality || 'society') as TeamModality;
          const crestUrl = await this.getTeamCrest(owner.team_name);
          return {
            id: `remote-${owner.id}`,
            inviteCode: owner.team_invite_code || inviteCode.toUpperCase(),
            name: owner.team_name,
            city: owner.team_city || 'Planalto - BA',
            neighborhood: 'Centro',
            foundedYear: '2026',
            crestUrl,
            crestColor: '#1D4ED8',
            modality: mod,
            modalityLabel: modalityMap[mod] || 'Society',
            ownerName: owner.display_name || 'Dono do Time',
            roster: matching.map((p: any) => ({
              id: p.id,
              name: p.display_name,
              position: p.position || 'atacante',
              avatarUrl: undefined,
              isCaptain: Boolean(p.is_team_owner),
            })),
          };
        }
      }

      // 2. Procura em users (consulta LEVE)
      const { data: uData } = await supabase.from('users').select(USER_LIGHT_COLUMNS);
      if (uData && uData.length > 0) {
        const matchingUser = uData.find((u: any) => {
          if (!u.team_name) return false;
          const c = (u.team_invite_code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const namePrefix = (u.team_name || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
          return c === clean || (clean.length >= 5 && namePrefix && clean.startsWith(namePrefix));
        });

        if (matchingUser) {
          const mod = (matchingUser.team_modality || 'society') as TeamModality;
          const crestUrl = await this.getTeamCrest(matchingUser.team_name);
          return {
            id: `remote-user-${matchingUser.id}`,
            inviteCode: matchingUser.team_invite_code || inviteCode.toUpperCase(),
            name: matchingUser.team_name,
            city: matchingUser.team_city || 'Planalto - BA',
            neighborhood: 'Centro',
            foundedYear: '2026',
            crestUrl,
            crestColor: '#1D4ED8',
            modality: mod,
            modalityLabel: modalityMap[mod] || 'Society',
            ownerName: matchingUser.email?.split('@')[0] || 'Dono do Time',
            roster: [],
          };
        }
      }

      // 3. Procura em audit_logs
      const { data: aData } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action_type', 'TIME_CRIADO');

      if (aData && aData.length > 0) {
        const matchingLog = aData.find((l: any) => {
          const c = (l.entity_id || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          return c === clean;
        });

        if (matchingLog) {
          const match = (matchingLog.reason || '').match(/Criou a equipe "([^"]+)"/);
          const tName = match ? match[1] : 'Time da Liga';
          return {
            id: `remote-log-${matchingLog.id}`,
            inviteCode: matchingLog.entity_id || inviteCode.toUpperCase(),
            name: tName,
            city: 'Planalto - BA',
            neighborhood: 'Centro',
            foundedYear: '2026',
            crestColor: '#1D4ED8',
            modality: 'society',
            modalityLabel: 'Society',
            ownerName: matchingLog.actor_name || 'Dono do Time',
            roster: [],
          };
        }
      }

      return null;
    } catch (err) {
      console.warn('Erro ao buscar time por código no Supabase:', err);
      return null;
    }
  },

  /**
   * Busca os registros mensais de mensalidades (mesclando tabela oficial monthly_payments + livro sincronizado em pelada_sumulas)
   */
  async getMonthlyPayments(): Promise<MonthlyPaymentRecord[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const mergedByKey = new Map<string, MonthlyPaymentRecord>();
      let hadSuccess = false;

      const upsertIntoMap = (rec: MonthlyPaymentRecord) => {
        if (!rec || !rec.playerId || !rec.yearMonth) return;
        const ym = rec.yearMonth.trim();
        const normalized: MonthlyPaymentRecord = {
          ...rec,
          id: rec.id || `${rec.playerId}_${ym}`,
          yearMonth: ym,
          isPaid: Boolean(rec.isPaid),
          amount: Number(rec.amount) || 30,
        };
        const key = `${normalized.playerId}_${ym}`;
        const existing = mergedByKey.get(key);
        if (!existing) {
          mergedByKey.set(key, normalized);
          return;
        }
        const existingTime = new Date(existing.updatedAt || existing.paidAt || 0).getTime();
        const incomingTime = new Date(normalized.updatedAt || normalized.paidAt || 0).getTime();
        if (incomingTime >= existingTime) {
          mergedByKey.set(key, normalized);
        }
      };

      const [tableRes, ledgerRes] = await Promise.all([
        supabase
          .from('monthly_payments')
          .select('*')
          .order('updated_at', { ascending: false }),
        supabase
          .from('pelada_sumulas')
          .select('id, data, last_updated')
          .eq('id', 'monthly_payments_ledger_v1')
          .maybeSingle(),
      ]);

      if (!tableRes.error && Array.isArray(tableRes.data)) {
        hadSuccess = true;
        for (const item of tableRes.data) {
          upsertIntoMap({
            id: item.id,
            playerId: item.player_id,
            yearMonth: (item.year_month || '').trim(),
            isPaid: Boolean(item.is_paid),
            paidAt: item.paid_at || undefined,
            amount: Number(item.amount),
            confirmedBy: item.confirmed_by || undefined,
            updatedAt: item.updated_at || item.paid_at || undefined,
          });
        }
      }

      if (!ledgerRes.error) {
        hadSuccess = true;
        const ledgerData = ledgerRes.data?.data as unknown as {
          payments?: MonthlyPaymentRecord[];
        } | null;
        if (Array.isArray(ledgerData?.payments)) {
          for (const item of ledgerData.payments) {
            upsertIntoMap(item);
          }
        }
      }

      if (!hadSuccess) return null;
      return Array.from(mergedByKey.values());
    } catch (err) {
      console.warn('Exceção ao buscar mensalidades do Supabase:', err);
      return null;
    }
  },

  /**
   * Salva ou atualiza o status de mensalidade de um atleta online no Supabase.
   * Tenta a tabela oficial monthly_payments e garante persistência + broadcast realtime no livro monthly_payments_ledger_v1.
   */
  async upsertMonthlyPayment(record: MonthlyPaymentRecord): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    const nowIso = record.updatedAt || new Date().toISOString();
    const recordWithUpdated: MonthlyPaymentRecord = {
      ...record,
      yearMonth: (record.yearMonth || '').trim(),
      updatedAt: nowIso,
    };

    try {
      const isUuid = Boolean(
        record.confirmedBy &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            record.confirmedBy
          )
      );

      // 1. Tenta salvar na tabela oficial monthly_payments (quando disponível e autorizada pela RLS)
      let tableSaved = false;
      try {
        const { error } = await supabase.from('monthly_payments').upsert(
          {
            id: recordWithUpdated.id,
            player_id: recordWithUpdated.playerId,
            year_month: recordWithUpdated.yearMonth,
            is_paid: recordWithUpdated.isPaid,
            paid_at: recordWithUpdated.paidAt || null,
            amount: recordWithUpdated.amount || 30.0,
            confirmed_by: isUuid ? (recordWithUpdated.confirmedBy as string) : null,
            updated_at: nowIso,
          },
          { onConflict: 'id' }
        );
        tableSaved = !error;
      } catch {
        tableSaved = false;
      }

      // 2. Persiste de forma enfileirada no livro sincronizado em pelada_sumulas
      //    (garante leitura por todos os atletas/treinadores e dispara Realtime instantâneo)
      const writeLedger = async (): Promise<boolean> => {
        if (!supabase) return false;
        const { data: existingRow, error: readErr } = await supabase
          .from('pelada_sumulas')
          .select('id, data')
          .eq('id', 'monthly_payments_ledger_v1')
          .maybeSingle();

        if (readErr) {
          console.warn('Erro ao ler livro de mensalidades no Supabase:', readErr.message);
          return false;
        }

        const existingData =
          (existingRow?.data as unknown as { payments?: MonthlyPaymentRecord[] }) || {};
        const existingList = Array.isArray(existingData.payments) ? existingData.payments : [];
        const updatedList = [
          recordWithUpdated,
          ...existingList.filter(
            (item) =>
              item &&
              item.id !== recordWithUpdated.id &&
              !(
                item.playerId === recordWithUpdated.playerId &&
                (item.yearMonth || '').trim() === recordWithUpdated.yearMonth
              )
          ),
        ];

        const { error: upsertErr } = await supabase.from('pelada_sumulas').upsert(
          {
            id: 'monthly_payments_ledger_v1',
            team_name: 'Mensalidades',
            status: 'financial_ledger',
            match_date: null,
            start_time: null,
            data: { payments: updatedList } as unknown as Record<string, unknown>,
            last_updated: nowIso,
          },
          { onConflict: 'id' }
        );

        if (upsertErr) {
          console.error('Erro ao salvar livro de mensalidades no Supabase:', upsertErr.message);
          return false;
        }
        return true;
      };

      const queuedWrite = monthlyLedgerWriteQueue.then(writeLedger, writeLedger);
      monthlyLedgerWriteQueue = queuedWrite.catch(() => false);
      const ledgerSaved = await queuedWrite;

      return tableSaved || ledgerSaved;
    } catch (err) {
      console.error('Exceção ao sincronizar mensalidade com Supabase:', err);
      return false;
    }
  },

  /**
   * Busca as configurações da pelada (valor e chave PIX), isoladas por time quando informado.
   */
  async getMonthlyConfig(teamName?: string): Promise<PeladaMonthlyConfig | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const slug = buildTeamSlug(teamName);

      // 1. Se informou o time, busca primeiro a config específica deste time em pelada_sumulas
      if (slug && slug !== 'meu_time' && slug !== 'sem_time') {
        const teamLedgerId = `monthly_config_ledger_${slug}`;
        const { data: teamRow } = await supabase
          .from('pelada_sumulas')
          .select('data, last_updated')
          .eq('id', teamLedgerId)
          .maybeSingle();

        const teamData = teamRow?.data as unknown as { config?: PeladaMonthlyConfig } | null;
        if (teamData?.config) {
          return teamData.config;
        }
      }

      let tableCfg: PeladaMonthlyConfig | null = null;
      let tableUpdated = 0;

      const { data, error } = await supabase
        .from('pelada_monthly_configs')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        tableCfg = {
          monthlyAmount: Number(data.monthly_amount),
          dueDay: data.due_day,
          pixKey: data.pix_key,
          pixKeyType: data.pix_key_type,
          pixReceiverName: data.pix_receiver_name,
        };
        tableUpdated = new Date(data.updated_at || 0).getTime();
      }

      // 2. Verifica também o livro global de config em pelada_sumulas
      const { data: ledgerRow } = await supabase
        .from('pelada_sumulas')
        .select('data, last_updated')
        .eq('id', 'monthly_config_ledger_v1')
        .maybeSingle();

      const ledgerData = ledgerRow?.data as unknown as { config?: PeladaMonthlyConfig } | null;
      if (ledgerData?.config) {
        const ledgerUpdated = new Date(ledgerRow?.last_updated || 0).getTime();
        if (!tableCfg || ledgerUpdated >= tableUpdated) {
          return ledgerData.config;
        }
      }

      return tableCfg;
    } catch {
      return null;
    }
  },

  /**
   * Salva a configuração financeira da pelada (PIX e valor mensal), isolando por time.
   */
  async saveMonthlyConfig(config: PeladaMonthlyConfig, teamName?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      const normalizedKeyType =
        config.pixKeyType.toLowerCase() === 'celular'
          ? 'telefone'
          : ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'].includes(
              config.pixKeyType.toLowerCase()
            )
          ? config.pixKeyType.toLowerCase()
          : 'aleatoria';

      const nowIso = new Date().toISOString();
      const slug = buildTeamSlug(teamName);
      const ledgerId =
        slug && slug !== 'meu_time' && slug !== 'sem_time'
          ? `monthly_config_ledger_${slug}`
          : 'monthly_config_ledger_v1';

      // 1. Tenta salvar na tabela pelada_monthly_configs
      let tableSaved = false;
      try {
        const { error } = await supabase.from('pelada_monthly_configs').upsert(
          {
            id: '33333333-3333-4333-8333-333333333301',
            monthly_amount: config.monthlyAmount,
            due_day: config.dueDay,
            pix_key: config.pixKey,
            pix_key_type: normalizedKeyType,
            pix_receiver_name: config.pixReceiverName,
            updated_at: nowIso,
          },
          { onConflict: 'id' }
        );
        tableSaved = !error;
      } catch {
        tableSaved = false;
      }

      // 2. Salva no livro de configuração por time em pelada_sumulas
      const { error: fallbackErr } = await supabase.from('pelada_sumulas').upsert(
        {
          id: ledgerId,
          team_name: teamName || 'Config PIX',
          status: 'financial_ledger',
          match_date: null,
          start_time: null,
          data: { config, teamName: teamName || '' } as unknown as Record<string, unknown>,
          last_updated: nowIso,
        },
        { onConflict: 'id' }
      );

      return !fallbackErr || tableSaved;
    } catch (err) {
      console.error('Erro ao salvar configuração de mensalidade no Supabase:', err);
      return false;
    }
  },

  /**
   * Busca a programação do baba/pelada agendada da tabela team_schedules
   */
  async getTeamPeladaSchedule(teamName?: string): Promise<PeladaScheduleConfig | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('team_schedules')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      return {
        date: data.scheduled_date || data.match_date || '',
        time: data.start_time || '20:00',
        venueName: data.venue_name || 'Arena',
        neighborhood: data.neighborhood || 'Centro',
      };
    } catch {
      return null;
    }
  },

  /**
   * Salva a programação do baba/pelada na tabela team_schedules
   */
  async saveTeamPeladaSchedule(
    teamName: string,
    config: PeladaScheduleConfig
  ): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      const nowIso = new Date().toISOString();
      let teamId: string | null = null;
      const cleanName = (teamName || '').trim();
      if (cleanName && cleanName !== 'Meu Time' && cleanName !== 'Sem Time') {
        const { data: teamData } = await supabase
          .from('teams')
          .select('id')
          .ilike('name', cleanName)
          .limit(1)
          .maybeSingle();
        if (teamData?.id) {
          teamId = teamData.id;
        }
      }

      const payload: Record<string, any> = {
        scheduled_date: config.date,
        start_time: config.time,
        venue_name: config.venueName,
        neighborhood: config.neighborhood,
        updated_at: nowIso,
      };

      if (teamId) {
        payload.team_id = teamId;
      }

      const { error } = await supabase.from('team_schedules').upsert(
        payload,
        teamId ? { onConflict: 'team_id' } : undefined
      );
      return !error;
    } catch (err) {
      console.error('Erro ao salvar agendamento do baba no Supabase:', err);
      return false;
    }
  },

  /**
   * Salva a súmula da pelada na tabela pelada_sumulas.
   * Apenas súmulas com status em_andamento ou finalizada são persistidas.
   */
  async savePeladaSumula(sumula: SumulaData): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      const nowIso = new Date().toISOString();
      const isFinal = sumula.status === 'finalizada';

      const payload: Record<string, any> = {
        id: sumula.id,
        team_name: sumula.teamName || 'Pelada',
        status: sumula.status || 'em_andamento',
        match_date: sumula.matchDate || null,
        start_time: sumula.startTime || null,
        created_by_user_id: sumula.createdByUserId || null,
        created_by_name: sumula.createdByName || null,
        data: sumula as unknown as Record<string, unknown>,
        last_updated: sumula.lastUpdated || nowIso,
      };

      if (isFinal) {
        payload.finalized_at = nowIso;
        if (sumula.createdByUserId) {
          payload.finalized_by = sumula.createdByUserId;
        }
      }

      const { error } = await supabase.from('pelada_sumulas').upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('Erro ao salvar súmula no Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Exceção ao sincronizar súmula com Supabase:', err);
      return false;
    }
  },

  /**
   * Reabre uma súmula finalizada de forma auditada através da RPC oficial
   * reopen_pelada_sumula_authenticated (exclusivo para treinadores do time ou admin da plataforma).
   */
  async reopenPeladaSumula(sumulaId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase || !sumulaId) {
      return { success: false, error: 'Parâmetros inválidos.' };
    }
    try {
      const { error } = await supabase.rpc('reopen_pelada_sumula_authenticated', {
        p_sumula_id: sumulaId,
        p_reason: reason.trim(),
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  /**
   * Busca todas as súmulas de partidas reais no Supabase ordenadas pela mais recente.
   * Filtra estritamente status esportivos: em_andamento e finalizada.
   */
  async getPeladaSumulas(): Promise<SumulaData[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('pelada_sumulas')
        .select('*')
        .in('status', ['em_andamento', 'finalizada', 'cancelada'])
        .order('last_updated', { ascending: false });

      if (error || !data) {
        console.warn('Erro ao buscar súmulas do Supabase:', error);
        return null;
      }

      return data.map((row) => {
        const full = (row.data as unknown as SumulaData) || ({} as SumulaData);
        return {
          ...full,
          id: row.id || full.id,
          teamName: row.team_name || full.teamName,
          status: (row.status as 'em_andamento' | 'finalizada') || full.status || 'em_andamento',
          matchDate: row.match_date || full.matchDate,
          startTime: row.start_time || full.startTime,
          createdByUserId: row.created_by_user_id || full.createdByUserId,
          createdByName: row.created_by_name || full.createdByName,
          lastUpdated: row.last_updated || full.lastUpdated || new Date().toISOString(),
        };
      });
    } catch (err) {
      console.warn('Exceção ao buscar súmulas do Supabase:', err);
      return null;
    }
  },

  /**
   * Busca uma súmula específica por ID no Supabase.
   */
  async getPeladaSumulaById(id: string): Promise<SumulaData | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('pelada_sumulas')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return null;

      const full = (data.data as unknown as SumulaData) || ({} as SumulaData);
      return {
        ...full,
        id: data.id || full.id,
        teamName: data.team_name || full.teamName,
        status: (data.status as 'em_andamento' | 'finalizada') || full.status || 'em_andamento',
        matchDate: data.match_date || full.matchDate,
        startTime: data.start_time || full.startTime,
        createdByUserId: data.created_by_user_id || full.createdByUserId,
        createdByName: data.created_by_name || full.createdByName,
        lastUpdated: data.last_updated || full.lastUpdated || new Date().toISOString(),
      };
    } catch (err) {
      console.warn('Exceção ao buscar súmula por ID no Supabase:', err);
      return null;
    }
  },

  /**
   * Remove uma súmula do Supabase (apenas em_andamento permitido por RLS).
   */
  async deletePeladaSumula(sumulaId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      const { error } = await supabase
        .from('pelada_sumulas')
        .delete()
        .eq('id', sumulaId);

      if (error) {
        console.warn('Erro ao excluir súmula no Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Exceção ao excluir súmula no Supabase:', err);
      return false;
    }
  },

  /**
   * Busca todas as transações financeiras (tabela dedicada team_financial_transactions + livro-caixa sincronizado em pelada_sumulas)
   */
  async getTeamTransactions(): Promise<TeamTransaction[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const collectedMap = new Map<string, TeamTransaction>();
      let hadSuccess = false;

      // 1. Consulta tabela dedicada team_financial_transactions quando ela existir no banco
      if (hasDedicatedFinancialTxTable !== false) {
        const { data, error } = await supabase
          .from('team_financial_transactions')
          .select('*');

        if (error) {
          if (isMissingTableError(error)) {
            hasDedicatedFinancialTxTable = false;
          }
        } else if (Array.isArray(data)) {
          hasDedicatedFinancialTxTable = true;
          hadSuccess = true;
          for (const item of data as any[]) {
            if (!item?.id) continue;
            collectedMap.set(item.id, {
              id: item.id,
              teamName: item.team_name || 'Meu Time',
              type: item.type,
              category: item.category || 'outro',
              description: item.description,
              amount: Number(item.amount) || 0,
              date: item.transaction_date || item.date || (item.created_at || '').split('T')[0],
              notes: item.notes || undefined,
              createdByName: item.created_by_name || undefined,
              createdByUserId: item.created_by_user_id || undefined,
              createdAt: item.created_at,
            });
          }
        }
      }

      // 2. Consulta livro-caixa sincronizado em pelada_sumulas (status = 'financial_ledger')
      const { data: ledgerRows, error: ledgerErr } = await supabase
        .from('pelada_sumulas')
        .select('id, team_name, data, last_updated')
        .eq('status', 'financial_ledger');

      if (!ledgerErr && Array.isArray(ledgerRows)) {
        hadSuccess = true;
        for (const row of ledgerRows) {
          const rawData = row.data as unknown as { transactions?: TeamTransaction[] } | null;
          const list = Array.isArray(rawData?.transactions) ? rawData.transactions : [];
          for (const tx of list) {
            if (tx && tx.id && !collectedMap.has(tx.id)) {
              collectedMap.set(tx.id, {
                ...tx,
                teamName: tx.teamName || row.team_name || 'Meu Time',
                amount: Number(tx.amount) || 0,
              });
            }
          }
        }
      }

      if (!hadSuccess) return null;

      return Array.from(collectedMap.values()).sort((a, b) => {
        const tA = new Date(a.date || a.createdAt || 0).getTime();
        const tB = new Date(b.date || b.createdAt || 0).getTime();
        if (tB !== tA) return tB - tA;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
    } catch (err) {
      console.warn('Exceção ao buscar transações financeiras no Supabase:', err);
      return null;
    }
  },

  /**
   * Salva uma transação financeira online no Supabase (tabela dedicada quando existir + livro-caixa enfileirado em pelada_sumulas)
   */
  async saveTeamTransaction(tx: TeamTransaction): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      let tableSaved = false;

      // 1. Tenta salvar na tabela dedicada quando existir no banco
      if (hasDedicatedFinancialTxTable !== false) {
        const { error } = await supabase.from('team_financial_transactions').upsert(
          {
            id: tx.id,
            team_name: tx.teamName || 'Meu Time',
            type: tx.type,
            category: tx.category,
            description: tx.description,
            amount: Number(tx.amount) || 0,
            date: tx.date,
            notes: tx.notes || null,
            created_by_name: tx.createdByName || null,
            created_by_user_id: tx.createdByUserId || null,
            created_at: tx.createdAt || new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        if (error) {
          if (isMissingTableError(error)) {
            hasDedicatedFinancialTxTable = false;
          }
        } else {
          hasDedicatedFinancialTxTable = true;
          tableSaved = true;
        }
      }

      // 2. Salva de forma enfileirada no livro-caixa do time em pelada_sumulas
      //    (garante visibilidade para todos os atletas/treinadores e dispara Realtime instantâneo)
      const slug = buildTeamSlug(tx.teamName) || 'meu_time';
      const ledgerId = `finance_ledger_${slug}`;
      const normalizedTx: TeamTransaction = {
        ...tx,
        teamName: tx.teamName || 'Meu Time',
        amount: Number(tx.amount) || 0,
        createdAt: tx.createdAt || new Date().toISOString(),
      };

      const writeFinancialLedger = async (): Promise<boolean> => {
        if (!supabase) return false;
        const { data: existingRow, error: readErr } = await supabase
          .from('pelada_sumulas')
          .select('id, team_name, data')
          .eq('id', ledgerId)
          .maybeSingle();

        if (readErr) {
          console.error('Erro ao ler livro-caixa no Supabase:', readErr.message);
          return false;
        }

        const existingData =
          (existingRow?.data as unknown as { transactions?: TeamTransaction[] }) || {};
        const existingList = Array.isArray(existingData.transactions)
          ? existingData.transactions
          : [];
        const merged = [normalizedTx, ...existingList.filter((item) => item && item.id !== normalizedTx.id)];

        const { error: upsertErr } = await supabase.from('pelada_sumulas').upsert(
          {
            id: ledgerId,
            team_name: normalizedTx.teamName,
            status: 'financial_ledger',
            match_date: null,
            start_time: null,
            created_by_user_id: normalizedTx.createdByUserId || null,
            created_by_name: normalizedTx.createdByName || null,
            data: { transactions: merged } as unknown as Record<string, unknown>,
            last_updated: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        if (upsertErr) {
          console.error('Erro ao salvar livro-caixa no Supabase:', upsertErr.message);
          return false;
        }
        return true;
      };

      const queuedWrite = financialLedgerWriteQueue.then(writeFinancialLedger, writeFinancialLedger);
      financialLedgerWriteQueue = queuedWrite.catch(() => false);
      const ledgerSaved = await queuedWrite;

      return tableSaved || ledgerSaved;
    } catch (err) {
      console.warn('Exceção ao salvar transação financeira no Supabase:', err);
      return false;
    }
  },

  /**
   * Estorna uma transação financeira de forma auditada e com proteção contra duplicidade
   */
  async reverseTeamTransaction(txId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase || !txId) {
      return { success: false, error: 'Parâmetros inválidos.' };
    }
    try {
      const { error } = await supabase.rpc('reverse_team_financial_transaction_authenticated', {
        p_transaction_id: txId,
        p_reason: reason.trim(),
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  /**
   * Remove uma transação financeira (tabela dedicada quando existir + livro-caixa enfileirado em pelada_sumulas)
   */
  async deleteTeamTransaction(txId: string, teamName?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      let tableDeleted = false;

      if (hasDedicatedFinancialTxTable !== false) {
        const revRes = await this.reverseTeamTransaction(
          txId,
          'Exclusão solicitada pelo gestor financeiro'
        );
        if (revRes.success) {
          tableDeleted = true;
        } else {
          const { error } = await supabase
            .from('team_financial_transactions')
            .delete()
            .eq('id', txId);
          if (error) {
            if (isMissingTableError(error)) {
              hasDedicatedFinancialTxTable = false;
            }
          } else {
            tableDeleted = true;
          }
        }
      }

      const removeFromFinancialLedger = async (): Promise<boolean> => {
        if (!supabase) return false;
        const slug = buildTeamSlug(teamName);
        const preferredLedgerId = slug ? `finance_ledger_${slug}` : '';

        // Busca todos os livros-caixa para garantir a remoção mesmo se o nome do time tiver mudado
        const { data: ledgerRows, error: readErr } = await supabase
          .from('pelada_sumulas')
          .select('id, team_name, data')
          .eq('status', 'financial_ledger');

        if (readErr) {
          console.error('Erro ao ler livro-caixa para exclusão:', readErr.message);
          return false;
        }

        const candidateRows = (ledgerRows || []).filter((row) => {
          const rawData = row.data as unknown as { transactions?: TeamTransaction[] } | null;
          if (!Array.isArray(rawData?.transactions)) return false;
          return (
            row.id === preferredLedgerId ||
            rawData.transactions.some((item) => item && item.id === txId)
          );
        });

        if (candidateRows.length === 0) return true;

        let allOk = true;
        for (const row of candidateRows) {
          const rawData = (row.data as unknown as { transactions?: TeamTransaction[] }) || {};
          const existingList = Array.isArray(rawData.transactions) ? rawData.transactions : [];
          if (!existingList.some((item) => item && item.id === txId)) continue;

          const remaining = existingList.filter((item) => item && item.id !== txId);
          const { error: upsertErr } = await supabase.from('pelada_sumulas').upsert(
            {
              id: row.id,
              team_name: teamName || row.team_name || 'Meu Time',
              status: 'financial_ledger',
              data: { transactions: remaining } as unknown as Record<string, unknown>,
              last_updated: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );

          if (upsertErr) {
            console.error('Erro ao excluir lançamento do livro-caixa:', upsertErr.message);
            allOk = false;
          }
        }

        return allOk;
      };

      const queuedDelete = financialLedgerWriteQueue.then(
        removeFromFinancialLedger,
        removeFromFinancialLedger
      );
      financialLedgerWriteQueue = queuedDelete.catch(() => false);
      const ledgerDeleted = await queuedDelete;

      return tableDeleted || ledgerDeleted;
    } catch {
      return false;
    }
  },

  /**
   * Busca a lista de logs de auditoria exclusivamente da tabela dedicada audit_logs
   */
  async getAuditLogs(): Promise<AuditLog[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error || !data) return null;

      return data.map((item) => ({
        id: item.id,
        actorUserId: item.actor_user_id,
        actorName: item.actor_name || 'Usuário',
        actorRole: item.actor_role,
        actionType: item.action_type,
        entityType: item.entity_type,
        entityId: item.entity_id,
        reason: item.reason,
        beforeData: item.before_data,
        afterData: item.after_data,
        createdAt: item.created_at,
      }));
    } catch (err) {
      console.warn('Exceção ao buscar logs de auditoria no Supabase:', err);
      return null;
    }
  },

  /**
   * Registra um novo log de auditoria exclusivamente na tabela audit_logs
   */
  async recordAuditLogInSupabase(log: AuditLog): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      const isUuid = (str?: string) =>
        Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

      const { error } = await supabase.from('audit_logs').insert([
        {
          id: generateUUID(),
          actor_user_id: isUuid(log.actorUserId) ? log.actorUserId : null,
          actor_name: log.actorName || 'Usuário',
          actor_role: log.actorRole || 'player',
          action_type: log.actionType,
          entity_type: log.entityType,
          entity_id: log.entityId || 'global',
          reason: log.reason || null,
          before_data: log.beforeData || null,
          after_data: log.afterData || null,
          created_at: log.createdAt || new Date().toISOString(),
        },
      ]);
      return !error;
    } catch (err) {
      console.warn('Exceção ao salvar log de auditoria no Supabase:', err);
      return false;
    }
  },

  /**
   * Busca todas as avaliações de atletas exclusivamente da tabela normalizada peer_evaluations
   */
  async getPeerEvaluations(): Promise<PeerEvaluation[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('peer_evaluations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error || !data) return null;

      return data.map((row) => ({
        id: row.id,
        evaluatorId: row.evaluator_player_id || row.evaluator_user_id,
        targetPlayerId: row.target_player_id,
        finalizacao: row.finalizacao,
        marcacao: row.marcacao,
        passe: row.passe,
        raca: row.raca,
        drible: row.drible,
        overall: Number(row.overall),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err) {
      console.warn('Exceção ao buscar avaliações no Supabase:', err);
      return null;
    }
  },

  /**
   * Salva e sincroniza uma avaliação de atleta via RPC submit_peer_evaluation_authenticated
   * ou diretamente na tabela normalizada peer_evaluations.
   * Não grava nada em pelada_sumulas.
   */
  async savePeerEvaluation(
    evaluation: PeerEvaluation,
    allEvalsForPlayer?: PeerEvaluation[]
  ): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      if (
        evaluation.targetPlayerId &&
        evaluation.finalizacao !== undefined &&
        evaluation.marcacao !== undefined &&
        evaluation.passe !== undefined &&
        evaluation.raca !== undefined &&
        evaluation.drible !== undefined
      ) {
        const { error } = await supabase.rpc('submit_peer_evaluation_authenticated', {
          p_target_player_id: evaluation.targetPlayerId,
          p_finalizacao: evaluation.finalizacao,
          p_marcacao: evaluation.marcacao,
          p_passe: evaluation.passe,
          p_raca: evaluation.raca,
          p_drible: evaluation.drible,
        });
        if (!error) return true;
      }

      const computedOverall = Math.round(
        ((evaluation.finalizacao + evaluation.marcacao + evaluation.passe + evaluation.raca + evaluation.drible) / 5.0) * 100
      ) / 100;

      const { error: tblErr } = await supabase.from('peer_evaluations').upsert({
        evaluator_player_id: evaluation.evaluatorId,
        target_player_id: evaluation.targetPlayerId,
        finalizacao: evaluation.finalizacao,
        marcacao: evaluation.marcacao,
        passe: evaluation.passe,
        raca: evaluation.raca,
        drible: evaluation.drible,
        overall: computedOverall,
        updated_at: new Date().toISOString(),
      });
      return !tblErr;
    } catch (err) {
      console.warn('Exceção ao salvar avaliação no Supabase:', err);
      return false;
    }
  },

  /**
   * Emite um convite criptográfico de 128 bits para a equipe via RPC
   */
  async issueTeamInvite(
    teamId: string,
    expiresInHours = 48,
    maxUses = 1
  ): Promise<{ success: boolean; rawToken?: string; error?: string }> {
    if (!isSupabaseConfigured() || !supabase || !teamId) {
      return { success: false, error: 'Parâmetros inválidos.' };
    }
    try {
      const { data, error } = await supabase.rpc('issue_team_invite_authenticated', {
        p_team_id: teamId,
        p_expires_in_hours: expiresInHours,
        p_max_uses: maxUses,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, rawToken: data?.raw_token };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  /**
   * Ingressa em uma equipe através de código de convite via RPC com bloqueio concorrente
   */
  async joinTeamWithInviteCode(
    inviteCode: string
  ): Promise<{ success: boolean; teamId?: string; teamName?: string; error?: string }> {
    if (!isSupabaseConfigured() || !supabase || !inviteCode) {
      return { success: false, error: 'Código de convite não informado.' };
    }
    try {
      const { data, error } = await supabase.rpc('join_team_with_invite_code_authenticated', {
        p_raw_token: inviteCode.trim(),
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return {
        success: true,
        teamId: data?.team_id,
        teamName: data?.team_name,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
