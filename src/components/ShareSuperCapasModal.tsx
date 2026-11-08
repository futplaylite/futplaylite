import React, { useEffect, useState } from 'react';
import { Download, Loader2, Share2, Sparkles, Trophy, X } from 'lucide-react';
import {
  generateSuperCapasImage,
  SuperCapasImageData,
} from '../lib/utils/generateSuperCapasImage';

interface ShareSuperCapasModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SuperCapasImageData;
}

export const ShareSuperCapasModal: React.FC<ShareSuperCapasModalProps> = ({
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

    generateSuperCapasImage(data)
      .then(({ dataUrl, file }) => {
        if (!isMounted) return;
        setImageUrl(dataUrl);
        setImageFile(file);
        setLoading(false);

        // Se suportar compartilhamento nativo de arquivo diretamente no mobile, tenta acionar
        if (
          navigator.canShare &&
          navigator.canShare({ files: [file] }) &&
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        ) {
          navigator
            .share({
              files: [file],
              title: `Super Capas da Semana - ${data.teamName}`,
              text: `Confira os Super Capas da Semana: Equipe ${data.teamName} campeã na Liga FutPlay! 🏆⚽🔥`,
            })
            .then(() => setShareSuccess(true))
            .catch(() => {
              // Usuário cancelou ou fechou a folha de compartilhamento nativa
            });
        }
      })
      .catch((err) => {
        console.error('Erro ao gerar imagem dos Super Capas:', err);
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
    const sanitized = data.teamName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-');
    a.download = `super-capas-${sanitized}-futplay.png`;
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
          title: `Super Capas da Semana - ${data.teamName}`,
          text: `Confira os Super Capas da Semana: Equipe ${data.teamName} campeã na Liga FutPlay! 🏆⚽🔥`,
        });
        setShareSuccess(true);
      } catch {
        // Usuário fechou ou cancelou
      }
    } else {
      // Fallback: download da foto
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative flex flex-col max-h-[90vh] w-full max-w-sm rounded-3xl border border-white/20 bg-slate-900 p-4 text-white shadow-2xl">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-blue-950 shadow-xs">
              <Trophy className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                <span>Foto Oficial dos Super Capas</span>
                <Sparkles className="h-3 w-3 text-amber-300" />
              </h3>
              <p className="text-[10px] text-blue-200">
                Pronta para WhatsApp, Instagram e Redes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Prévia da Imagem Gerada */}
        <div className="relative my-3 flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black/40 border border-white/10 min-h-[320px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
              <div>
                <p className="text-xs font-extrabold text-white">
                  Gerando Foto com Design Especial...
                </p>
                <p className="text-[10px] text-blue-200 mt-0.5">
                  Inserindo foto, nomes dos atletas vencedores e estatísticas
                </p>
              </div>
            </div>
          ) : imageUrl ? (
            <div className="relative max-h-[50vh] overflow-y-auto p-1">
              <img
                src={imageUrl}
                alt="Foto Super Capas da Semana"
                className="w-full rounded-xl object-contain shadow-lg"
              />
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-red-300">
              Não foi possível gerar a imagem dos Super Capas.
            </div>
          )}
        </div>

        {/* Feedback de Sucesso */}
        {shareSuccess && (
          <div className="mb-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 px-3 py-1.5 text-center text-[11px] font-bold text-emerald-200">
            ✓ Foto compartilhada com sucesso!
          </div>
        )}

        {/* Ações Inferiores */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleNativeShare}
            disabled={loading || !imageUrl}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 py-2.5 px-3 text-xs font-black text-blue-950 transition active:scale-[0.98] shadow-md shadow-amber-950/40"
          >
            <Share2 className="h-4 w-4" />
            <span>Compartilhar Foto</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || !imageUrl}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 disabled:opacity-50 py-2.5 px-3 text-xs font-bold text-white transition active:scale-[0.98]"
            title="Baixar imagem em PNG"
          >
            <Download className="h-4 w-4" />
            <span>Baixar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
