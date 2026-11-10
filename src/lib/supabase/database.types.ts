export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: 'player' | 'moderator' | 'admin';
          status: 'ativa' | 'suspensa' | 'encerrada';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          role?: 'player' | 'moderator' | 'admin';
          status?: 'ativa' | 'suspensa' | 'encerrada';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: 'player' | 'moderator' | 'admin';
          status?: 'ativa' | 'suspensa' | 'encerrada';
          updated_at?: string;
        };
      };
      cities: {
        Row: {
          id: string;
          name: string;
          state_code: string;
          region_name: string;
          country_code: string;
          slug: string;
          status: 'em_preparacao' | 'ativa' | 'desativada';
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          state_code: string;
          region_name?: string;
          country_code?: string;
          slug: string;
          status?: 'em_preparacao' | 'ativa' | 'desativada';
          created_at?: string;
        };
        Update: {
          name?: string;
          state_code?: string;
          region_name?: string;
          slug?: string;
          status?: 'em_preparacao' | 'ativa' | 'desativada';
        };
      };
      divisions: {
        Row: {
          id: string;
          name: 'Bronze' | 'Prata' | 'Ouro' | 'Platina' | 'Diamante';
          tier: number;
          min_rating: number;
          max_rating: number | null;
          min_matches_required: number;
          city_id: string | null;
          ruleset_version: string;
        };
        Insert: {
          id?: string;
          name: 'Bronze' | 'Prata' | 'Ouro' | 'Platina' | 'Diamante';
          tier: number;
          min_rating: number;
          max_rating?: number | null;
          min_matches_required?: number;
          city_id?: string | null;
          ruleset_version?: string;
        };
      };
      player_profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          avatar_path: string | null;
          city_id: string;
          position: 'goleiro' | 'defensor' | 'meio-campista' | 'atacante' | 'multiplas';
          dominant_foot: 'direito' | 'esquerdo' | 'ambos';
          profile_visibility: 'publico' | 'restrito' | 'privado';
          current_rating: number;
          rating_uncertainty: number;
          is_provisional: boolean;
          current_division_id: string | null;
          total_validated_matches: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name: string;
          avatar_path?: string | null;
          city_id: string;
          position: 'goleiro' | 'defensor' | 'meio-campista' | 'atacante' | 'multiplas';
          dominant_foot?: 'direito' | 'esquerdo' | 'ambos';
          profile_visibility?: 'publico' | 'restrito' | 'privado';
          current_rating?: number;
          rating_uncertainty?: number;
          is_provisional?: boolean;
          current_division_id?: string | null;
          total_validated_matches?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          avatar_path?: string | null;
          position?: 'goleiro' | 'defensor' | 'meio-campista' | 'atacante' | 'multiplas';
          dominant_foot?: 'direito' | 'esquerdo' | 'ambos';
          profile_visibility?: 'publico' | 'restrito' | 'privado';
          current_rating?: number;
          rating_uncertainty?: number;
          is_provisional?: boolean;
          current_division_id?: string | null;
          total_validated_matches?: number;
          updated_at?: string;
        };
      };
      matches: {
        Row: {
          id: string;
          city_id: string;
          season_id: string;
          created_by: string;
          scheduled_at: string;
          started_at: string | null;
          ended_at: string | null;
          lineup_frozen_at: string | null;
          venue_name: string;
          format: string;
          home_team_name: string;
          away_team_name: string;
          home_captain_id: string | null;
          away_captain_id: string | null;
          status: string;
          official_home_score: number | null;
          official_away_score: number | null;
          active_result_version_id: string | null;
          ruleset_version: string;
          fraud_hold: boolean;
          fraud_flags: Json;
          created_at: string;
          updated_at: string;
        };
      };
      pelada_monthly_configs: {
        Row: {
          id: string;
          city_id: string | null;
          monthly_amount: number;
          due_day: number;
          pix_key: string;
          pix_key_type: string;
          pix_receiver_name: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          city_id?: string | null;
          monthly_amount?: number;
          due_day?: number;
          pix_key?: string;
          pix_key_type?: string;
          pix_receiver_name?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          monthly_amount?: number;
          due_day?: number;
          pix_key?: string;
          pix_key_type?: string;
          pix_receiver_name?: string;
          updated_by?: string | null;
          updated_at?: string;
        };
      };
      monthly_payments: {
        Row: {
          id: string;
          player_id: string;
          year_month: string;
          is_paid: boolean;
          paid_at: string | null;
          amount: number;
          confirmed_by: string | null;
          receipt_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          player_id: string;
          year_month: string;
          is_paid?: boolean;
          paid_at?: string | null;
          amount?: number;
          confirmed_by?: string | null;
          receipt_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          is_paid?: boolean;
          paid_at?: string | null;
          amount?: number;
          confirmed_by?: string | null;
          receipt_url?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      pelada_sumulas: {
        Row: {
          id: string;
          team_name: string;
          status: string;
          match_date: string | null;
          start_time: string | null;
          created_by_user_id: string | null;
          created_by_name: string | null;
          data: Json;
          last_updated: string;
          created_at: string;
        };
        Insert: {
          id: string;
          team_name?: string;
          status?: string;
          match_date?: string | null;
          start_time?: string | null;
          created_by_user_id?: string | null;
          created_by_name?: string | null;
          data?: Json;
          last_updated?: string;
          created_at?: string;
        };
        Update: {
          team_name?: string;
          status?: string;
          match_date?: string | null;
          start_time?: string | null;
          created_by_user_id?: string | null;
          created_by_name?: string | null;
          data?: Json;
          last_updated?: string;
        };
      };
    };
  };
}
