import { SumulaData } from '../../components/SumulaPeladaView';

export interface SumulaReceiptImageData {
  sumula: SumulaData;
  teamName?: string;
  venueName?: string;
}

export interface GeneratedSumulaReceipt {
  dataUrl: string; // PNG Data URL
  file: File; // PNG File object
  pdfBlob: Blob; // PDF Blob object
  pdfUrl: string; // PDF Object URL
  pdfFile: File; // PDF File object
}

// Construtor binário nativo de PDF 1.4 A4 para embutir o Canvas renderizado
export function createPdfBlobFromJpeg(
  jpegBuffer: Uint8Array,
  width: number,
  height: number
): Blob {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const imgAspect = width / height;
  const pageAspect = maxWidth / maxHeight;
  let renderWidth = maxWidth;
  let renderHeight = maxWidth / imgAspect;
  if (renderHeight > maxHeight) {
    renderHeight = maxHeight;
    renderWidth = maxHeight * imgAspect;
  }
  const xOffset = margin + (maxWidth - renderWidth) / 2;
  const yOffset = margin + (maxHeight - renderHeight) / 2;

  const chunks: (Uint8Array | string)[] = [];
  const offsets: number[] = [];

  let totalLen = 0;
  function add(strOrBuf: string | Uint8Array) {
    if (typeof strOrBuf === 'string') {
      const enc = new TextEncoder().encode(strOrBuf);
      chunks.push(enc);
      totalLen += enc.length;
    } else {
      chunks.push(strOrBuf);
      totalLen += strOrBuf.length;
    }
  }

  add('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  offsets.push(totalLen);
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets.push(totalLen);
  add('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  offsets.push(totalLen);
  add(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Im1 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n`
  );

  offsets.push(totalLen);
  add(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuffer.length} >>\nstream\n`
  );
  add(jpegBuffer);
  add('\nendstream\nendobj\n');

  offsets.push(totalLen);
  const streamContent = `q\n${renderWidth.toFixed(2)} 0 0 ${renderHeight.toFixed(2)} ${xOffset.toFixed(2)} ${yOffset.toFixed(2)} cm\n/Im1 Do\nQ\n`;
  const streamLen = new TextEncoder().encode(streamContent).length;
  add(`5 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}endstream\nendobj\n`);

  const startXref = totalLen;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  add(xref);

  return new Blob(chunks, { type: 'application/pdf' });
}

export async function generateSumulaReceiptImage(
  data: SumulaReceiptImageData
): Promise<GeneratedSumulaReceipt> {
  const { sumula, teamName = sumula.teamName || 'Pelada Oficial', venueName = 'Arena Society' } = data;

  // Dimensões A4 em alta definição proporcionais ao conteúdo (1200 x 1540)
  const width = 1200;
  const height = 1540;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível obter o contexto 2D do Canvas');
  }

  // 1. Fundo da Prancheta Física
  ctx.fillStyle = '#0f172a'; // Fundo externo escuro moderno
  ctx.fillRect(0, 0, width, height);

  // Folha da Prancheta (Margem interna elegante)
  const padX = 24;
  const padY = 24;
  const sheetW = width - padX * 2;
  const sheetH = height - padY * 2;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, padX, padY, sheetW, sheetH, 16);
  ctx.fill();

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  roundRect(ctx, padX, padY, sheetW, sheetH, 16);
  ctx.stroke();

  // 2. CABEÇALHO DA SÚMULA (Slate-900 com identidade oficial)
  const headH = 145;
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, padX, padY, sheetW, headH, 16);
  ctx.clip();

  ctx.fillStyle = '#090d16';
  ctx.fillRect(padX, padY, sheetW, headH);

  // Gradiente sutil no cabeçalho
  const headGrad = ctx.createLinearGradient(padX, padY, padX + sheetW, padY + headH);
  headGrad.addColorStop(0, 'rgba(30, 58, 138, 0.35)');
  headGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = headGrad;
  ctx.fillRect(padX, padY, sheetW, headH);
  ctx.restore();

  // Borda inferior do cabeçalho
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, padY + headH);
  ctx.lineTo(padX + sheetW, padY + headH);
  ctx.stroke();

  // Linha 1 do Cabeçalho: Título Oficial & Status
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⚽ ROSÁLIA ESPORTES · SÚMULA OFICIAL DE TREINO / PELADA', padX + 24, padY + 38);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(truncateCanvasText(ctx, teamName.toUpperCase(), sheetW - 300), padX + 24, padY + 70);

  // Badge de Status à Direita
  const isFinalized = sumula.status === 'finalizada';
  const badgeW = isFinalized ? 240 : 180;
  const badgeX = padX + sheetW - badgeW - 24;
  const badgeY = padY + 28;

  ctx.fillStyle = isFinalized ? '#064e3b' : '#1e3a8a';
  roundRect(ctx, badgeX, badgeY, badgeW, 34, 17);
  ctx.fill();
  ctx.strokeStyle = isFinalized ? '#10b981' : '#60a5fa';
  ctx.lineWidth = 1.5;
  roundRect(ctx, badgeX, badgeY, badgeW, 34, 17);
  ctx.stroke();

  ctx.fillStyle = isFinalized ? '#a7f3d0' : '#dbeafe';
  ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    isFinalized ? '🔒 FINALIZADA & HOMOLOGADA' : '● SÚMULA ATIVA',
    badgeX + badgeW / 2,
    badgeY + 22
  );

  // Linha 2 do Cabeçalho: Caixas de Data, Horário e Local
  const boxY = padY + 90;
  const boxH = 38;
  const box1W = 220;
  const box2W = 180;
  const box3W = sheetW - box1W - box2W - 48 - 20;

  // Caixa 1: Data
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, padX + 24, boxY, box1W, boxH, 8);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  roundRect(ctx, padX + 24, boxY, box1W, boxH, 8);
  ctx.stroke();
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('📅 DATA:', padX + 36, boxY + 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 14px "Courier New", monospace';
  ctx.fillText(sumula.matchDate || 'Hoje', padX + 100, boxY + 24);

  // Caixa 2: Horário de Início
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, padX + 24 + box1W + 10, boxY, box2W, boxH, 8);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  roundRect(ctx, padX + 24 + box1W + 10, boxY, box2W, boxH, 8);
  ctx.stroke();
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('⏰ INÍCIO:', padX + 24 + box1W + 22, boxY + 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 14px "Courier New", monospace';
  ctx.fillText(sumula.startTime || '19:30', padX + 24 + box1W + 95, boxY + 24);

  // Caixa 3: Local
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, padX + 24 + box1W + box2W + 20, boxY, box3W, boxH, 8);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  roundRect(ctx, padX + 24 + box1W + box2W + 20, boxY, box3W, boxH, 8);
  ctx.stroke();
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('📍 LOCAL:', padX + 24 + box1W + box2W + 32, boxY + 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(truncateCanvasText(ctx, venueName, box3W - 116), padX + 24 + box1W + box2W + 100, boxY + 24);

  // 3. SEÇÃO 1: LISTA DE PRESENÇA & GOLEIROS FIXOS
  let curY = padY + headH + 16;
  const sec1H = 210;

  // Card Esquerdo: Lista de Presença
  const presW = 720;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, padX + 24, curY, presW, sec1H, 12);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  roundRect(ctx, padX + 24, curY, presW, sec1H, 12);
  ctx.stroke();

  // Cabeçalho da Lista de Presença
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, padX + 25, curY + 1, presW - 2, 34, 11);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(padX + 24, curY + 35);
  ctx.lineTo(padX + 24 + presW, curY + 35);
  ctx.stroke();

  const arrivals = sumula.arrivalList || [];
  const confirmedCount = arrivals.filter((a) => a.confirmed).length;

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`📋 LISTA DE PRESENÇA DOS ATLETAS`, padX + 38, curY + 23);

  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${confirmedCount} de ${arrivals.length} Confirmados`, padX + presW + 10, curY + 23);

  // Grid de Atletas Confirmados (3 Colunas x até 6 linhas = até 18 atletas)
  const confirmedAthletes = arrivals.filter((a) => a.confirmed).slice(0, 18);
  const colW = (presW - 44) / 3;
  let pIdx = 0;
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 6; r++) {
      if (pIdx >= confirmedAthletes.length) break;
      const athlete = confirmedAthletes[pIdx];
      const aX = padX + 36 + c * colW;
      const aY = curY + 44 + r * 26;

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('✓', aX, aY + 14);

      const gkReserve = athlete.isGoalkeeper ? 50 : 12;
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(
        truncateCanvasText(ctx, athlete.playerName, colW - 16 - gkReserve),
        aX + 14,
        aY + 14
      );

      if (athlete.isGoalkeeper) {
        ctx.fillStyle = '#2563eb';
        ctx.font = '900 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('🧤 GK', aX + colW - 10, aY + 14);
      }

      pIdx++;
    }
  }

  // Card Direito: Goleiros Fixos
  const gkX = padX + 24 + presW + 14;
  const gkW = sheetW - presW - 62;

  ctx.fillStyle = '#f0fdf4';
  roundRect(ctx, gkX, curY, gkW, sec1H, 12);
  ctx.fill();
  ctx.strokeStyle = '#bbf7d0';
  ctx.lineWidth = 1.5;
  roundRect(ctx, gkX, curY, gkW, sec1H, 12);
  ctx.stroke();

  // Cabeçalho Goleiros Fixos
  ctx.fillStyle = '#166534';
  ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🧤 GOLEIROS FIXOS', gkX + 16, curY + 24);

  const goalkeepers = (sumula.goalkeepers || []).slice(0, 4);
  goalkeepers.forEach((gk, i) => {
    const boxGkY = curY + 40 + i * 39;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, gkX + 14, boxGkY, gkW - 28, 32, 8);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    roundRect(ctx, gkX + 14, boxGkY, gkW - 28, 32, 8);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#2563eb';
    ctx.font = '900 12px "Courier New", monospace';
    ctx.fillText(gk.num || `G${i + 1}`, gkX + 24, boxGkY + 20);

    const hasName = Boolean(gk.name?.trim());
    ctx.fillStyle = hasName ? '#0f172a' : '#94a3b8';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const gkText = hasName ? gk.name.toUpperCase() : 'Não escalado';
    ctx.fillText(truncateCanvasText(ctx, gkText, gkW - 92), gkX + 52, boxGkY + 20);

    if (hasName) {
      ctx.fillStyle = '#10b981';
      ctx.font = '900 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('✓', gkX + gkW - 22, boxGkY + 20);
    }
  });

  // 4. SEÇÃO 2: GRADE DE PONTOS E PARTIDAS DOS TIMES (J1 A J15)
  curY += sec1H + 16;
  const gridH = 260;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, padX + 24, curY, sheetW - 48, gridH, 12);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  roundRect(ctx, padX + 24, curY, sheetW - 48, gridH, 12);
  ctx.stroke();

  // Cabeçalho da Grade
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, padX + 25, curY + 1, sheetW - 50, 36, 11);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(padX + 24, curY + 37);
  ctx.lineTo(padX + sheetW - 24, curY + 37);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⚽ PONTOS E PARTIDAS DOS TIMES (JOGOS J1 A J15)', padX + 38, curY + 24);

  // Tabela da Grade (132 + 15*52 + 3*48 = 1056 <= 1080 de largura interna)
  const tableX = padX + 36;
  const tableY = curY + 48;
  const tableW = sheetW - 72;
  const teamColW = 132;
  const matchColW = 52;
  const statColW = 48;

  // Linha do Cabeçalho da Tabela
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, tableX, tableY, tableW, 30, 6);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TIME', tableX + 12, tableY + 20);

  ctx.textAlign = 'center';
  for (let j = 0; j < 15; j++) {
    ctx.fillText(`J${j + 1}`, tableX + teamColW + j * matchColW + matchColW / 2, tableY + 20);
  }

  ctx.fillStyle = '#34d399';
  ctx.fillText('V', tableX + teamColW + 15 * matchColW + statColW / 2, tableY + 20);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('E', tableX + teamColW + 15 * matchColW + statColW + statColW / 2, tableY + 20);
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('PTS', tableX + teamColW + 15 * matchColW + statColW * 2 + statColW / 2, tableY + 20);

  // 4 Linhas dos Times
  const teamsGrid = (sumula.teamsGrid || []).slice(0, 4);
  teamsGrid.forEach((row, tIdx) => {
    const rowY = tableY + 36 + tIdx * 42;

    ctx.fillStyle = tIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
    roundRect(ctx, tableX, rowY, tableW, 38, 6);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    roundRect(ctx, tableX, rowY, tableW, 38, 6);
    ctx.stroke();

    // Nome do Time
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(truncateCanvasText(ctx, row.teamName, teamColW - 18), tableX + 12, rowY + 24);

    let vCount = 0;
    let eCount = 0;

    // 15 Partidas
    for (let mIdx = 0; mIdx < 15; mIdx++) {
      const res = row.matches?.[mIdx] || '-';
      const cellX = tableX + teamColW + mIdx * matchColW + 6;
      const cellY = rowY + 5;
      const cellW = matchColW - 12;
      const cellH = 28;

      if (res === 'V') {
        vCount++;
        ctx.fillStyle = '#059669';
        roundRect(ctx, cellX, cellY, cellW, cellH, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('V', cellX + cellW / 2, cellY + 19);
      } else if (res === 'E') {
        eCount++;
        ctx.fillStyle = '#f59e0b';
        roundRect(ctx, cellX, cellY, cellW, cellH, 6);
        ctx.fill();
        ctx.fillStyle = '#78350f';
        ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('E', cellX + cellW / 2, cellY + 19);
      } else {
        ctx.fillStyle = '#f1f5f9';
        roundRect(ctx, cellX, cellY, cellW, cellH, 6);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('-', cellX + cellW / 2, cellY + 19);
      }
    }

    // Totais: V, E, PTS
    const pts = vCount * 3 + eCount * 1;
    ctx.textAlign = 'center';

    ctx.fillStyle = '#059669';
    ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(String(vCount), tableX + teamColW + 15 * matchColW + statColW / 2, rowY + 24);

    ctx.fillStyle = '#d97706';
    ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(String(eCount), tableX + teamColW + 15 * matchColW + statColW + statColW / 2, rowY + 24);

    ctx.fillStyle = '#0284c7';
    ctx.font = '900 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(String(pts), tableX + teamColW + 15 * matchColW + statColW * 2 + statColW / 2, rowY + 24);
  });

  // 5. SEÇÃO 3: ESCALAÇÃO & GOLS POR TIME (Grid 2x2)
  curY += gridH + 16;
  const rosterBoxW = (sheetW - 48 - 14) / 2;
  const rosterBoxH = 260;

  const teamLineupEntries = Object.entries(sumula.teamLineups || {}).slice(0, 4);
  teamLineupEntries.forEach(([tName, players], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const boxX = padX + 24 + col * (rosterBoxW + 14);
    const boxY = curY + row * (rosterBoxH + 12);

    ctx.fillStyle = '#ffffff';
    roundRect(ctx, boxX, boxY, rosterBoxW, rosterBoxH, 12);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    roundRect(ctx, boxX, boxY, rosterBoxW, rosterBoxH, 12);
    ctx.stroke();

    // Cabeçalho do Time
    const totalGoals = players.reduce((acc, p) => acc + (Number(p.goals) || 0), 0);
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, boxX + 1, boxY + 1, rosterBoxW - 2, 34, 11);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + 35);
    ctx.lineTo(boxX + rosterBoxW, boxY + 35);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(truncateCanvasText(ctx, tName.toUpperCase(), rosterBoxW - 110), boxX + 14, boxY + 23);

    ctx.fillStyle = '#059669';
    ctx.font = '900 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`⚽ ${totalGoals} Gol${totalGoals !== 1 ? 's' : ''}`, boxX + rosterBoxW - 14, boxY + 23);

    // Lista de Jogadores escalados (até 8 atletas)
    const displayPlayers = players.slice(0, 8);
    displayPlayers.forEach((p, pI) => {
      const pY = boxY + 44 + pI * 26;
      const hasGoals = Number(p.goals) > 0;
      const goalsReserve = hasGoals ? 54 : 16;
      const subReserve = p.isSub ? 42 : 0;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const playerLabel = truncateCanvasText(
        ctx,
        `• ${p.player}`,
        rosterBoxW - 28 - goalsReserve - subReserve
      );
      ctx.fillText(playerLabel, boxX + 14, pY + 14);

      if (p.isSub) {
        const nameW = ctx.measureText(playerLabel).width;
        ctx.fillStyle = '#64748b';
        ctx.font = 'italic 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('(Res)', boxX + 20 + nameW, pY + 14);
      }

      if (hasGoals) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#059669';
        ctx.font = '900 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`⚽ ${p.goals}`, boxX + rosterBoxW - 14, pY + 14);
      }
    });
  });

  // 6. SEÇÃO 4: CARTÕES E GOLS DESTAQUE (Lado a Lado)
  curY += rosterBoxH * 2 + 24;
  const cardSecH = 150;
  const halfW = (sheetW - 48 - 14) / 2;

  // Caixa Esquerda: Cartões Aplicados
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, padX + 24, curY, halfW, cardSecH, 12);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  roundRect(ctx, padX + 24, curY, halfW, cardSecH, 12);
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, padX + 25, curY + 1, halfW - 2, 32, 11);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(padX + 24, curY + 33);
  ctx.lineTo(padX + 24 + halfW, curY + 33);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🟨 🟦 🟥 CARTÕES APLICADOS NA RODADA', padX + 36, curY + 22);

  const allCards: { name: string; type: 'amarelo' | 'azul' | 'vermelho' }[] = [
    ...(sumula.yellowCards || []).map((name) => ({ name, type: 'amarelo' as const })),
    ...(sumula.blueCards || []).map((name) => ({ name, type: 'azul' as const })),
    ...(sumula.redCards || []).map((name) => ({ name, type: 'vermelho' as const })),
  ];

  if (allCards.length === 0) {
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✓ Jogo Limpo · Nenhum cartão registrado na súmula.', padX + 24 + halfW / 2, curY + 85);
  } else {
    allCards.slice(0, 4).forEach((c, cI) => {
      const cY = curY + 42 + cI * 25;
      const cardIcon = c.type === 'vermelho' ? '🟥 Vermelho' : c.type === 'azul' ? '🟦 Azul' : '🟨 Amarelo';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(truncateCanvasText(ctx, `${cardIcon}: ${c.name}`, halfW - 32), padX + 36, cY + 14);
    });
  }

  // Caixa Direita: Gols Destaque
  const destX = padX + 24 + halfW + 14;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, destX, curY, halfW, cardSecH, 12);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  roundRect(ctx, destX, curY, halfW, cardSecH, 12);
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, destX + 1, curY + 1, halfW - 2, 32, 11);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(destX, curY + 33);
  ctx.lineTo(destX + halfW, curY + 33);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⭐ GOLS DESTAQUE DA RODADA', destX + 16, curY + 22);

  const highlights = sumula.highlightGoals || [];
  if (highlights.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhum gol destaque registrado nesta rodada.', destX + halfW / 2, curY + 85);
  } else {
    highlights.slice(0, 4).forEach((h, hI) => {
      const hY = curY + 42 + hI * 25;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(truncateCanvasText(ctx, `⚽ ${h.player}`, halfW - 140), destX + 16, hY + 14);

      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Horário: ${h.time}`, destX + halfW - 16, hY + 14);
    });
  }

  // 7. SEÇÃO 5: RODAPÉ COM CERTIFICADO E HOMOLOGAÇÃO
  curY += cardSecH + 16;
  const certH = 95;

  ctx.fillStyle = '#f0fdf4';
  roundRect(ctx, padX + 24, curY, sheetW - 48, certH, 12);
  ctx.fill();
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.5;
  roundRect(ctx, padX + 24, curY, sheetW - 48, certH, 12);
  ctx.stroke();

  // Selo
  ctx.fillStyle = '#065f46';
  ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('✅ REGISTRO GRAVADO E VALIDADO OFICIALMENTE', padX + 42, curY + 34);

  const hashId = `SUM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  ctx.fillStyle = '#047857';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(
    `Código de Autenticação: ${hashId}   ·   Homologado às ${timeStr}`,
    padX + 42,
    curY + 62
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('ROSÁLIA ESPORTES · FUTPLAY LITE', padX + sheetW - 48, curY + 38);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Liga Oficial de Futebol Society e Peladas', padX + sheetW - 48, curY + 62);

  // 8. Exportação da Imagem (PNG) e do Documento (PDF)
  const pngDataUrl = canvas.toDataURL('image/png', 0.95);
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);

  // Extrai bytes JPEG para o PDF
  const base64Jpeg = jpegDataUrl.split(',')[1];
  const binaryJpeg = atob(base64Jpeg);
  const jpegBytes = new Uint8Array(binaryJpeg.length);
  for (let i = 0; i < binaryJpeg.length; i++) {
    jpegBytes[i] = binaryJpeg.charCodeAt(i);
  }

  // Gera PDF padrão A4
  const pdfBlob = createPdfBlobFromJpeg(jpegBytes, width, height);
  const pdfUrl = URL.createObjectURL(pdfBlob);

  const fileNameBase = `comprovante-sumula-${sumula.matchDate ? sumula.matchDate.replace(/\//g, '-') : 'oficial'}`;
  const pdfFile = new File([pdfBlob], `${fileNameBase}.pdf`, {
    type: 'application/pdf',
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Erro ao converter Canvas em Blob'));
          return;
        }
        const file = new File([blob], `${fileNameBase}.png`, {
          type: 'image/png',
        });
        resolve({
          dataUrl: pngDataUrl,
          file,
          pdfBlob,
          pdfUrl,
          pdfFile,
        });
      },
      'image/png',
      0.95
    );
  });
}

function truncateCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  const safeText = (text || '').trim();
  if (!safeText || maxWidth <= 12) return '';
  if (ctx.measureText(safeText).width <= maxWidth) return safeText;
  let clipped = safeText;
  while (clipped.length > 1 && ctx.measureText(`${clipped}...`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}...`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
