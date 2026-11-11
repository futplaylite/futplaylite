import { supabase, isSupabaseConfigured } from './client';
import {
  DominantFoot,
  MonthlyPaymentRecord,
  PeladaMonthlyConfig,
  PlayerPosition,
  PlayerProfile,
  ProfileVisibility,
  SumulaData,
  TeamModality,
  TeamTransaction,
  User,
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
      const { data, error } = await supabase.from('users').select('*');
      if (error || !data) {
        console.warn('Erro ao buscar usuários do Supabase:', error);
        return null;
      }

      return data.map((u) => ({
        id: u.id,
        email: u.email,
        whatsappNumber: u.whatsapp_number || undefined,
        teamName: u.team_name || undefined,
        teamCrestUrl: u.team_crest_url || undefined,
        teamCity: u.team_city || undefined,
        teamModality: u.team_modality || undefined,
        teamInviteCode: u.team_invite_code || undefined,
        isTeamOwner: Boolean(u.is_team_owner),
        role: u.role || 'player',
        status: u.status || 'ativa',
        createdAt: u.created_at,
      }));
    } catch (err) {
      console.warn('Exceção ao buscar usuários do Supabase:', err);
      return null;
    }
  },

  /**
   * Localiza usuário pelo e-mail ou telefone diretamente no Supabase para autenticação
   */
  async findUserByIdentifier(
    identifier: string
  ): Promise<{ user: User; password?: string; profile?: PlayerProfile } | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    const trimmed = identifier.trim().toLowerCase();
    const digits = trimmed.replace(/\D/g, '');
    const isEmail = trimmed.includes('@');

    try {
      let data: any = null;

      if (isEmail) {
        const res = await supabase
          .from('users')
          .select('*')
          .ilike('email', trimmed)
          .limit(1)
          .maybeSingle();
        data = res.data;
      } else {
        // Tenta buscar por whatsapp_number (apenas dígitos para não quebrar parser do PostgREST com parênteses) ou email gerado
        const last8 = digits.length > 8 ? digits.slice(-8) : digits;
        const orFilter = [
          `email.ilike.${digits}%`,
          `whatsapp_number.eq.${digits}`,
          `whatsapp_number.ilike.%${digits}%`,
          `whatsapp_number.ilike.%${last8}`,
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
            .ilike('email', `${digits}%`)
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

      if (!data) return null;

      const user: User = {
        id: data.id,
        email: data.email,
        whatsappNumber: data.whatsapp_number || undefined,
        teamName: data.team_name || undefined,
        teamCrestUrl: data.team_crest_url || undefined,
        teamCity: data.team_city || undefined,
        teamModality: data.team_modality || undefined,
        teamInviteCode: data.team_invite_code || undefined,
        isTeamOwner: Boolean(data.is_team_owner),
        role: data.role || 'player',
        status: data.status || 'ativa',
        createdAt: data.created_at,
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
          isTeamOwner: Boolean(pData.is_team_owner || data.is_team_owner),
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
          updatedAt: pData.updated_at,
        };
      }

      return {
        user,
        password: data.password_hash || undefined,
        profile,
      };
    } catch (err) {
      console.warn('Exceção ao buscar usuário no Supabase:', err);
      return null;
    }
  },

  /**
   * Registra novo usuário e perfil de atleta diretamente no Supabase
   */
  async registerAthleteInSupabase(params: {
    user: User;
    profile: PlayerProfile;
    password?: string;
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

      // 0. Verifica se o usuário já existe no Supabase por e-mail ou celular para evitar conflito de chave única
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

      // 1. Inserir ou atualizar na tabela users (com fallback caso colunas estendidas ainda não existam)
      let uErr: any = null;
      const whatsappToStore = cleanDigits || params.user.whatsappNumber || null;

      const userPayloadFull: Record<string, any> = {
        id: finalUserId,
        email: userEmail,
        whatsapp_number: whatsappToStore,
        password_hash: params.password || null,
        role: params.user.role || 'player',
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
          password_hash: params.password || null,
          role: params.user.role || 'player',
          status: params.user.status || 'ativa',
          updated_at: new Date().toISOString(),
        });
        if (fallbackErr) {
          const { error: baseErr } = await supabase.from('users').upsert({
            id: finalUserId,
            email: userEmail,
            role: params.user.role || 'player',
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
    }
  ): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase || !userId) return false;
    try {
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
      if (updates.teamCity !== undefined) payload.team_city = updates.teamCity;
      if (updates.teamModality !== undefined) payload.team_modality = updates.teamModality;
      if (updates.teamInviteCode !== undefined) payload.team_invite_code = updates.teamInviteCode;
      if (updates.isTeamOwner !== undefined) payload.is_team_owner = updates.isTeamOwner;

      const { error: pError } = await supabase
        .from('player_profiles')
        .update(payload)
        .eq('user_id', userId);

      if (pError) {
        // Fallback sem colunas de time caso a migração ainda não tenha sido rodada
        const basePayload: Record<string, any> = { updated_at: new Date().toISOString() };
        if (updates.displayName !== undefined) basePayload.display_name = updates.displayName;
        if (updates.avatarUrl !== undefined) basePayload.avatar_path = updates.avatarUrl;
        if (updates.position !== undefined) basePayload.position = updates.position;
        if (updates.dominantFoot !== undefined) basePayload.dominant_foot = updates.dominantFoot;
        if (updates.profileVisibility !== undefined) basePayload.profile_visibility = updates.profileVisibility;
        await supabase.from('player_profiles').update(basePayload).eq('user_id', userId);
      }

      // Atualiza também na tabela users
      const userPayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.teamName !== undefined) userPayload.team_name = updates.teamName;
      if (updates.teamCrestUrl !== undefined) userPayload.team_crest_url = updates.teamCrestUrl;
      if (updates.teamCity !== undefined) userPayload.team_city = updates.teamCity;
      if (updates.teamModality !== undefined) userPayload.team_modality = updates.teamModality;
      if (updates.teamInviteCode !== undefined) userPayload.team_invite_code = updates.teamInviteCode;
      if (updates.isTeamOwner !== undefined) userPayload.is_team_owner = updates.isTeamOwner;

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
   * Atualiza a senha do usuário no Supabase
   */
  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase || !userId) return false;
    try {
      const { error } = await supabase
        .from('users')
        .update({
          password_hash: newPassword,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.warn('Aviso ao atualizar senha no Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Erro ao atualizar senha no Supabase:', err);
      return false;
    }
  },

  /**
   * Busca perfis esportivos cadastrados no Supabase
   */
  async getProfiles(): Promise<PlayerProfile[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    const { data, error } = await supabase
      .from('player_profiles')
      .select('*')
      .order('current_rating', { ascending: false });

    if (error || !data) {
      console.warn('Erro ao buscar perfis do Supabase:', error);
      return null;
    }

    // Contas de administradores nunca participam de jogos e não aparecem em listas de atletas
    const { data: usersData } = await supabase.from('users').select('id, role, email');
    const adminUserIds = new Set(
      (usersData || [])
        .filter(
          (u) =>
            u.role === 'admin' ||
            (u.email && u.email.toLowerCase() === 'futplaylite@gmail.com')
        )
        .map((u) => u.id)
    );

    const athleteRows = data.filter((p) => {
      if (adminUserIds.has(p.user_id)) return false;
      if ((p.display_name || '').trim().toUpperCase() === 'ADMIN') return false;
      if (p.id === 'a0000000-0000-4000-8000-000000000002') return false;
      if (p.user_id === 'a0000000-0000-4000-8000-000000000001') return false;
      return true;
    });

    return athleteRows.map((p) => ({
      id: p.id,
      userId: p.user_id,
      displayName: p.display_name,
      avatarUrl: p.avatar_path || undefined,
      teamName: p.team_name || undefined,
      teamCrestUrl: p.team_crest_url || undefined,
      teamCity: p.team_city || undefined,
      teamModality: p.team_modality || undefined,
      teamInviteCode: p.team_invite_code || undefined,
      isTeamOwner: Boolean(p.is_team_owner),
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
      updatedAt: p.updated_at,
    }));
  },

  /**
   * Busca os registros mensais de mensalidades (tabela oficial + fallback em pelada_sumulas)
   */
  async getMonthlyPayments(): Promise<MonthlyPaymentRecord[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const mergedMap = new Map<string, MonthlyPaymentRecord>();
      let hadSuccess = false;

      // 1. Consulta tabela oficial monthly_payments
      const { data, error } = await supabase
        .from('monthly_payments')
        .select('*');

      if (!error && data) {
        hadSuccess = true;
        for (const item of data) {
          const rec: MonthlyPaymentRecord = {
            id: item.id,
            playerId: item.player_id,
            yearMonth: item.year_month.trim(),
            isPaid: item.is_paid,
            paidAt: item.paid_at || undefined,
            amount: Number(item.amount),
            confirmedBy: item.confirmed_by || undefined,
            updatedAt: item.updated_at || item.paid_at || undefined,
          };
          mergedMap.set(rec.id, rec);
        }
      }

      // 2. Consulta também livro de fallback em pelada_sumulas (usado automaticamente caso RLS bloqueie escrita anon)
      const { data: ledgerRow, error: ledgerErr } = await supabase
        .from('pelada_sumulas')
        .select('*')
        .eq('id', 'monthly_payments_ledger_v1')
        .maybeSingle();

      if (!ledgerErr) {
        hadSuccess = true;
        const ledgerData = ledgerRow?.data as unknown as { payments?: MonthlyPaymentRecord[] } | null;
        if (Array.isArray(ledgerData?.payments)) {
          for (const item of ledgerData.payments) {
            if (!item || !item.id) continue;
            const existing = mergedMap.get(item.id);
            if (!existing) {
              mergedMap.set(item.id, item);
            } else {
              const existingTime = new Date(existing.updatedAt || existing.paidAt || 0).getTime();
              const ledgerTime = new Date(item.updatedAt || item.paidAt || 0).getTime();
              if (ledgerTime >= existingTime) {
                mergedMap.set(item.id, item);
              }
            }
          }
        }
      }

      if (!hadSuccess) return null;
      return Array.from(mergedMap.values());
    } catch (err) {
      console.warn('Exceção ao buscar mensalidades do Supabase:', err);
      return null;
    }
  },

  /**
   * Salva ou atualiza o status de mensalidade de um atleta (com fallback automático se RLS bloquear anon)
   */
  async upsertMonthlyPayment(record: MonthlyPaymentRecord): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    const nowIso = record.updatedAt || new Date().toISOString();
    const recordWithUpdated: MonthlyPaymentRecord = {
      ...record,
      updatedAt: nowIso,
    };

    try {
      const isUuid = Boolean(
        record.confirmedBy &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            record.confirmedBy
          )
      );

      // 1. Tenta salvar na tabela oficial monthly_payments
      const { error } = await supabase.from('monthly_payments').upsert(
        {
          id: record.id,
          player_id: record.playerId,
          year_month: record.yearMonth,
          is_paid: record.isPaid,
          paid_at: record.paidAt || null,
          amount: record.amount || 30.0,
          confirmed_by: isUuid ? (record.confirmedBy as string) : null,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      );

      if (!error) return true;

      console.warn('Fallback online para mensalidade (RLS/Schema):', error.message);

      // 2. Fallback automático na tabela pelada_sumulas (que permite escrita anônima segura)
      const { data: existingRow } = await supabase
        .from('pelada_sumulas')
        .select('*')
        .eq('id', 'monthly_payments_ledger_v1')
        .maybeSingle();

      const existingData =
        (existingRow?.data as unknown as { payments?: MonthlyPaymentRecord[] }) || {};
      const existingList = Array.isArray(existingData.payments) ? existingData.payments : [];
      const updatedList = [
        recordWithUpdated,
        ...existingList.filter(
          (item) =>
            item.id !== record.id &&
            !(item.playerId === record.playerId && item.yearMonth === record.yearMonth)
        ),
      ];

      const { error: fallbackErr } = await supabase.from('pelada_sumulas').upsert(
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

      return !fallbackErr;
    } catch (err) {
      console.error('Exceção ao sincronizar mensalidade com Supabase:', err);
      return false;
    }
  },

  /**
   * Busca as configurações da pelada (valor e chave PIX)
   */
  async getMonthlyConfig(): Promise<PeladaMonthlyConfig | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
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

      // Verifica também o fallback em pelada_sumulas
      const { data: ledgerRow } = await supabase
        .from('pelada_sumulas')
        .select('*')
        .eq('id', 'monthly_config_ledger_v1')
        .maybeSingle();

      const ledgerData = ledgerRow?.data as unknown as {
        config?: PeladaMonthlyConfig;
      } | null;

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
   * Salva a configuração financeira da pelada (PIX e valor mensal)
   */
  async saveMonthlyConfig(config: PeladaMonthlyConfig): Promise<boolean> {
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

      if (!error) return true;

      console.warn('Fallback online para config PIX (RLS/Schema):', error.message);

      const { error: fallbackErr } = await supabase.from('pelada_sumulas').upsert(
        {
          id: 'monthly_config_ledger_v1',
          team_name: 'Config PIX',
          status: 'financial_ledger',
          match_date: null,
          start_time: null,
          data: { config } as unknown as Record<string, unknown>,
          last_updated: nowIso,
        },
        { onConflict: 'id' }
      );

      return !fallbackErr;
    } catch (err) {
      console.error('Erro ao salvar configuração de mensalidade no Supabase:', err);
      return false;
    }
  },

  /**
   * Salva a súmula da pelada online em tempo real no Supabase.
   * Permite sincronização imediata com múltiplos aparelhos simultâneos.
   */
  async savePeladaSumula(sumula: SumulaData): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      const { error } = await supabase.from('pelada_sumulas').upsert(
        {
          id: sumula.id,
          team_name: sumula.teamName || 'Pelada',
          status: sumula.status || 'em_andamento',
          match_date: sumula.matchDate || null,
          start_time: sumula.startTime || null,
          created_by_user_id: sumula.createdByUserId || null,
          created_by_name: sumula.createdByName || null,
          data: sumula as unknown as Record<string, unknown>,
          last_updated: sumula.lastUpdated || new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

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
   * Busca todas as súmulas registradas no Supabase ordenadas pela mais recente.
   */
  async getPeladaSumulas(): Promise<SumulaData[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('pelada_sumulas')
        .select('*')
        .neq('status', 'financial_ledger')
        .order('last_updated', { ascending: false });

      if (error || !data) {
        console.warn('Erro ao buscar súmulas do Supabase:', error);
        return null;
      }

      return data
        .filter(
          (row) =>
            row.status !== 'financial_ledger' &&
            !row.id?.startsWith('finance_ledger_') &&
            !row.id?.startsWith('monthly_')
        )
        .map((row) => {
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
   * Remove uma súmula do Supabase.
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
   * Busca todas as transações financeiras (despesas e receitas) dos times no Supabase.
   * Tenta primeiro na tabela dedicada; se ainda não existir, usa o livro-caixa sincronizado em pelada_sumulas.
   */
  async getTeamTransactions(): Promise<TeamTransaction[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      // 1. Tenta tabela dedicada team_financial_transactions
      const { data, error } = await supabase
        .from('team_financial_transactions')
        .select('*')
        .order('date', { ascending: false });

      if (!error && data) {
        return data.map((item) => ({
          id: item.id,
          teamName: item.team_name,
          type: item.type,
          category: item.category,
          description: item.description,
          amount: Number(item.amount),
          date: item.date,
          notes: item.notes || undefined,
          createdByName: item.created_by_name || undefined,
          createdByUserId: item.created_by_user_id || undefined,
          createdAt: item.created_at,
        }));
      }

      // 2. Fallback automático na tabela pelada_sumulas (status = 'financial_ledger')
      const { data: ledgerRows, error: ledgerErr } = await supabase
        .from('pelada_sumulas')
        .select('*')
        .eq('status', 'financial_ledger');

      if (ledgerErr || !ledgerRows) {
        return null;
      }

      const collected: TeamTransaction[] = [];
      const seenIds = new Set<string>();
      for (const row of ledgerRows) {
        const rawData = row.data as unknown as { transactions?: TeamTransaction[] } | null;
        const list = Array.isArray(rawData?.transactions) ? rawData.transactions : [];
        for (const tx of list) {
          if (tx && tx.id && !seenIds.has(tx.id)) {
            seenIds.add(tx.id);
            collected.push(tx);
          }
        }
      }

      return collected.sort((a, b) => {
        const tA = new Date(a.date || a.createdAt || 0).getTime();
        const tB = new Date(b.date || b.createdAt || 0).getTime();
        return tB - tA;
      });
    } catch (err) {
      console.warn('Exceção ao buscar transações financeiras no Supabase:', err);
      return null;
    }
  },

  /**
   * Salva uma transação financeira (receita/despesa) online no Supabase.
   */
  async saveTeamTransaction(tx: TeamTransaction): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      // 1. Tenta salvar na tabela dedicada
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

      if (!error) return true;

      // 2. Fallback automático no livro-caixa em pelada_sumulas
      const slug = (tx.teamName || 'meu_time')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const ledgerId = `finance_ledger_${slug || 'meu_time'}`;

      const { data: existingRow } = await supabase
        .from('pelada_sumulas')
        .select('*')
        .eq('id', ledgerId)
        .maybeSingle();

      const existingData = (existingRow?.data as unknown as { transactions?: TeamTransaction[] }) || {};
      const existingList = Array.isArray(existingData.transactions) ? existingData.transactions : [];
      const merged = [tx, ...existingList.filter((item) => item.id !== tx.id)];

      const { error: upsertErr } = await supabase.from('pelada_sumulas').upsert(
        {
          id: ledgerId,
          team_name: tx.teamName || 'Meu Time',
          status: 'financial_ledger',
          match_date: null,
          start_time: null,
          created_by_user_id: tx.createdByUserId || null,
          created_by_name: tx.createdByName || null,
          data: { transactions: merged } as unknown as Record<string, unknown>,
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      return !upsertErr;
    } catch (err) {
      console.warn('Exceção ao salvar transação financeira no Supabase:', err);
      return false;
    }
  },

  /**
   * Remove uma transação financeira online no Supabase.
   */
  async deleteTeamTransaction(txId: string, teamName?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      // 1. Tenta excluir na tabela dedicada
      const { error } = await supabase
        .from('team_financial_transactions')
        .delete()
        .eq('id', txId);

      if (!error) return true;

      // 2. Fallback automático no livro-caixa em pelada_sumulas
      const slug = (teamName || 'meu_time')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const ledgerId = `finance_ledger_${slug || 'meu_time'}`;

      const { data: existingRow } = await supabase
        .from('pelada_sumulas')
        .select('*')
        .eq('id', ledgerId)
        .maybeSingle();

      if (!existingRow) return true;

      const existingData = (existingRow.data as unknown as { transactions?: TeamTransaction[] }) || {};
      const existingList = Array.isArray(existingData.transactions) ? existingData.transactions : [];
      const remaining = existingList.filter((item) => item.id !== txId);

      const { error: upsertErr } = await supabase.from('pelada_sumulas').upsert(
        {
          id: ledgerId,
          team_name: teamName || existingRow.team_name || 'Meu Time',
          status: 'financial_ledger',
          data: { transactions: remaining } as unknown as Record<string, unknown>,
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      return !upsertErr;
    } catch (err) {
      console.warn('Exceção ao excluir transação financeira no Supabase:', err);
      return false;
    }
  },
};
