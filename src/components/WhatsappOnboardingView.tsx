import React, { useState } from 'react';
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  MessageCircle,
  Phone,
  ShieldCheck,
  Swords,
  Trophy,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { RosaliaCrest } from './RosaliaCrest';

interface WhatsappOnboardingViewProps {
  onComplete: () => void;
}

export function formatBrazilPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const WhatsappOnboardingView: React.FC<WhatsappOnboardingViewProps> = ({
  onComplete,
}) => {
  const { currentUser, currentPlayerProfile, saveUserWhatsapp } = useLeague();
  const [phone, setPhone] = useState<string>('');
  const [error, setError] = useState<string>('');

  const athleteName =
    currentPlayerProfile?.displayName ||
    currentUser.email.split('@')[0] ||
    'Atleta';

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setPhone(formatBrazilPhone(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Informe seu número completo com DDD · Ex.: (77) 99999-9999');
      return;
    }

    const ok = saveUserWhatsapp(phone);
    if (ok) {
      onComplete();
    }
  };

  return (
    <div className="min-h-dvh w-full bg-slate-50 text-slate-900 flex flex-col justify-between">
      <div className="mx-auto w-full max-w-[430px] px-4 py-6 space-y-4">
        {/* Card de Boas-Vindas Azul & Branco */}
        <div className="rounded-3xl bg-gradient-to-br from-blue-700 to-blue-900 p-6 text-white shadow-md text-center space-y-3">
          <div className="mx-auto flex items-center justify-center">
            <RosaliaCrest size={70} wide transparentBg />
          </div>

          <div>
            <span className="inline-block rounded-full bg-white/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-100">
              Primeiro Acesso · Planalto - BA
            </span>
            <h1 className="mt-2 font-display text-2xl font-extrabold tracking-wide text-white uppercase">
              BEM-VINDO, {athleteName.toUpperCase()}!
            </h1>
            <p className="text-xs text-blue-100/90 mt-1 leading-relaxed">
              Sua conta no <strong>FutPlay Lite</strong> está pronta. Antes de
              entrar em campo, cadastre seu WhatsApp para receber os avisos da
              Liga.
            </p>
          </div>
        </div>

        {/* Card Principal: Cadastro Único de WhatsApp */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 text-blue-600">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Notificações via WhatsApp
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                O WhatsApp será o meio oficial para você receber todas as
                notificações importantes do aplicativo.
              </p>
            </div>
          </div>

          {/* Lista Organizada do que o Atleta Receberá */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <Swords className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                <strong>Partidas e Escalações:</strong> aviso quando você for
                escalado em um jogo em Planalto - BA.
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                <strong>Validação de Placar:</strong> link rápido para confirmar
                resultados, gols, assistências e MVP.
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <Trophy className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                <strong>Evolução no Ranking:</strong> atualizações dos seus
                Pontos da Temporada e estatísticas.
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Campo do Número de WhatsApp */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Seu Número de WhatsApp (com DDD)
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
              <input
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(77) 99999-9999"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 font-mono text-sm font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
            <span className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
              <BellRing className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              Solicitado apenas neste primeiro acesso.
            </span>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition"
          >
            <span>Salvar WhatsApp e Entrar no App</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Rodapé de Privacidade */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pb-4 text-center">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span>
            Seu número é privado e usado exclusivamente para avisos do FutPlay
            Lite
          </span>
        </div>
      </div>
    </div>
  );
};
