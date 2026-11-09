import { supabase, isSupabaseConfigured } from './client';
import {
  MonthlyPaymentRecord,
  PeladaMonthlyConfig,
  PlayerProfile,
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
          .eq('email', trimmed)
          .limit(1)
          .maybeSingle();
        data = res.data;
      } else {
        // Tenta buscar por whatsapp_number ou email com dígitos
        const res = await supabase
          .from('users')
          .select('*')
          .or(
            `whatsapp_number.ilike.%${digits}%,email.ilike.${digits}%`
          )
          .limit(1)
          .maybeSingle();

        if (res.error && res.error.message?.includes('does not exist')) {
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
      }

      if (!data) return null;

      const user: User = {
        id: data.id,
        email: data.email,
        whatsappNumber: data.whatsapp_number || undefined,
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
      if (pData) {
        profile = {
          id: pData.id,
          userId: pData.user_id,
          displayName: pData.display_name,
          avatarUrl: pData.avatar_path || undefined,
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
          lookup = lookup.or(`email.eq.${userEmail},whatsapp_number.ilike.%${cleanDigits}%`);
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
      const { error: fullErr } = await supabase.from('users').upsert({
        id: finalUserId,
        email: userEmail,
        whatsapp_number: params.user.whatsappNumber || null,
        password_hash: params.password || null,
        role: params.user.role || 'player',
        status: params.user.status || 'ativa',
        updated_at: new Date().toISOString(),
      });

      if (fullErr) {
        if (fullErr.message?.includes('does not exist')) {
          const { error: baseErr } = await supabase.from('users').upsert({
            id: finalUserId,
            email: userEmail,
            role: params.user.role || 'player',
            status: params.user.status || 'ativa',
            updated_at: new Date().toISOString(),
          });
          uErr = baseErr;
        } else {
          uErr = fullErr;
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
      const { error: pErr } = await supabase.from('player_profiles').upsert({
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
      });

      if (pErr) {
        console.error('Erro ao cadastrar perfil no Supabase:', pErr);
        return { success: false, error: pErr.message };
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
  async deleteUser(userId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      await supabase.from('player_profiles').delete().eq('user_id', userId);
      await supabase.from('users').delete().eq('id', userId);
      return true;
    } catch (err) {
      console.error('Erro ao excluir usuário no Supabase:', err);
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

    return data.map((p) => ({
      id: p.id,
      userId: p.user_id,
      displayName: p.display_name,
      avatarUrl: p.avatar_path || undefined,
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
   * Busca os registros mensais de mensalidades
   */
  async getMonthlyPayments(): Promise<MonthlyPaymentRecord[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    const { data, error } = await supabase
      .from('monthly_payments')
      .select('*');

    if (error || !data) {
      console.warn('Erro ao buscar mensalidades do Supabase:', error);
      return null;
    }

    return data.map((item) => ({
      id: item.id,
      playerId: item.player_id,
      yearMonth: item.year_month.trim(),
      isPaid: item.is_paid,
      paidAt: item.paid_at || undefined,
      amount: Number(item.amount),
      confirmedBy: item.confirmed_by || undefined,
    }));
  },

  /**
   * Salva ou atualiza o status de mensalidade de um atleta
   */
  async upsertMonthlyPayment(record: MonthlyPaymentRecord): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    const { error } = await supabase.from('monthly_payments').upsert({
      id: record.id,
      player_id: record.playerId,
      year_month: record.yearMonth,
      is_paid: record.isPaid,
      paid_at: record.paidAt || null,
      amount: record.amount || 30.0,
      confirmed_by: record.confirmedBy || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Erro ao sincronizar mensalidade com Supabase:', error);
      return false;
    }
    return true;
  },

  /**
   * Busca as configurações da pelada (valor e chave PIX)
   */
  async getMonthlyConfig(): Promise<PeladaMonthlyConfig | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    const { data, error } = await supabase
      .from('pelada_monthly_configs')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      monthlyAmount: Number(data.monthly_amount),
      dueDay: data.due_day,
      pixKey: data.pix_key,
      pixKeyType: data.pix_key_type,
      pixReceiverName: data.pix_receiver_name,
    };
  },

  /**
   * Salva a configuração financeira da pelada (PIX e valor mensal)
   */
  async saveMonthlyConfig(config: PeladaMonthlyConfig): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    const { error } = await supabase.from('pelada_monthly_configs').upsert({
      monthly_amount: config.monthlyAmount,
      due_day: config.dueDay,
      pix_key: config.pixKey,
      pix_key_type: config.pixKeyType.toLowerCase(),
      pix_receiver_name: config.pixReceiverName,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error(
        'Erro ao salvar configuração de mensalidade no Supabase:',
        error
      );
      return false;
    }
    return true;
  },
};
