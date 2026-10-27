import React, { useEffect, useState } from 'react';
import { Download, Loader2, Share2, Smartphone, X } from 'lucide-react';
import { CardImageData, generateCard9x16 } from '../lib/utils/generateCardImage';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardData: CardImageData;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  isOpen,
  onClose,
  cardData,
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

    generateCard9x16(cardData)
      .then(({ dataUrl, file }) => {
        if (!isMounted) return;
        setImageUrl(dataUrl);
        setImageFile(file);
        setLoading(false);

        // Se suportar compartilhamento nativo de arquivo diretamente no mobile, tenta compartilhar
        if (
          navigator.canShare &&
          navigator.canShare({ files: [file] }) &&
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        ) {
          navigator
            .share({
              files: [file],
              title: `Cartão Oficial - ${cardData.displayName}`,
              text: `Confira o Cartão Oficial de ${cardData.displayName} no FutPlay Lite! ⚽🔥`,
            })
            .then(() => setShareSuccess(true))
            .catch(() => {
              // Usuário cancelou ou fechou a folha de compartilhamento
            });
        }
      })
      .catch((err) => {
        console.error('Erro ao gerar imagem 9:16 do cartão:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, cardData]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    const sanitized = cardData.displayName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-');
    a.download = `cartao-${sanitized}-9x16.png`;
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
          title: `Cartão Oficial - ${cardData.displayName}`,
          text: `Confira o Cartão Oficial de ${cardData.displayName} no FutPlay Lite! ⚽🔥`,
        });
        setShareSuccess(true);
      } catch {
        // Usuário fechou ou cancelou
      }
    } else {
      // Fallback: download direto da imagem
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm animate-in fade-in">
      <div className="relative flex max-h-[96dvh] w-full max-w-[400px] flex-col rounded-3xl border border-white/20 bg-slate-900 p-4 text-white shadow-2xl">
        {/* Topo do Modal */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Cartão 9:16 (Status & Story)
              </h2>
              <span className="text-[11px] text-blue-200">
                Resolução 1080x1920 HD
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 p-1.5 text-slate-300 hover:bg-white/20 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo do Modal: Preview da Imagem 9:16 */}
        <div className="my-3 flex flex-1 items-center justify-center overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
              <span className="text-xs font-semibold text-slate-300">
                Gerando imagem em alta resolução (9:16)...
              </span>
            </div>
          ) : imageUrl ? (
            <div className="relative flex justify-center max-h-[58dvh]">
              <img
                src={imageUrl}
                alt="Cartão Oficial 9:16"
                className="max-h-[58dvh] w-auto rounded-2xl border border-white/20 object-contain shadow-2xl"
              />
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-red-400">
              Falha ao gerar a imagem. Tente novamente.
            </div>
          )}
        </div>

        {/* Rodapé com Botões de Ação */}
        {!loading && imageUrl && (
          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleNativeShare}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-2.5 px-3 text-xs font-black text-white shadow-md hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.99] transition"
              >
                <Share2 className="h-4 w-4" />
                <span>Compartilhar</span>
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 px-3 text-xs font-black text-white shadow-md active:scale-[0.99] transition"
              >
                <Download className="h-4 w-4" />
                <span>Salvar Imagem</span>
              </button>
            </div>

            <p className="text-center text-[10px] text-slate-400 leading-tight">
              Toque em <strong>Compartilhar</strong> para enviar direto ao WhatsApp ou <strong>Salvar Imagem</strong> para guardar na galeria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
