import React, { useEffect, useState } from 'react';

interface CloudSyncSplashScreenProps {
  isCloudSyncReady: boolean;
  onFinish: () => void;
}

export const CloudSyncSplashScreen: React.FC<CloudSyncSplashScreenProps> = ({
  isCloudSyncReady,
  onFinish,
}) => {
  const [progress, setProgress] = useState<number>(12);
  const [statusText, setStatusText] = useState<string>('Iniciando sincronização...');
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  useEffect(() => {
    let current = 12;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (isCloudSyncReady) {
          // Se a nuvem já respondeu, acelera rapidamente para 100%
          const next = Math.min(100, prev + 18);
          if (next >= 100) {
            clearInterval(interval);
            setStatusText('Liga sincronizada com sucesso!');
            setTimeout(() => {
              setIsFadingOut(true);
              setTimeout(onFinish, 350);
            }, 300);
          }
          return next;
        }

        // Progresso visual gradual e orgânico enquanto a nuvem sincroniza
        if (prev < 35) {
          current = prev + 5;
          setStatusText('Conectando ao servidor da liga...');
        } else if (prev < 65) {
          current = prev + 3;
          setStatusText('Sincronizando elencos e times...');
        } else if (prev < 85) {
          current = prev + 2;
          setStatusText('Carregando partidas e classificações...');
        } else if (prev < 94) {
          current = prev + 1;
          setStatusText('Atualizando scouts e avaliações...');
        } else {
          current = 94; // Aguarda o ok definitivo da nuvem
          setStatusText('Finalizando sincronização...');
        }
        return current;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [isCloudSyncReady, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex min-h-screen w-full flex-col items-center justify-center bg-[#050B18] text-white select-none transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Container central nas proporções de smartphone */}
      <div className="relative w-full max-w-[430px] h-full max-h-[920px] aspect-[9/16] sm:aspect-auto flex flex-col items-center justify-center overflow-hidden shadow-2xl bg-[#050B18]">
        {/* Imagem Oficial de Fundo com Brasão e Estádio */}
        <img
          src="/images/splash-screen-clean.jpg"
          alt="Futplay Lite Carregando"
          className="w-full h-full object-cover pointer-events-none"
          onError={(e) => {
            // Fallback caso o navegador não carregue a imagem
            (e.target as HTMLElement).style.display = 'none';
          }}
        />

        {/* Barra de Carregamento Real Animada Posicionada Perfeitamente */}
        <div className="absolute top-[71%] left-1/2 -translate-x-1/2 w-[74%] max-w-[320px] flex flex-col items-center z-20">
          {/* Trilho Externo com Brilho Azul Esportivo */}
          <div className="relative w-full h-[22px] rounded-full p-[2.5px] bg-[#07132C]/90 border border-blue-400/60 shadow-[0_0_18px_rgba(37,99,235,0.45)] backdrop-blur-sm overflow-hidden">
            {/* Trilho Interno Escuro */}
            <div className="relative w-full h-full rounded-full bg-slate-950/80 overflow-hidden">
              {/* Barra de Preenchimento Dourada Reluzente Animada */}
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.95)] transition-all duration-300 ease-out relative overflow-hidden"
                style={{ width: `${Math.min(100, Math.max(6, progress))}%` }}
              >
                {/* Reflexo Shimmer que corre pela barra */}
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
              </div>
            </div>
          </div>

          {/* Porcentagem Dinâmica Real */}
          <div className="mt-2.5 flex items-center justify-center">
            <span className="font-sans text-[15px] font-black text-white tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Mensagem de Status em Tempo Real */}
          <p className="mt-1 text-[11px] font-bold text-blue-200/90 text-center tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] max-w-[280px]">
            {statusText}
          </p>
        </div>
      </div>
    </div>
  );
};
