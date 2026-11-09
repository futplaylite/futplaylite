import React, { useEffect, useState } from 'react';
import {
  Download,
  Loader2,
  Share2,
  X,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Printer,
  Sparkles,
} from 'lucide-react';
import {
  generateSumulaReceiptImage,
  GeneratedSumulaReceipt,
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
  const [receiptData, setReceiptData] = useState<GeneratedSumulaReceipt | null>(null);
  const [exportType, setExportType] = useState<'image' | 'pdf'>('image');
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setReceiptData(null);
      setLoading(true);
      setShareSuccess(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setShareSuccess(null);

    generateSumulaReceiptImage(data)
      .then((generated) => {
        if (!isMounted) return;
        setReceiptData(generated);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erro ao gerar comprovante da súmula:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, data]);

  if (!isOpen) return null;

  const fileNameBase = `comprovante-sumula-${
    data.sumula.matchDate ? data.sumula.matchDate.replace(/\//g, '-') : 'oficial'
  }`;

  // Download da Imagem (PNG)
  const handleDownloadImage = () => {
    if (!receiptData?.dataUrl) return;
    const a = document.createElement('a');
    a.href = receiptData.dataUrl;
    a.download = `${fileNameBase}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShareSuccess('✓ Foto baixada com sucesso!');
    setTimeout(() => setShareSuccess(null), 3500);
  };

  // Download do Documento (PDF)
  const handleDownloadPdf = () => {
    if (!receiptData?.pdfUrl) return;
    const a = document.createElement('a');
    a.href = receiptData.pdfUrl;
    a.download = `${fileNameBase}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShareSuccess('✓ Documento PDF baixado com sucesso!');
    setTimeout(() => setShareSuccess(null), 3500);
  };

  // Compartilhamento Nativo da Imagem
  const handleShareImage = async () => {
    if (!receiptData?.file) return;

    if (navigator.canShare && navigator.canShare({ files: [receiptData.file] })) {
      try {
        await navigator.share({
          files: [receiptData.file],
          title: `Comprovante de Súmula - ${data.teamName || 'Pelada Oficial'}`,
          text: `Confira o Comprovante Oficial da Súmula da Pelada gravada no sistema! 🏆⚽🔥`,
        });
        setShareSuccess('✓ Comprovante compartilhado com sucesso!');
        setTimeout(() => setShareSuccess(null), 3500);
      } catch (e) {
        console.warn('Compartilhamento cancelado:', e);
      }
    } else {
      handleDownloadImage();
    }
  };

  // Compartilhamento Nativo do PDF
  const handleSharePdf = async () => {
    if (!receiptData?.pdfFile) return;

    if (navigator.canShare && navigator.canShare({ files: [receiptData.pdfFile] })) {
      try {
        await navigator.share({
          files: [receiptData.pdfFile],
          title: `Súmula Oficial em PDF - ${data.teamName || 'Pelada Oficial'}`,
          text: `Segue em anexo o Documento Oficial da Súmula da Rodada (PDF). 📄⚽`,
        });
        setShareSuccess('✓ PDF compartilhado com sucesso!');
        setTimeout(() => setShareSuccess(null), 3500);
      } catch (e) {
        console.warn('Compartilhamento de PDF cancelado:', e);
      }
    } else {
      handleDownloadPdf();
    }
  };

  // Imprimir diretamente (Folha A4)
  const handlePrint = () => {
    if (!receiptData?.dataUrl) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <html>
          <head>
            <title>Comprovante Oficial de Súmula</title>
            <style>
              @page { size: A4 portrait; margin: 0; }
              body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: white; }
              img { width: 100%; height: auto; max-height: 100vh; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${receiptData.dataUrl}" onload="window.print();" />
          </body>
        </html>
      `);
      doc.close();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 5000);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700/80 p-4 text-white shadow-2xl space-y-3 my-auto max-h-[94vh] flex flex-col">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide font-display text-white flex items-center gap-1.5">
                Comprovante da Súmula
              </h3>
              <p className="text-[10px] text-emerald-300">
                Modelo idêntico à prancheta física oficial
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Pergunta: Imagem ou PDF? (Seletor Interativo) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>Como deseja exportar o comprovante?</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            {/* Opção 1: Imagem PNG */}
            <button
              type="button"
              onClick={() => setExportType('image')}
              className={`p-2.5 rounded-2xl border text-left transition active:scale-95 flex flex-col gap-1 cursor-pointer ${
                exportType === 'image'
                  ? 'border-emerald-400 bg-emerald-950/60 text-white shadow-xs ring-2 ring-emerald-500/40'
                  : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-black text-xs">
                  <ImageIcon className="h-4 w-4 text-emerald-400" />
                  <span>Imagem (PNG)</span>
                </span>
                {exportType === 'image' && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                )}
              </div>
              <p className="text-[10px] text-slate-300 leading-tight">
                Ideal para WhatsApp e redes sociais
              </p>
            </button>

            {/* Opção 2: Documento PDF */}
            <button
              type="button"
              onClick={() => setExportType('pdf')}
              className={`p-2.5 rounded-2xl border text-left transition active:scale-95 flex flex-col gap-1 cursor-pointer ${
                exportType === 'pdf'
                  ? 'border-blue-400 bg-blue-950/60 text-white shadow-xs ring-2 ring-blue-500/40'
                  : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-black text-xs">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span>Documento (PDF)</span>
                </span>
                {exportType === 'pdf' && (
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                )}
              </div>
              <p className="text-[10px] text-slate-300 leading-tight">
                Padrão A4 para impressão e arquivo
              </p>
            </button>
          </div>
        </div>

        {/* Pré-visualização do Comprovante da Súmula */}
        <div className="flex-1 overflow-y-auto rounded-2xl bg-black/60 border border-white/10 p-2 flex items-center justify-center min-h-[260px] relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <span className="text-xs font-bold">
                Gerando Comprovante Idêntico à Súmula...
              </span>
            </div>
          ) : receiptData?.dataUrl ? (
            <div className="w-full flex flex-col items-center">
              <img
                src={receiptData.dataUrl}
                alt="Comprovante Oficial da Súmula"
                className="w-full h-auto max-h-[46vh] object-contain rounded-xl shadow-2xl border border-slate-700/60"
              />
              <span className="mt-1.5 text-[9px] font-mono text-slate-400">
                {exportType === 'image'
                  ? '🖼️ Formato Imagem HD (PNG 1200x1700)'
                  : '📄 Documento Oficial A4 (Pronto para impressão)'}
              </span>
            </div>
          ) : (
            <div className="text-xs text-red-400 py-8">
              Não foi possível gerar a pré-visualização.
            </div>
          )}
        </div>

        {/* Alerta de Feedback de Sucesso */}
        {shareSuccess && (
          <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 p-2 text-center text-xs font-bold text-emerald-300 animate-in fade-in">
            {shareSuccess}
          </div>
        )}

        {/* Botões de Ação para o Formato Selecionado */}
        {exportType === 'image' ? (
          /* Ações do Modo Imagem */
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={loading || !receiptData}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 py-2.5 px-3 text-xs font-bold text-white hover:bg-white/20 active:scale-95 transition disabled:opacity-50 cursor-pointer shadow-xs"
              title="Baixar imagem no seu aparelho"
            >
              <Download className="h-4 w-4 text-emerald-400" />
              <span>Baixar Imagem</span>
            </button>

            <button
              type="button"
              onClick={handleShareImage}
              disabled={loading || !receiptData}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 py-2.5 px-3 text-xs font-black text-slate-950 shadow-md active:scale-95 transition disabled:opacity-50 cursor-pointer"
              title="Compartilhar no WhatsApp ou redes sociais"
            >
              <Share2 className="h-4 w-4" />
              <span>Compartilhar</span>
            </button>
          </div>
        ) : (
          /* Ações do Modo PDF */
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={loading || !receiptData}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 px-3 text-xs font-black text-white shadow-md active:scale-95 transition disabled:opacity-50 cursor-pointer"
              title="Baixar arquivo PDF padrão A4"
            >
              <Download className="h-4 w-4" />
              <span>Baixar PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !receiptData}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-400/50 bg-blue-950/70 hover:bg-blue-900 py-2.5 px-3 text-xs font-bold text-blue-200 active:scale-95 transition disabled:opacity-50 cursor-pointer"
              title="Imprimir súmula em folha A4"
            >
              <Printer className="h-4 w-4 text-blue-300" />
              <span>Imprimir A4</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-white transition py-1 cursor-pointer"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
