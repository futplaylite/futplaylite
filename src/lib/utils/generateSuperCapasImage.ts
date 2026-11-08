export interface SuperCapasImageData {
  teamName: string;
  matchDate: string;
  teamPhotoUrl?: string;
  wins: number;
  draws: number;
  totalGoals: number;
  venueName?: string;
  players: {
    name: string;
    goals: number;
    isSub?: boolean;
    wins: number;
    draws: number;
    yellowCards?: number;
    blueCards?: number;
    redCards?: number;
  }[];
}

/**
 * Desenha um retângulo com cantos arredondados no Canvas.
 */
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

/**
 * Carrega imagem de forma segura e assíncrona.
 */
function loadImageSafe(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      resolve(null);
    }, 2500);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Desenha uma miniatura estilizada da Camisa de Futebol no Canvas
 */
function drawSoccerJersey(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  isYellow: boolean
) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 64;
  ctx.scale(s, s);

  const mainColor = isYellow ? '#FACC15' : '#2563EB';
  const collarColor = isYellow ? '#0F172A' : '#FFFFFF';
  const shadowColor = isYellow ? '#CA8A04' : '#1D4ED8';

  // Corpo e mangas da camisa
  ctx.beginPath();
  ctx.moveTo(20, 14);
  ctx.lineTo(8, 23);
  ctx.lineTo(14, 34);
  ctx.lineTo(18, 34);
  ctx.lineTo(22, 30);
  ctx.lineTo(22, 52);
  ctx.quadraticCurveTo(22, 55, 25, 55);
  ctx.lineTo(39, 55);
  ctx.quadraticCurveTo(42, 55, 42, 52);
  ctx.lineTo(42, 30);
  ctx.lineTo(46, 34);
  ctx.lineTo(50, 34);
  ctx.lineTo(56, 27);
  ctx.lineTo(56, 23);
  ctx.lineTo(44, 14);
  ctx.quadraticCurveTo(32, 20, 20, 14);
  ctx.closePath();
  ctx.fillStyle = mainColor;
  ctx.fill();

  // Sombreamento lateral
  ctx.fillStyle = shadowColor;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(22, 30, 4, 23);
  ctx.fillRect(38, 30, 4, 23);
  ctx.globalAlpha = 1.0;

  // Gola
  ctx.beginPath();
  ctx.arc(32, 14, 7, 0, Math.PI);
  ctx.fillStyle = collarColor;
  ctx.fill();

  ctx.restore();
}

/**
 * Desenha o Troféu Dourado 3D com Coroa no Canvas
 */
function drawTrophy3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.save();
  ctx.translate(x, y);
  const s = width / 100;
  ctx.scale(s, s);

  const goldGrad = ctx.createLinearGradient(0, 0, 100, 100);
  goldGrad.addColorStop(0, '#FEF08A');
  goldGrad.addColorStop(0.35, '#FACC15');
  goldGrad.addColorStop(0.7, '#EAB308');
  goldGrad.addColorStop(1, '#B45309');

  // Coroa no topo
  ctx.beginPath();
  ctx.moveTo(38, 16);
  ctx.lineTo(44, 24);
  ctx.lineTo(50, 14);
  ctx.lineTo(56, 24);
  ctx.lineTo(62, 16);
  ctx.lineTo(60, 28);
  ctx.lineTo(40, 28);
  ctx.closePath();
  ctx.fillStyle = goldGrad;
  ctx.fill();
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Alças do Cálice
  ctx.beginPath();
  ctx.arc(32, 46, 12, Math.PI * 0.5, Math.PI * 1.5, false);
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(68, 46, 12, Math.PI * 1.5, Math.PI * 0.5, false);
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Corpo do Cálice
  ctx.beginPath();
  ctx.moveTo(34, 30);
  ctx.lineTo(66, 30);
  ctx.lineTo(66, 44);
  ctx.quadraticCurveTo(66, 62, 50, 62);
  ctx.quadraticCurveTo(34, 62, 34, 44);
  ctx.closePath();
  ctx.fillStyle = goldGrad;
  ctx.fill();

  // Borda superior
  ctx.fillStyle = '#FEF08A';
  roundRect(ctx, 32, 28, 36, 5, 2);
  ctx.fill();

  // Haste
  ctx.fillStyle = goldGrad;
  ctx.fillRect(47, 62, 6, 12);

  // Base
  ctx.beginPath();
  ctx.moveTo(40, 74);
  ctx.lineTo(60, 74);
  ctx.lineTo(66, 84);
  ctx.lineTo(34, 84);
  ctx.closePath();
  ctx.fillStyle = goldGrad;
  ctx.fill();

  ctx.fillStyle = '#78350F';
  roundRect(ctx, 32, 84, 36, 6, 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Gera a imagem dos Super Capas da Semana idêntica à referência visual enviada:
 * - Moldura neon azul
 * - Troféu 3D + "SUPER CAPAS DA SEMANA"
 * - Pills com Equipe Campeã e Semana
 * - Foto 16:9 com borda dourada, selo de campeão e faixa de dados
 * - 3 métricas neon (Vitórias, Empates, Gols Marcados)
 * - Elenco dos atletas vencedores com medalhas 3D, camisas SVG, gols e badge de artilheiro
 * - Rodapé oficial da liga
 */
export async function generateSuperCapasImage(data: SuperCapasImageData): Promise<{
  dataUrl: string;
  blob: Blob;
  file: File;
}> {
  const WIDTH = 1080;
  const HEIGHT = 1880;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível obter o contexto 2D do Canvas.');

  // 1. FUNDO COM A IMAGEM DO ESTÁDIO COM REFLETORES + GRADIENTE OVERLAY
  const bgImg = await loadImageSafe('/images/stadium-super-capas.jpg');
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, WIDTH, HEIGHT);
    // Overlay noturno com gradiente translúcido para preservar legibilidade idêntico ao modelo
    const overlayGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    overlayGrad.addColorStop(0, 'rgba(10, 20, 53, 0.68)');
    overlayGrad.addColorStop(0.3, 'rgba(7, 17, 44, 0.78)');
    overlayGrad.addColorStop(0.7, 'rgba(5, 12, 32, 0.86)');
    overlayGrad.addColorStop(1, 'rgba(3, 6, 18, 0.94)');
    ctx.fillStyle = overlayGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, '#0a1435');
    bgGrad.addColorStop(0.3, '#07112c');
    bgGrad.addColorStop(0.7, '#050c20');
    bgGrad.addColorStop(1, '#030612');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Efeitos de Luz / Glow nos Cantos
  ctx.save();
  const topGlow = ctx.createRadialGradient(WIDTH / 2, 100, 10, WIDTH / 2, 100, 480);
  topGlow.addColorStop(0, 'rgba(37, 99, 235, 0.35)');
  topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, WIDTH, 600);

  const starGlow = ctx.createRadialGradient(WIDTH - 120, 100, 5, WIDTH - 120, 100, 250);
  starGlow.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
  starGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = starGlow;
  ctx.fillRect(WIDTH - 300, 0, 300, 300);

  // Estrelas / Brilhos
  ctx.fillStyle = '#BAE6FD';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('✦', WIDTH - 120, 100);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('✦', WIDTH - 80, 80);
  ctx.restore();

  // 2. MOLDURA EXTERNA ELEGANTE EM AZUL NEON
  const frameMargin = 36;
  const frameW = WIDTH - frameMargin * 2;
  const frameH = HEIGHT - frameMargin * 2;
  const frameRadius = 40;

  ctx.save();
  roundRect(ctx, frameMargin, frameMargin, frameW, frameH, frameRadius);
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(37, 99, 235, 0.7)';
  ctx.shadowBlur = 24;
  ctx.stroke();
  ctx.restore();

  // 3. IDENTIDADE DA LIGA NO TOPO À ESQUERDA
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillStyle = '#BFDBFE';
  ctx.letterSpacing = '2px';
  ctx.fillText('⚽ FUTPLAY LITE   |   LIGA SOCIETY PLANALTO - BA', 64, 95);
  ctx.restore();

  // 4. CABEÇALHO COM TROFÉU 3D + "SUPER CAPAS DA SEMANA" À ESQUERDA
  const trophyW = 100;
  const trophyH = 100;
  const headerY = 135;
  const trophyX = 64;

  drawTrophy3D(ctx, trophyX, headerY, trophyW, trophyH);

  ctx.save();
  const textX = trophyX + trophyW + 20;
  ctx.textAlign = 'left';

  // "SUPER CAPAS"
  ctx.font = '900 italic 52px system-ui, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillText('SUPER CAPAS', textX, headerY + 46);

  // "DA SEMANA"
  const goldTextGrad = ctx.createLinearGradient(textX, headerY + 55, textX + 320, headerY + 95);
  goldTextGrad.addColorStop(0, '#FDE047');
  goldTextGrad.addColorStop(0.5, '#FACC15');
  goldTextGrad.addColorStop(1, '#EAB308');
  ctx.fillStyle = goldTextGrad;
  ctx.shadowColor = 'rgba(245, 158, 11, 0.55)';
  ctx.shadowBlur = 16;
  ctx.fillText('DA SEMANA', textX, headerY + 95);
  ctx.restore();

  // 5. SUB-BADGES: "EQUIPE CAMPEÃ: TIME 02" & "SEMANA DE 27/10/2026" LADO A LADO
  const photoX = 64;
  const photoW = WIDTH - photoX * 2; // 952px
  const badgesY = 265;
  const badgeH = 50;
  const pillsGap = 16;
  const pillW = (photoW - pillsGap) / 2;
  const pill1X = photoX;
  const pill2X = photoX + pillW + pillsGap;

  // Pill 1: Equipe Campeã
  ctx.save();
  roundRect(ctx, pill1X, badgesY, pillW, badgeH, 25);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '900 18px system-ui, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText(`⭐ EQUIPE CAMPEÃ: ${data.teamName.toUpperCase()}`, pill1X + pillW / 2, badgesY + 32);

  // Pill 2: Data da Semana
  roundRect(ctx, pill2X, badgesY, pillW, badgeH, 25);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '800 18px system-ui, sans-serif';
  ctx.fillStyle = '#BFDBFE';
  ctx.fillText(`📅 SEMANA DE ${data.matchDate}`, pill2X + pillW / 2, badgesY + 32);
  ctx.restore();

  // 6. FOTO EM MODO PAISAGEM COM MOLDURA DOURADA VIBRANTE
  const photoY = 335;
  const photoH = 535; // 16:9 perfeito
  const photoRadius = 24;

  const teamImg = await loadImageSafe(data.teamPhotoUrl);

  ctx.save();
  roundRect(ctx, photoX, photoY, photoW, photoH, photoRadius);
  ctx.clip();

  if (teamImg) {
    const imgRatio = teamImg.width / teamImg.height;
    const targetRatio = photoW / photoH;
    let sW = teamImg.width;
    let sH = teamImg.height;
    let sX = 0;
    let sY = 0;

    if (imgRatio > targetRatio) {
      sW = teamImg.height * targetRatio;
      sX = (teamImg.width - sW) / 2;
    } else {
      sH = teamImg.width / targetRatio;
      sY = (teamImg.height - sH) / 2;
    }

    ctx.drawImage(teamImg, sX, sY, sW, sH, photoX, photoY, photoW, photoH);
  } else {
    const fallbackGrad = ctx.createLinearGradient(photoX, photoY, photoX, photoY + photoH);
    fallbackGrad.addColorStop(0, '#1e3a8a');
    fallbackGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(photoX, photoY, photoW, photoH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 40px system-ui, sans-serif';
    ctx.fillText(`👑 ${data.teamName.toUpperCase()}`, photoX + photoW / 2, photoY + photoH / 2);
  }

  // Local sutil no Canto Inferior Direito da Foto
  const venueTitle = data.venueName || 'Arena Society Planalto - BA';
  if (venueTitle) {
    const venueText = `📍 ${venueTitle}`;
    ctx.save();
    ctx.font = '700 18px system-ui, sans-serif';
    const venueMetrics = ctx.measureText(venueText);
    const pillW = venueMetrics.width + 24;
    const pillH = 34;
    const pillX = photoX + photoW - pillW - 16;
    const pillY = photoY + photoH - pillH - 16;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 17);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(venueText, pillX + 12, pillY + 23);
    ctx.restore();
  }

  // Botões de Carrossel Laterais (< e >)
  const drawCarouselArrow = (btnX: number, btnY: number, arrow: string) => {
    ctx.beginPath();
    ctx.arc(btnX, btnY, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(arrow, btnX, btnY + 7);
  };

  drawCarouselArrow(photoX + 36, photoY + photoH / 2, '‹');
  drawCarouselArrow(photoX + photoW - 36, photoY + photoH / 2, '›');

  ctx.restore();

  // Borda ao redor da foto (Dourada e com Glow)
  ctx.save();
  roundRect(ctx, photoX, photoY, photoW, photoH, photoRadius);
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(250, 204, 21, 0.6)';
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.restore();

  // Selo no Canto Superior Esquerdo da Foto: "TIME 02 CAMPEÃO"
  ctx.save();
  const championBadgeW = 240;
  const championBadgeH = 58;
  roundRect(ctx, photoX + 20, photoY + 20, championBadgeW, championBadgeH, 16);
  ctx.fillStyle = 'rgba(10, 20, 53, 0.9)';
  ctx.fill();
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Coroa
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('👑', photoX + 36, photoY + 56);

  ctx.textAlign = 'left';
  ctx.font = '900 13px system-ui, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(data.teamName.toUpperCase(), photoX + 74, photoY + 42);

  ctx.font = '900 17px system-ui, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('CAMPEÃO', photoX + 74, photoY + 65);
  ctx.restore();

  // 7. PAINEL DE MÉTRICAS EM 3 CARDS NEON AZUIS
  const metricsY = photoY + photoH + 24;
  const metricsH = 100;
  const metricsGap = 16;
  const colW = (photoW - metricsGap * 2) / 3;

  const metricsData = [
    { label: 'VITÓRIAS', value: `${data.wins}V`, color: '#4ADE80', icon: '🏆' },
    { label: 'EMPATES', value: `${data.draws}E`, color: '#FACC15', icon: '🤝' },
    { label: 'GOLS', value: `${data.totalGoals}`, color: '#FFFFFF', icon: '⚽' },
  ];

  metricsData.forEach((col, idx) => {
    const colX = photoX + idx * (colW + metricsGap);
    ctx.save();
    roundRect(ctx, colX, metricsY, colW, metricsH, 20);
    ctx.fillStyle = 'rgba(15, 28, 68, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(37, 99, 235, 0.4)';
    ctx.shadowBlur = 12;
    ctx.stroke();

    // Ícone à esquerda
    ctx.font = '36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(col.icon, colX + 46, metricsY + 62);

    // Texto alinhado à esquerda dentro do card
    ctx.textAlign = 'left';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillStyle = '#BFDBFE';
    ctx.fillText(col.label, colX + 85, metricsY + 42);

    ctx.font = '900 italic 38px system-ui, sans-serif';
    ctx.fillStyle = col.color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(col.value, colX + 85, metricsY + 82);
    ctx.shadowBlur = 0;
    ctx.restore();
  });

  // 8. CONTAINER DO ELENCO DOS ATLETAS VENCEDORES
  const listStartY = metricsY + metricsH + 24;
  const listContainerH = 670;

  ctx.save();
  roundRect(ctx, photoX, listStartY, photoW, listContainerH, 24);
  ctx.fillStyle = 'rgba(10, 20, 53, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(37, 99, 235, 0.35)';
  ctx.shadowBlur = 16;
  ctx.stroke();

  // Cabeçalho do Elenco
  ctx.textAlign = 'left';
  ctx.font = '900 20px system-ui, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('👑 ELENCO DOS ATLETAS VENCEDORES ', photoX + 24, listStartY + 42);

  const titleW = ctx.measureText('👑 ELENCO DOS ATLETAS VENCEDORES ').width;
  ctx.fillStyle = '#FACC15';
  ctx.fillText('(SUPER CAPAS)', photoX + 24 + titleW, listStartY + 42);

  ctx.textAlign = 'right';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.fillStyle = '#93C5FD';
  ctx.fillText(`${data.players.length} Atletas Campeões`, photoX + photoW - 24, listStartY + 42);

  // Linha divisória fina
  ctx.beginPath();
  ctx.moveTo(photoX + 20, listStartY + 58);
  ctx.lineTo(photoX + photoW - 20, listStartY + 58);
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 9. LINHAS DOS ATLETAS COM MEDALHA, CAMISA SVG, GOLS E ARTILHEIRO
  const cardListY = listStartY + 74;
  const totalAthletes = data.players.length;
  const maxPlayersToShow = Math.min(6, totalAthletes);
  const playerCardH = 86;
  const playerGap = 12;

  for (let i = 0; i < maxPlayersToShow; i++) {
    const player = data.players[i];
    const itemY = cardListY + i * (playerCardH + playerGap);
    const itemW = photoW - 40;
    const itemX = photoX + 20;
    const isTopScorer = i === 0 && player.goals > 0;

    ctx.save();
    roundRect(ctx, itemX, itemY, itemW, playerCardH, 16);

    if (isTopScorer) {
      const artGrad = ctx.createLinearGradient(itemX, itemY, itemX + itemW, itemY);
      artGrad.addColorStop(0, 'rgba(234, 179, 8, 0.25)');
      artGrad.addColorStop(0.5, 'rgba(234, 179, 8, 0.12)');
      artGrad.addColorStop(1, 'rgba(15, 23, 42, 0.3)');
      ctx.fillStyle = artGrad;
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 1. Medalha Circular
    const circleRadius = 24;
    const circleX = itemX + 38;
    const circleY = itemY + playerCardH / 2;

    ctx.beginPath();
    ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);

    if (i === 0) {
      const goldGrad = ctx.createLinearGradient(circleX - 24, circleY - 24, circleX + 24, circleY + 24);
      goldGrad.addColorStop(0, '#FEF08A');
      goldGrad.addColorStop(0.5, '#FACC15');
      goldGrad.addColorStop(1, '#B45309');
      ctx.fillStyle = goldGrad;
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = '900 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('1', circleX, circleY + 8);
    } else if (i === 1) {
      const silverGrad = ctx.createLinearGradient(circleX - 24, circleY - 24, circleX + 24, circleY + 24);
      silverGrad.addColorStop(0, '#F1F5F9');
      silverGrad.addColorStop(0.5, '#CBD5E1');
      silverGrad.addColorStop(1, '#64748B');
      ctx.fillStyle = silverGrad;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#1E293B';
      ctx.font = '900 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('2', circleX, circleY + 8);
    } else if (i === 2) {
      const bronzeGrad = ctx.createLinearGradient(circleX - 24, circleY - 24, circleX + 24, circleY + 24);
      bronzeGrad.addColorStop(0, '#D97706');
      bronzeGrad.addColorStop(0.5, '#B45309');
      bronzeGrad.addColorStop(1, '#78350F');
      ctx.fillStyle = bronzeGrad;
      ctx.fill();
      ctx.strokeStyle = '#FDE68A';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('3', circleX, circleY + 8);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '900 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), circleX, circleY + 8);
    }

    // 2. Camisa de Futebol
    const jerseyX = itemX + 78;
    const jerseyY = itemY + 16;
    drawSoccerJersey(ctx, jerseyX, jerseyY, 52, isTopScorer);

    // 3. Nome do Atleta
    const textStartX = itemX + 148;
    ctx.textAlign = 'left';
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(player.name.toUpperCase(), textStartX, itemY + 38);

    // 4. Badge "ARTILHEIRO"
    if (isTopScorer) {
      const nameW = ctx.measureText(player.name.toUpperCase()).width;
      const artBadgeX = textStartX + nameW + 14;
      const artBadgeW = 120;
      const artBadgeH = 26;
      roundRect(ctx, artBadgeX, itemY + 18, artBadgeW, artBadgeH, 13);
      ctx.fillStyle = '#FACC15';
      ctx.fill();

      ctx.font = '900 13px system-ui, sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.fillText('ARTILHEIRO', artBadgeX + artBadgeW / 2, itemY + 36);
    }

    // 5. Subtítulo: Cartões recebidos na Súmula
    const yellowCount = player.yellowCards || 0;
    const blueCount = player.blueCards || 0;
    const redCount = player.redCards || 0;
    const hasCards = yellowCount > 0 || blueCount > 0 || redCount > 0;

    ctx.textAlign = 'left';
    if (hasCards) {
      const cardsList = [];
      if (yellowCount > 0) cardsList.push(`🟨 ${yellowCount} ${yellowCount === 1 ? 'Amarelo' : 'Amarelos'}`);
      if (blueCount > 0) cardsList.push(`🟦 ${blueCount} ${blueCount === 1 ? 'Azul' : 'Azuis'}`);
      if (redCount > 0) cardsList.push(`🟥 ${redCount} ${redCount === 1 ? 'Vermelho' : 'Vermelhos'}`);

      ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillStyle = '#FDE047';
      ctx.fillText(cardsList.join('   '), textStartX, itemY + 68);
    } else {
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillStyle = '#86EFAC';
      ctx.fillText('✓ Nenhum cartão', textStartX, itemY + 68);
    }

    // 6. Gols no Cantinho Direito: SOMENTE a quantidade de gols com tipografia de destaque sem cortar
    ctx.textAlign = 'right';
    const goalsY = itemY + playerCardH / 2 + 12;
    const rightMargin = 28;

    // Rótulo "GOL" ou "GOLS"
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(253, 224, 71, 0.9)';
    const labelText = player.goals === 1 ? ' GOL' : ' GOLS';
    ctx.fillText(labelText, itemX + itemW - rightMargin, goalsY - 2);

    const labelW = ctx.measureText(labelText).width;

    // Número de gols grande, itálico e com degradê dourado de impacto
    ctx.font = '900 italic 42px system-ui, sans-serif';
    const numGrad = ctx.createLinearGradient(
      itemX + itemW - rightMargin - labelW - 50,
      goalsY - 35,
      itemX + itemW - rightMargin - labelW,
      goalsY
    );
    numGrad.addColorStop(0, '#FEF08A');
    numGrad.addColorStop(0.5, '#FACC15');
    numGrad.addColorStop(1, '#EAB308');
    ctx.fillStyle = numGrad;
    ctx.shadowColor = 'rgba(245, 158, 11, 0.65)';
    ctx.shadowBlur = 14;
    ctx.fillText(String(player.goals), itemX + itemW - rightMargin - labelW - 4, goalsY);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  // 10. RODAPÉ DE CERTIFICAÇÃO DA LIGA
  const footerY = HEIGHT - 68;
  ctx.save();
  ctx.textAlign = 'center';

  // Linhas com Troféu Central
  const lineW = 90;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - lineW - 25, footerY - 14);
  ctx.lineTo(WIDTH / 2 - 25, footerY - 14);
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('🏆', WIDTH / 2, footerY - 8);

  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 + 25, footerY - 14);
  ctx.lineTo(WIDTH / 2 + lineW + 25, footerY - 14);
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = '900 14px system-ui, sans-serif';
  ctx.fillStyle = '#CBD5E1';
  ctx.letterSpacing = '2px';
  ctx.fillText('COMPARTILHADO VIA FUTPLAY LITE', WIDTH / 2, footerY + 8);

  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillStyle = '#60A5FA';
  ctx.letterSpacing = '1px';
  ctx.fillText('IDENTIDADE OFICIAL DA LIGA', WIDTH / 2, footerY + 24);
  ctx.restore();

  // 11. EXPORTAÇÃO
  const dataUrl = canvas.toDataURL('image/png', 0.95);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Erro ao converter Canvas para Blob'));
      },
      'image/png',
      0.95
    );
  });

  const sanitizedTeam = data.teamName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-');

  const file = new File([blob], `super-capas-${sanitizedTeam}-futplay.png`, {
    type: 'image/png',
  });

  return { dataUrl, blob, file };
}
