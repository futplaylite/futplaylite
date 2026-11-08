import { supabase, isSupabaseConfigured } from './client';
import { MonthlyPaymentRecord, PeladaMonthlyConfig, PlayerProfile, Match } from '../../types/league';

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
        message: 'Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas.',
      };
    }
    try {
      const { error } = await supabase.from('cities').select('id').limit(1);
      if (error) {
        return { connected: false, message: `Erro ao conectar: ${error.message}` };
      }
      return { connected: true, message: 'Conexão com o Supabase estabelecida com sucesso!' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { connected: false, message: `Exceção de rede: ${message}` };
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
      currentDivisionId: p.current_division_id || 'div-bronze',
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
      console.error('Erro ao salvar configuração de mensalidade no Supabase:', error);
      return false;
    }
    return true;
  },
};
