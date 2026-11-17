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
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  useEffect(() => {
    let current = 12;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (isCloudSyncReady) {
          // Se os dados da nuvem já chegaram, completa rapidamente até 100%
          const next = Math.min(100, prev + 22);
          if (next >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setIsFadingOut(true);
              setTimeout(onFinish, 300);
            }, 250);
          }
          return next;
        }

        // Preenchimento suave e progressivo enquanto sincroniza
        if (prev < 40) {
          current = prev + 6;
        } else if (prev < 70) {
          current = prev + 3;
        } else if (prev < 90) {
          current = prev + 2;
        } else if (prev < 96) {
          current = prev + 1;
        } else {
          current = 96; // Aguarda a nuvem terminar
        }
        return current;
      });
    }, 110);

    return () => clearInterval(interval);
  }, [isCloudSyncReady, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex min-h-screen w-full flex-col items-center justify-center bg-[#050B18] text-white select-none transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Container proporcional de celular */}
      <div className="relative w-full max-w-[430px] h-full max-h-[920px] aspect-[9/16] sm:aspect-auto flex flex-col items-center justify-center overflow-hidden shadow-2xl bg-[#050B18]">
        {/* Nova Imagem Oficial com Estádio e "Carregando..." já integrados */}
        <img
          src="/images/splash-screen.jpg"
          alt="Futplay Lite Carregando"
          className="w-full h-full object-cover pointer-events-none"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />

        {/* Apenas a Barra de Carregamento Pequena e Elegante posicionada abaixo de "Carregando..." */}
        <div className="absolute top-[75.2%] left-1/2 -translate-x-1/2 w-[42%] max-w-[170px] z-20">
          <div className="relative w-full h-[7px] rounded-full p-[1px] bg-[#07132C]/80 border border-blue-400/40 shadow-[0_0_12px_rgba(37,99,235,0.35)] backdrop-blur-sm overflow-hidden">
            {/* Trilho interno escuro */}
            <div className="relative w-full h-full rounded-full bg-slate-950/90 overflow-hidden">
              {/* Barra de preenchimento Dourada animada */}
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.9)] transition-all duration-200 ease-out relative overflow-hidden"
                style={{ width: `${Math.min(100, Math.max(8, progress))}%` }}
              >
                {/* Brilho shimmer sutil correndo na barra */}
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
