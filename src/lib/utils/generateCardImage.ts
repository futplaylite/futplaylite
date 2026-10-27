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
 * Gera uma imagem 9:16 (1080x1920) em alta resolução do Cartão Oficial do Atleta.
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
  const [avatarImg, crestImg] = await Promise.all([
    loadImageSafe(data.avatarUrl),
    loadImageSafe(data.teamCrestUrl),
  ]);

  // 1. FUNDO GERAL (Gradiente Profundo 9:16)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, '#060B1E');
  bgGrad.addColorStop(0.25, '#0F1D40');
  bgGrad.addColorStop(0.5, '#172B5E');
  bgGrad.addColorStop(0.75, '#0D1B3E');
  bgGrad.addColorStop(1, '#050A1A');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Efeitos de Iluminação Radial no Fundo
  const radialAura1 = ctx.createRadialGradient(WIDTH / 2, 350, 40, WIDTH / 2, 350, 600);
  radialAura1.addColorStop(0, 'rgba(59, 130, 246, 0.28)');
  radialAura1.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.fillStyle = radialAura1;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const radialAura2 = ctx.createRadialGradient(WIDTH / 2, 1100, 50, WIDTH / 2, 1100, 700);
  radialAura2.addColorStop(0, 'rgba(99, 102, 241, 0.22)');
  radialAura2.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = radialAura2;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Marca d'água elegante de campo de futebol no fundo
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 4;
  // Círculo central
  ctx.beginPath();
  ctx.arc(WIDTH / 2, HEIGHT / 2, 380, 0, Math.PI * 2);
  ctx.stroke();
  // Linha do meio campo
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT / 2);
  ctx.lineTo(WIDTH, HEIGHT / 2);
  ctx.stroke();
  ctx.restore();

  // 2. CABEÇALHO DO STATUS / STORY (Acima do Cartão)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FACC15';
  ctx.font = '900 42px "Oswald", "Montserrat", system-ui, sans-serif';
  ctx.fillText('FUTPLAY LITE', WIDTH / 2, 95);

  ctx.fillStyle = '#93C5FD';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('LIGA DE FUTEBOL AMADOR · STATUS OFICIAL', WIDTH / 2, 135);
  ctx.restore();

  // 3. O CARD CENTRAL DO ATLETA (Hero Player Card)
  const cardX = 70;
  const cardY = 175;
  const cardW = 940;
  const cardH = 1580;
  const cardR = 48;

  // Sombra suave do cartão
  ctx.save();
  ctx.shadowColor = 'rgba(30, 58, 138, 0.7)';
  ctx.shadowBlur = 45;
  ctx.shadowOffsetY = 15;
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
  const cardFill = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardFill.addColorStop(0, '#1E40AF');
  cardFill.addColorStop(0.3, '#1E3A8A');
  cardFill.addColorStop(0.7, '#172554');
  cardFill.addColorStop(1, '#0B132B');
  ctx.fillStyle = cardFill;
  ctx.fill();
  ctx.restore();

  // Borda Dourada com Gradiente do Cartão
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
  const goldBorder = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  goldBorder.addColorStop(0, '#FDE047');
  goldBorder.addColorStop(0.4, '#EAB308');
  goldBorder.addColorStop(0.7, '#CA8A04');
  goldBorder.addColorStop(1, '#FDE047');
  ctx.strokeStyle = goldBorder;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  // Linha interna suave
  ctx.save();
  roundRect(ctx, cardX + 10, cardY + 10, cardW - 20, cardH - 20, cardR - 8);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 4. TOPO INTERNO DO CARTÃO
  ctx.save();
  // Selo "Cartão Oficial"
  ctx.fillStyle = '#DBEAFE';
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⭐ CARTÃO OFICIAL DE ATLETA', cardX + 50, cardY + 70);

  ctx.fillStyle = '#93C5FD';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText('TEMPORADA 2026', cardX + 50, cardY + 105);

  // Brasão do Time no Topo Direito do Cartão
  const crestSize = 95;
  const crestX = cardX + cardW - 50 - crestSize;
  const crestY = cardY + 35;

  if (crestImg) {
    ctx.drawImage(crestImg, crestX, crestY, crestSize, crestSize);
  } else {
    // Desenha escudo vetorial elegante do time
    ctx.save();
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.arc(crestX + crestSize / 2, crestY + crestSize / 2, crestSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FACC15';
    ctx.stroke();

    const teamInitials = (data.teamName || 'FC')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 34px "Oswald", system-ui, sans-serif';
    ctx.fillText(teamInitials, crestX + crestSize / 2, crestY + crestSize / 2);
    ctx.restore();
  }
  ctx.restore();

  // Linha divisória interna superior
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 45, cardY + 150);
  ctx.lineTo(cardX + cardW - 45, cardY + 150);
  ctx.stroke();
  ctx.restore();

  // 5. FOTO DO ATLETA (Hero Avatar em Moldura Grande)
  const avatarCenterX = WIDTH / 2;
  const avatarCenterY = cardY + 340;
  const avatarRadius = 145;

  // Sombra e anel dourado do avatar
  ctx.save();
  ctx.shadowColor = 'rgba(250, 204, 21, 0.45)';
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 6, 0, Math.PI * 2);
  const ringGrad = ctx.createLinearGradient(
    avatarCenterX - avatarRadius,
    avatarCenterY - avatarRadius,
    avatarCenterX + avatarRadius,
    avatarCenterY + avatarRadius
  );
  ringGrad.addColorStop(0, '#FDE047');
  ringGrad.addColorStop(0.5, '#EAB308');
  ringGrad.addColorStop(1, '#CA8A04');
  ctx.fillStyle = ringGrad;
  ctx.fill();
  ctx.restore();

  // Foto recortada ou iniciais
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
  ctx.clip();

  if (avatarImg) {
    ctx.drawImage(
      avatarImg,
      avatarCenterX - avatarRadius,
      avatarCenterY - avatarRadius,
      avatarRadius * 2,
      avatarRadius * 2
    );
  } else {
    // Fundo branco com iniciais
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(
      avatarCenterX - avatarRadius,
      avatarCenterY - avatarRadius,
      avatarRadius * 2,
      avatarRadius * 2
    );
    ctx.fillStyle = '#1E3A8A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 95px "Oswald", system-ui, sans-serif';
    ctx.fillText(
      data.displayName.slice(0, 2).toUpperCase(),
      avatarCenterX,
      avatarCenterY
    );
  }
  ctx.restore();

  // 6. NOME DO ATLETA & INFORMAÇÕES
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 64px "Oswald", system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillText(data.displayName.toUpperCase(), WIDTH / 2, cardY + 560);

  // Badge da Posição e Pé Dominante
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillStyle = '#93C5FD';
  const positionText =
    data.position === 'goleiro'
      ? '🧤 GOLEIRO'
      : `🏃 ${data.position.toUpperCase()}`;
  ctx.fillText(
    `${positionText}  ·  PÉ ${data.dominantFoot.toUpperCase()}`,
    WIDTH / 2,
    cardY + 615
  );

  // Nome do Time & Município
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillStyle = '#FDE047';
  ctx.fillText(data.teamName.toUpperCase(), WIDTH / 2, cardY + 665);

  ctx.font = '500 22px system-ui, sans-serif';
  ctx.fillStyle = '#E2E8F0';
  ctx.fillText(data.cityName, WIDTH / 2, cardY + 705);
  ctx.restore();

  // 7. AVALIAÇÃO EM ESTRELAS & NOTA OVERALL
  ctx.save();
  const starsY = cardY + 775;
  const starSize = 24;
  const starGap = 56;
  const totalStarsW = 5 * starGap;
  const startStarX = WIDTH / 2 - totalStarsW / 2 + starSize;

  for (let s = 1; s <= 5; s++) {
    const isFilled = data.overallStars > 0 && s <= Math.round(data.overallStars);
    const starX = startStarX + (s - 1) * starGap;

    ctx.save();
    if (isFilled) {
      ctx.fillStyle = '#FACC15';
      ctx.shadowColor = 'rgba(250, 204, 21, 0.8)';
      ctx.shadowBlur = 15;
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    }
    drawStar(ctx, starX, starsY, 5, starSize, starSize / 2.3);
    ctx.fill();
    ctx.restore();
  }

  // Nota numérica ao lado das estrelas
  ctx.fillStyle = '#FDE047';
  ctx.font = '900 36px font-mono, system-ui, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${(data.overallStars || 0).toFixed(1)} ⭐`,
    WIDTH / 2,
    starsY + 60
  );
  ctx.restore();

  // 8. QUESITOS DE HABILIDADE (Fin, Mar, Pas, Raç, Dri)
  if (data.overallStars > 0 && data.skills) {
    ctx.save();
    const skillsY = cardY + 890;
    const skillsList = [
      { label: 'FIN', val: data.skills.finalizacao },
      { label: 'MAR', val: data.skills.marcacao },
      { label: 'PAS', val: data.skills.passe },
      { label: 'RAÇ', val: data.skills.raca },
      { label: 'DRI', val: data.skills.drible },
    ];
    const skillW = 145;
    const skillGap = 18;
    const totalSkillsW = 5 * skillW + 4 * skillGap;
    const startSkillX = (WIDTH - totalSkillsW) / 2;

    skillsList.forEach((sk, idx) => {
      const sx = startSkillX + idx * (skillW + skillGap);
      // Fundo do pill
      roundRect(ctx, sx, skillsY, skillW, 70, 16);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Texto
      ctx.textAlign = 'center';
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillStyle = '#93C5FD';
      ctx.fillText(sk.label, sx + skillW / 2, skillsY + 28);

      ctx.font = '900 24px font-mono, system-ui, monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText(`${sk.val}★`, sx + skillW / 2, skillsY + 56);
    });
    ctx.restore();
  }

  // 9. PAINEL DE ESTATÍSTICAS OFICIAIS (Grade 3 Colunas)
  const statsBoxX = cardX + 45;
  const statsBoxY = cardY + 995;
  const statsBoxW = cardW - 90;
  const statsBoxH = 260;

  ctx.save();
  roundRect(ctx, statsBoxX, statsBoxY, statsBoxW, statsBoxH, 28);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Linhas divisórias verticais
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(statsBoxX + statsBoxW / 3, statsBoxY + 25);
  ctx.lineTo(statsBoxX + statsBoxW / 3, statsBoxY + statsBoxH - 25);
  ctx.moveTo(statsBoxX + (statsBoxW / 3) * 2, statsBoxY + 25);
  ctx.lineTo(statsBoxX + (statsBoxW / 3) * 2, statsBoxY + statsBoxH - 25);
  ctx.stroke();

  ctx.textAlign = 'center';

  // Coluna 1: GOLS
  const col1X = statsBoxX + statsBoxW / 6;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillStyle = '#93C5FD';
  ctx.fillText('GOLS (MÉDIA)', col1X, statsBoxY + 60);

  ctx.font = '900 64px font-mono, system-ui, monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${data.goals}`, col1X, statsBoxY + 145);

  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText(`${data.goalsAvg} / jogo`, col1X, statsBoxY + 205);

  // Coluna 2: PRESENÇAS
  const col2X = statsBoxX + statsBoxW / 2;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillStyle = '#93C5FD';
  ctx.fillText('PRESENÇAS', col2X, statsBoxY + 60);

  ctx.font = '900 64px font-mono, system-ui, monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${data.matchesPlayed}J`, col2X, statsBoxY + 145);

  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('Na Temporada', col2X, statsBoxY + 205);

  // Coluna 3: SUPER CAPAS
  const col3X = statsBoxX + (statsBoxW / 6) * 5;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillStyle = '#93C5FD';
  ctx.fillText(data.capaLabel.toUpperCase(), col3X, statsBoxY + 60);

  ctx.font = '900 64px font-mono, system-ui, monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${data.superCapas}`, col3X, statsBoxY + 145);

  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText(`${data.capaPct}% aprov.`, col3X, statsBoxY + 205);
  ctx.restore();

  // 10. DISCIPLINA (Amarelos, Azuis e Vermelhos)
  ctx.save();
  const discY = cardY + 1295;
  const badgeW = 260;
  const badgeH = 65;
  const badgeGap = 20;
  const totalBadgesW = 3 * badgeW + 2 * badgeGap; // 780 + 40 = 820px
  const startDiscX = WIDTH / 2 - totalBadgesW / 2;

  // Badge Amarelos
  const discX1 = startDiscX;
  roundRect(ctx, discX1, discY, badgeW, badgeH, 18);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillStyle = '#FEF3C7';
  ctx.textAlign = 'center';
  ctx.fillText(`🟨 ${data.yellowCards} AMARELOS`, discX1 + badgeW / 2, discY + 41);

  // Badge Azuis
  const discX2 = startDiscX + badgeW + badgeGap;
  roundRect(ctx, discX2, discY, badgeW, badgeH, 18);
  ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillStyle = '#DBEAFE';
  ctx.textAlign = 'center';
  ctx.fillText(`🟦 ${data.blueCards} AZUIS`, discX2 + badgeW / 2, discY + 41);

  // Badge Vermelhos
  const discX3 = startDiscX + (badgeW + badgeGap) * 2;
  roundRect(ctx, discX3, discY, badgeW, badgeH, 18);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillStyle = '#FEE2E2';
  ctx.textAlign = 'center';
  ctx.fillText(`🟥 ${data.redCards ?? 0} VERMELHOS`, discX3 + badgeW / 2, discY + 41);
  ctx.restore();

  // 11. SELO DE AUTENTICIDADE NO RODAPÉ DO CARTÃO
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillText('⚽ IDENTIDADE DIGITAL OFICIAL · FUTPLAY LITE', WIDTH / 2, cardY + 1480);
  ctx.restore();

  // 12. RODAPÉ INFERIOR DO STATUS / STORY (9:16)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('📱 COMPARTILHADO VIA FUTPLAY LITE', WIDTH / 2, HEIGHT - 95);

  ctx.font = '500 20px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText('WhatsApp Status · Instagram Stories · Redes Sociais', WIDTH / 2, HEIGHT - 55);
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
