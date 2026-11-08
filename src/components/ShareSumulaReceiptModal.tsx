import React, { useEffect, useState } from 'react';
import { Download, Loader2, Share2, Sparkles, Trophy, X, CheckCircle2, MessageCircle } from 'lucide-react';
import {
  generateSumulaReceiptImage,
  SumulaReceiptImageData,
} from '../lib/utils/generateSumulaReceiptImage';

interface ShareSumulaReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SumulaReceiptImageData;
}

export const ShareSumulaReceiptModal: React.FC<ShareSumulaReceiptModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [shareSuccess, setShareSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setImageUrl('');
      setImageFile(null);
      setLoading(true);
      return;
    }

    let isMounted = true;
    setLoading(true);

    generateSumulaReceiptImage(data)
      .then(({ dataUrl, file }) => {
        if (!isMounted) return;
        setImageUrl(dataUrl);
        setImageFile(file);
        setLoading(false);

        // Se suportar compartilhamento nativo de arquivo diretamente no mobile
        if (
          navigator.canShare &&
          navigator.canShare({ files: [file] }) &&
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        ) {
          navigator
            .share({
              files: [file],
              title: `Comprovante de Súmula - ${data.teamName || 'Pelada Oficial'}`,
              text: `Comprovante da Súmula gravada com sucesso! Confira o resultado dos jogos e artilharia da rodada. ⚽🔥`,
            })
            .then(() => setShareSuccess(true))
            .catch(() => {
              // Usuário fechou ou cancelou
            });
        }
      })
      .catch((err) => {
        console.error('Erro ao gerar imagem de comprovante da súmula:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, data]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `comprovante-sumula-${data.sumula.matchDate || 'oficial'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleNativeShare = async () => {
    if (!imageFile) return;

    if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      try {
        await navigator.share({
          files: [imageFile],
          title: `Comprovante de Súmula - ${data.teamName || 'Pelada Oficial'}`,
          text: `Confira o Comprovante Oficial da Súmula da Pelada gravada no sistema! 🏆⚽🔥`,
        });
        setShareSuccess(true);
      } catch (e) {
        console.warn('Compartilhamento cancelado:', e);
      }
    } else {
      // Fallback: download da imagem
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-emerald-500/30 p-4 text-white shadow-2xl space-y-3.5 my-auto max-h-[92vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide font-display text-white">
                Comprovante da Súmula
              </h3>
              <p className="text-[10px] text-emerald-300">
                Súmula gravada com sucesso!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Pré-visualização da Imagem */}
        <div className="flex-1 overflow-y-auto rounded-2xl bg-black/50 border border-white/10 p-2 flex items-center justify-center min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <span className="text-xs font-bold">
                Gerando Comprovante Oficial...
              </span>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="Comprovante de Súmula Oficial"
              className="w-full h-auto max-h-[50vh] object-contain rounded-xl shadow-lg border border-white/10"
            />
          ) : (
            <div className="text-xs text-red-400 py-8">
              Não foi possível gerar a imagem do comprovante.
            </div>
          )}
        </div>

        {shareSuccess && (
          <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 p-2 text-center text-xs font-bold text-emerald-300 animate-in fade-in">
            Comprovante compartilhado com sucesso!
          </div>
        )}

        {/* Botões de Ação */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleDownload}
            disabled={loading || !imageUrl}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 py-2.5 px-3 text-xs font-bold text-white hover:bg-white/20 active:scale-95 transition disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Baixar Foto</span>
          </button>

          <button
            onClick={handleNativeShare}
            disabled={loading || !imageUrl}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 py-2.5 px-3 text-xs font-black text-slate-950 shadow-md active:scale-95 transition disabled:opacity-50 cursor-pointer"
          >
            <Share2 className="h-4 w-4" />
            <span>Compartilhar</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-white transition py-1"
        >
          Concluir e Voltar
        </button>
      </div>
    </div>
  );
};
