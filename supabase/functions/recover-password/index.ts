import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Trata preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Edge Function Error: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor indisponível.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Instancia cliente administrativo seguro (Service Role NUNCA vaza para o cliente)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await req.json();
    const { phone, birthDate, newPassword, confirmPassword } = body;

    // 1. Validações básicas de entrada
    if (!phone || !birthDate || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'DADOS_INVALIDOS: Telefone, data de nascimento e nova senha são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return new Response(
        JSON.stringify({ error: 'VALIDACAO_FALHOU: A confirmação da senha não confere com a nova senha digitada.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (newPassword.trim().length < 6) {
      return new Response(
        JSON.stringify({ error: 'VALIDACAO_FALHOU: A nova senha deve ter no mínimo 6 caracteres.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      return new Response(
        JSON.stringify({ error: 'DADOS_INVALIDOS: Telefone inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Identifica IP / Fingerprint de origem para rate limiting
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('cf-connecting-ip') ||
      'client-ip';

    // 2. Chama a RPC pública ou privada de recuperação protegida
    // A RPC valida se os dados conferem no cofre privado, aplica rate limit e revoga sessões anteriores
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      'recover_account_password_with_birthdate',
      {
        p_phone: cleanPhone,
        p_birth_date: birthDate,
        p_new_password: newPassword.trim(),
        p_client_fingerprint: clientIp,
      }
    );

    if (rpcError) {
      console.warn('Falha na recuperação de senha:', rpcError.message);
      const isRateLimit = rpcError.message.includes('BLOQUEIO_TEMPORARIO');
      const status = isRateLimit ? 429 : 400;
      return new Response(
        JSON.stringify({
          error: isRateLimit
            ? 'BLOQUEIO_TEMPORARIO: Número excessivo de tentativas. Tente novamente em alguns minutos.'
            : 'DADOS_INVALIDOS: Telefone ou data de nascimento incorretos.',
        }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (result && result.success === false) {
      const isRateLimit = (result.error || '').includes('BLOQUEIO_TEMPORARIO');
      const status = isRateLimit ? 429 : 400;
      return new Response(
        JSON.stringify({ error: result.error }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Senha redefinida com sucesso! Você já pode fazer login com sua nova senha.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Erro inesperado na Edge Function:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar a solicitação.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
