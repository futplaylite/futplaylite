export interface CardImageData {
  displayName: string;
  position: string;
  dominantFoot: string;
  avatarUrl?: string;
  teamName: string;
  teamCrestUrl?: string;
  cityName: string;
  overallStars: number;
  skills?: {
    finalizacao: number;
    marcacao: number;
    passe: number;
    raca: number;
    drible: number;
  };
  goals: number;
  goalsAvg: string;
  matchesPlayed: number;
  superCapas: number;
  capaLabel: string;
  capaPct: number;
  yellowCards: number;
  blueCards: number;
  redCards?: number;
}

/**
 * Desenha uma estrela no canvas.
 */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

/**
 * Carrega uma imagem de forma assíncrona com timeout de segurança.
 */
function loadImageSafe(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      resolve(null);
    }, 1500);

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
 * Desenha um retângulo com cantos arredondados.
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
 * Gera uma imagem 9:16 (1080x1920) do Cartão Oficial do Atleta
 * 100% idêntica ao card exibido na tela do app:
 * - Fundo oficial do estádio com refletores (/images/stadium-super-capas.jpg)
 * - Moldura neon azul com glow nos cantos
 * - Topo do card com "CARTÃO OFICIAL DE ATLETA" e brasão oficial do time
 * - Foto de perfil em squircle (retângulo arredondado) com borda dourada
 * - Nome do atleta em destaque
 * - Posição, pé dominante e time em linha compacta
 * - Badge central de Overall Stars (estrelas douradas + nota + check de avaliado)
 * - Grid de 5 quesitos de habilidade (Fin, Mar, Pas, Raç, Dri) com notas em estrelas
 * - Painel de 3 métricas da liga: Gols (Média), Presenças e Super Capas
 * - Badges disciplinares: Amarelos, Azuis e Vermelhos
 * - Rodapé oficial de autenticação da liga
 */
export async function generateCard9x16(data: CardImageData): Promise<{
  dataUrl: string;
  blob: Blob;
  file: File;
}> {
  const WIDTH = 1080;
  const HEIGHT = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Falha ao inicializar o Canvas 2D.');
  }

  // Pré-carrega imagens se disponíveis
  const [avatarImg, crestImg, stadiumImg] = await Promise.all([
    loadImageSafe(data.avatarUrl),
    loadImageSafe(data.teamCrestUrl),
    loadImageSafe('/images/stadium-super-capas.jpg'),
  ]);

  // 1. FUNDO GERAL COM A IMAGEM OFICIAL DO ESTÁDIO (9:16)
  if (stadiumImg) {
    ctx.drawImage(stadiumImg, 0, 0, WIDTH, HEIGHT);
    const bgOverlay = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgOverlay.addColorStop(0, 'rgba(10, 20, 53, 0.70)');
    bgOverlay.addColorStop(0.3, 'rgba(7, 17, 44, 0.80)');
    bgOverlay.addColorStop(0.7, 'rgba(5, 12, 32, 0.88)');
    bgOverlay.addColorStop(1, 'rgba(3, 6, 18, 0.95)');
    ctx.fillStyle = bgOverlay;
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

  // Glows neon nos cantos
  ctx.save();
  const topGlow = ctx.createRadialGradient(WIDTH / 2, 80, 20, WIDTH / 2, 80, 500);
  topGlow.addColorStop(0, 'rgba(37, 99, 235, 0.35)');
  topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, WIDTH, 600);
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

  // 3. IDENTIDADE DA LIGA NO TOPO
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('PASSAPORTE OFICIAL DO ATLETA', WIDTH - 64, 85);
  ctx.restore();

  // 4. O CARD CENTRAL DO ATLETA (IDÊNTICO AO CARD DA TELA)
  const cardX = 64;
  const cardY = 120;
  const cardW = WIDTH - cardX * 2; // 952px
  const cardH = 1680;
  const cardRadius = 36;

  // Fundo do Card com estádio e gradiente azul profundo
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.clip();

  if (stadiumImg) {
    ctx.drawImage(stadiumImg, cardX, cardY, cardW, cardH);
    const cardOverlay = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cardOverlay.addColorStop(0, 'rgba(10, 20, 53, 0.75)');
    cardOverlay.addColorStop(0.3, 'rgba(7, 17, 44, 0.82)');
    cardOverlay.addColorStop(0.7, 'rgba(5, 12, 32, 0.88)');
    cardOverlay.addColorStop(1, 'rgba(3, 6, 18, 0.94)');
    ctx.fillStyle = cardOverlay;
    ctx.fillRect(cardX, cardY, cardW, cardH);
  } else {
    const cardBg = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cardBg.addColorStop(0, '#0a1435');
    cardBg.addColorStop(0.3, '#07112c');
    cardBg.addColorStop(0.7, '#050c20');
    cardBg.addColorStop(1, '#030612');
    ctx.fillStyle = cardBg;
    ctx.fillRect(cardX, cardY, cardW, cardH);
  }
  ctx.restore();

  // Borda elegante do Cartão (Azul luminoso)
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.strokeStyle = 'rgba(147, 197, 253, 0.75)';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
  ctx.shadowBlur = 20;
  ctx.stroke();
  ctx.restore();

  // 5. TOPO DO CARD: TÍTULO "CARTÃO OFICIAL DE ATLETA" E SELO DA LIGA
  ctx.save();
  // Ícone de Medalha / Award
  ctx.font = '26px system-ui, sans-serif';
  ctx.fillText('🎖️', cardX + 36, cardY + 54);

  ctx.textAlign = 'left';
  ctx.font = '900 22px system-ui, sans-serif';
  ctx.fillStyle = '#DBEAFE';
  ctx.fillText('CARTÃO OFICIAL DE ATLETA', cardX + 74, cardY + 54);

  ctx.textAlign = 'right';
  ctx.font = '800 18px system-ui, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('TEMPORADA OFICIAL', cardX + cardW - 36, cardY + 54);

  // Linha divisória horizontal superior
  ctx.beginPath();
  ctx.moveTo(cardX + 30, cardY + 95);
  ctx.lineTo(cardX + cardW - 30, cardY + 95);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 6. ATLETA E TIME LADO A LADO (FOTO/BRASÃO E NOMES DO MESMO TAMANHO)
  const col1CenterX = cardX + cardW * 0.28;
  const col2CenterX = cardX + cardW * 0.72;
  const itemSize = 210;
  const itemY = cardY + 135;
  const itemRadius = 36;
  const maxColWidth = cardW * 0.44;

  // --- COLUNA 1: ATLETA (FOTO EM SQUIRCLE + NOME) ---
  const avatarX = col1CenterX - itemSize / 2;
  ctx.save();
  roundRect(ctx, avatarX, itemY, itemSize, itemSize, itemRadius);
  ctx.shadowColor = 'rgba(245, 158, 11, 0.7)';
  ctx.shadowBlur = 22;
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 4.5;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  roundRect(ctx, avatarX, itemY, itemSize, itemSize, itemRadius);
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarX, itemY, itemSize, itemSize);
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(avatarX, itemY, itemSize, itemSize);
    ctx.fillStyle = '#1E3A8A';
    ctx.textAlign = 'center';
    ctx.font = '900 90px "Oswald", system-ui, sans-serif';
    ctx.fillText(
      data.displayName.slice(0, 2).toUpperCase(),
      col1CenterX,
      itemY + itemSize / 2 + 32
    );
  }
  ctx.restore();

  // --- COLUNA 2: TIME (APENAS O BRASÃO OFICIAL + NOME) ---
  const crestW = itemSize;
  const crestH = itemSize;
  const crestX = col2CenterX - crestW / 2;
  const crestY = itemY;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 18;

  if (crestImg) {
    ctx.drawImage(crestImg, crestX, crestY, crestW, crestH);
  } else {
    // Escudo SVG idêntico ao TeamCrestBadge sem quadrado ao redor
    const scale = crestW / 100;
    ctx.translate(crestX, crestY);
    ctx.scale(scale, scale);

    // Escudo externo
    ctx.beginPath();
    ctx.moveTo(50, 4);
    ctx.lineTo(92, 19.5);
    ctx.lineTo(92, 54);
    ctx.bezierCurveTo(92, 81, 73.5, 100.5, 50, 108);
    ctx.bezierCurveTo(26.5, 100.5, 8, 81, 8, 54);
    ctx.lineTo(8, 19.5);
    ctx.closePath();
    ctx.fillStyle = '#1D4ED8';
    ctx.fill();
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Brilho interno do escudo
    ctx.beginPath();
    ctx.moveTo(50, 12);
    ctx.lineTo(84, 24.5);
    ctx.lineTo(84, 53.5);
    ctx.bezierCurveTo(84, 75, 68.5, 91.5, 50, 98.5);
    ctx.bezierCurveTo(31.5, 91.5, 16, 75, 16, 53.5);
    ctx.lineTo(16, 24.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fill();

    // Círculo central com iniciais
    ctx.beginPath();
    ctx.arc(50, 48, 21, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#1D4ED8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const initials = (data.teamName || 'FP')
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    ctx.fillStyle = '#1D4ED8';
    ctx.textAlign = 'center';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.fillText(initials, 50, 55);

    // Estrela dourada do escudo
    drawStar(ctx, 50, 83, 5, 8, 3.8);
    ctx.fillStyle = '#FACC15';
    ctx.fill();
  }
  ctx.restore();

  // --- NOMES DO MESMO TAMANHO EM DESTAQUE ---
  const namesY = itemY + itemSize + 55;

  // Nome do Atleta (Coluna 1)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 12;
  let athleteFontSize = 44;
  ctx.font = `900 ${athleteFontSize}px "Oswald", system-ui, sans-serif`;
  while (ctx.measureText(data.displayName.toUpperCase()).width > maxColWidth && athleteFontSize > 24) {
    athleteFontSize -= 2;
    ctx.font = `900 ${athleteFontSize}px "Oswald", system-ui, sans-serif`;
  }
  ctx.fillText(data.displayName.toUpperCase(), col1CenterX, namesY);
  ctx.restore();

  // Nome do Time (Coluna 2 - do mesmo tamanho base)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FACC15';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 12;
  let teamFontSize = 44;
  ctx.font = `900 ${teamFontSize}px "Oswald", system-ui, sans-serif`;
  while (ctx.measureText(data.teamName.toUpperCase()).width > maxColWidth && teamFontSize > 24) {
    teamFontSize -= 2;
    ctx.font = `900 ${teamFontSize}px "Oswald", system-ui, sans-serif`;
  }
  ctx.fillText(data.teamName.toUpperCase(), col2CenterX, namesY);
  ctx.restore();

  // 7. POSIÇÃO, PÉ DOMINANTE E CIDADE EM LINHA COMPACTA
  ctx.save();
  const infoY = namesY + 48;
  ctx.textAlign = 'center';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillStyle = '#93C5FD';

  const positionLabel =
    data.position === 'goleiro'
      ? '🧤 Goleiro'
      : `🏃 ${data.position.charAt(0).toUpperCase() + data.position.slice(1)}`;
  const footLabel = `Pé ${data.dominantFoot.charAt(0).toUpperCase() + data.dominantFoot.slice(1)}`;
  const cityLabel = data.cityName;

  ctx.fillText(`${positionLabel}   ·   ${footLabel}   ·   ${cityLabel}`, WIDTH / 2, infoY);
  ctx.restore();

  // 9. AVALIAÇÃO EM ESTRELAS (PILL CENTRAL IDÊNTICO AO APP)
  ctx.save();
  const starsPillY = infoY + 45;
  const starsPillW = 380;
  const starsPillH = 64;
  const starsPillX = (WIDTH - starsPillW) / 2;

  // Fundo âmbar translúcido
  roundRect(ctx, starsPillX, starsPillY, starsPillW, starsPillH, 32);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 5 Estrelas
  const starSize = 18;
  const starGap = 34;
  const starsStartX = starsPillX + 28;
  const starsCenterY = starsPillY + starsPillH / 2;

  for (let s = 1; s <= 5; s++) {
    const isFilled = data.overallStars > 0 && s <= Math.round(data.overallStars);
    const sx = starsStartX + (s - 1) * starGap;

    ctx.save();
    if (isFilled) {
      ctx.fillStyle = '#FACC15';
      ctx.shadowColor = 'rgba(250, 204, 21, 0.8)';
      ctx.shadowBlur = 10;
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    }
    drawStar(ctx, sx, starsCenterY, 5, starSize, starSize / 2.3);
    ctx.fill();
    ctx.restore();
  }

  // Nota Overall
  ctx.textAlign = 'left';
  ctx.font = '900 28px font-mono, monospace';
  ctx.fillStyle = '#FDE047';
  ctx.fillText(`${(data.overallStars || 0).toFixed(1)} ⭐`, starsStartX + 5 * starGap + 12, starsCenterY + 9);

  // Selo de verificado com check
  if (data.overallStars > 0) {
    const checkBadgeX = starsPillX + starsPillW - 54;
    const checkBadgeY = starsCenterY - 16;
    roundRect(ctx, checkBadgeX, checkBadgeY, 34, 32, 10);
    ctx.fillStyle = 'rgba(6, 78, 59, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.fillStyle = '#34D399';
    ctx.fillText('✓', checkBadgeX + 17, checkBadgeY + 22);
  }
  ctx.restore();

  // 10. QUESITOS DE HABILIDADE EM 5 COLUNAS (IDÊNTICO AO APP)
  let nextSectionY = starsPillY + starsPillH + 35;

  if (data.overallStars > 0 && data.skills) {
    ctx.save();
    const skillsBoxX = cardX + 40;
    const skillsBoxW = cardW - 80;
    const skillsBoxH = 96;

    roundRect(ctx, skillsBoxX, nextSectionY, skillsBoxW, skillsBoxH, 20);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const skillsItems = [
      { label: 'FIN', val: data.skills.finalizacao },
      { label: 'MAR', val: data.skills.marcacao },
      { label: 'PAS', val: data.skills.passe },
      { label: 'RAÇ', val: data.skills.raca },
      { label: 'DRI', val: data.skills.drible },
    ];

    const colW = skillsBoxW / 5;
    skillsItems.forEach((sk, idx) => {
      const cx = skillsBoxX + idx * colW + colW / 2;

      ctx.textAlign = 'center';
      ctx.font = '800 16px system-ui, sans-serif';
      ctx.fillStyle = '#93C5FD';
      ctx.fillText(sk.label, cx, nextSectionY + 36);

      ctx.font = '900 28px font-mono, monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText(`${sk.val}★`, cx, nextSectionY + 76);

      // Divisória vertical
      if (idx < 4) {
        ctx.beginPath();
        ctx.moveTo(skillsBoxX + (idx + 1) * colW, nextSectionY + 16);
        ctx.lineTo(skillsBoxX + (idx + 1) * colW, nextSectionY + skillsBoxH - 16);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    ctx.restore();
    nextSectionY += skillsBoxH + 35;
  }

  // 11. PAINEL DE MÉTRICAS OFICIAIS (GRADE 3 COLUNAS IDÊNTICA AO APP)
  const metricsBoxX = cardX + 40;
  const metricsBoxW = cardW - 80;
  const metricsBoxH = 210;

  ctx.save();
  roundRect(ctx, metricsBoxX, nextSectionY, metricsBoxW, metricsBoxH, 24);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Linhas divisórias verticais
  ctx.beginPath();
  ctx.moveTo(metricsBoxX + metricsBoxW / 3, nextSectionY + 25);
  ctx.lineTo(metricsBoxX + metricsBoxW / 3, nextSectionY + metricsBoxH - 25);
  ctx.moveTo(metricsBoxX + (metricsBoxW / 3) * 2, nextSectionY + 25);
  ctx.lineTo(metricsBoxX + (metricsBoxW / 3) * 2, nextSectionY + metricsBoxH - 25);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';

  // Coluna 1: GOLS (MÉDIA)
  const mCol1X = metricsBoxX + metricsBoxW / 6;
  ctx.font = '800 18px system-ui, sans-serif';
  ctx.fillStyle = '#93C5FD';
  ctx.fillText('GOLS (MÉDIA)', mCol1X, nextSectionY + 52);

  ctx.font = '900 italic 56px font-mono, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${data.goals}`, mCol1X, nextSectionY + 125);

  ctx.font = '700 20px font-mono, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText(`(${data.goalsAvg} média)`, mCol1X, nextSectionY + 172);

  // Coluna 2: PRESENÇAS
  const mCol2X = metricsBoxX + metricsBoxW / 2;
  ctx.font = '800 18px system-ui, sans-serif';
  ctx.fillStyle = '#93C5FD';
  ctx.fillText('PRESENÇAS', mCol2X, nextSectionY + 52);

  ctx.font = '900 italic 56px font-mono, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${data.matchesPlayed}J`, mCol2X, nextSectionY + 125);

  ctx.font = '700 20px font-mono, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('Na Temporada', mCol2X, nextSectionY + 172);

  // Coluna 3: SUPER CAPAS (ou CAPAS GK)
  const mCol3X = metricsBoxX + (metricsBoxW / 6) * 5;
  ctx.font = '800 18px system-ui, sans-serif';
  ctx.fillStyle = '#93C5FD';
  ctx.fillText((data.capaLabel || 'Super Capas').toUpperCase(), mCol3X, nextSectionY + 52);

  ctx.font = '900 italic 56px font-mono, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${data.superCapas}`, mCol3X, nextSectionY + 125);

  ctx.font = '700 20px font-mono, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText(`(${data.capaPct}% aprov.)`, mCol3X, nextSectionY + 172);
  ctx.restore();

  // 12. BADGES DISCIPLINARES (AMARELOS, AZUIS E VERMELHOS IDÊNTICOS AO APP)
  const discY = nextSectionY + metricsBoxH + 35;
  const badgeW = 265;
  const badgeH = 68;
  const badgeGap = 20;
  const totalBadgesW = 3 * badgeW + 2 * badgeGap;
  const startDiscX = (WIDTH - totalBadgesW) / 2;

  // Badge Amarelos
  ctx.save();
  const dX1 = startDiscX;
  roundRect(ctx, dX1, discY, badgeW, badgeH, 20);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '900 22px font-mono, monospace';
  ctx.fillStyle = '#FEF3C7';
  ctx.fillText(`🟨 ${data.yellowCards} AMARELOS`, dX1 + badgeW / 2, discY + 43);

  // Badge Azuis
  const dX2 = startDiscX + badgeW + badgeGap;
  roundRect(ctx, dX2, discY, badgeW, badgeH, 20);
  ctx.fillStyle = 'rgba(59, 130, 246, 0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '900 22px font-mono, monospace';
  ctx.fillStyle = '#DBEAFE';
  ctx.fillText(`🟦 ${data.blueCards} AZUIS`, dX2 + badgeW / 2, discY + 43);

  // Badge Vermelhos
  const dX3 = startDiscX + (badgeW + badgeGap) * 2;
  roundRect(ctx, dX3, discY, badgeW, badgeH, 20);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '900 22px font-mono, monospace';
  ctx.fillStyle = '#FEE2E2';
  ctx.fillText(`🟥 ${data.redCards ?? 0} VERMELHOS`, dX3 + badgeW / 2, discY + 43);
  ctx.restore();

  // 13. SELO DE AUTENTICIDADE NO RODAPÉ DO CARD
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('⚽ IDENTIDADE DIGITAL OFICIAL · FUTPLAY LITE', WIDTH / 2, cardY + cardH - 45);
  ctx.restore();

  // 14. RODAPÉ INFERIOR DO STATUS / STORY (9:16)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('📱 COMPARTILHADO VIA FUTPLAY LITE', WIDTH / 2, HEIGHT - 55);
  ctx.restore();

  // Exporta como Data URL e como Blob/File
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

  const sanitizedName = data.displayName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-');

  const file = new File([blob], `cartao-${sanitizedName}-futplay.png`, {
    type: 'image/png',
  });

  return { dataUrl, blob, file };
}
