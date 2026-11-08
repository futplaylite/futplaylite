import { SumulaData } from '../../components/SumulaPeladaView';

export interface SumulaReceiptImageData {
  sumula: SumulaData;
  teamName?: string;
  venueName?: string;
}

export async function generateSumulaReceiptImage(
  data: SumulaReceiptImageData
): Promise<{ dataUrl: string; file: File }> {
  const { sumula, teamName = 'Real Planalto FC', venueName = 'Arena Planalto Society' } = data;

  const width = 1080;
  const height = 1520;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível obter o contexto 2D do Canvas');
  }

  // 1. Fundo Gradiente Escuro com Profundidade
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#0a1738');
  bgGrad.addColorStop(0.35, '#071126');
  bgGrad.addColorStop(0.7, '#040916');
  bgGrad.addColorStop(1, '#02050c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Efeito Refletor Luminoso Superior
  const glowGrad = ctx.createRadialGradient(width / 2, 0, 10, width / 2, 0, 600);
  glowGrad.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
  glowGrad.addColorStop(0.5, 'rgba(37, 99, 235, 0.15)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, width, 700);

  // Linhas geométricas de campo decorativas sutis
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 280, 0, Math.PI * 2);
  ctx.stroke();

  // Borda externa com chanfro
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, width - 56, height - 56);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(36, 36, width - 72, height - 72);

  // 2. Cabeçalho Oficial
  // Badge Superior
  ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
  roundRect(ctx, width / 2 - 200, 56, 400, 38, 19);
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, width / 2 - 200, 56, 400, 38, 19);
  ctx.stroke();

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '2px';
  ctx.fillText('⚽ COMPROVANTE OFICIAL DE SÚMULA ⚽', width / 2, 81);

  // Título da Liga
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('FUTPLAY LITE · ROSÁLIA ESPORTES', width / 2, 138);

  // Subtítulo e Time
  ctx.fillStyle = '#93c5fd';
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Pelada Oficial · ${teamName}`, width / 2, 172);

  // Card com Data, Horário e Local
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  roundRect(ctx, 60, 202, width - 120, 68, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  roundRect(ctx, 60, 202, width - 120, 68, 16);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `📅 Data: ${sumula.matchDate || 'Hoje'}   ·   ⏰ Início: ${sumula.startTime || '16:00'}h   ·   📍 ${venueName}`,
    width / 2,
    243
  );

  // 3. Cálculo de Resultados da Súmula
  const teamsStats = (sumula.teamsGrid || []).map((row) => {
    const wins = (row.matches || []).filter((m) => m === 'V').length;
    const draws = (row.matches || []).filter((m) => m === 'E').length;
    const points = wins * 3 + draws * 1;

    const lineup = (sumula.teamLineups && sumula.teamLineups[row.teamName]) || [];
    const totalGoals = lineup.reduce((acc, p) => acc + (Number(p.goals) || 0), 0);

    return {
      teamName: row.teamName,
      wins,
      draws,
      points,
      totalGoals,
      lineup,
    };
  });

  // Ordena por Pontos > Vitórias > Gols
  teamsStats.sort((a, b) => b.points - a.points || b.wins - a.wins || b.totalGoals - a.totalGoals);

  const championTeam = teamsStats[0];

  // 4. Card Destaque: Time Campeão / Super Capas
  let currentY = 295;
  if (championTeam) {
    const champGrad = ctx.createLinearGradient(60, currentY, width - 60, currentY + 130);
    champGrad.addColorStop(0, '#854d0e');
    champGrad.addColorStop(0.5, '#ca8a04');
    champGrad.addColorStop(1, '#a16207');
    ctx.fillStyle = champGrad;
    roundRect(ctx, 60, currentY, width - 120, 120, 18);
    ctx.fill();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    roundRect(ctx, 60, currentY, width - 120, 120, 18);
    ctx.stroke();

    ctx.fillStyle = '#fef9c3';
    ctx.font = '900 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🏆 TIME CAMPEÃO DA SÚMULA / SUPER CAPAS', 90, currentY + 38);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(championTeam.teamName.toUpperCase(), 90, currentY + 84);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${championTeam.points} PONTOS`, width - 90, currentY + 68);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${championTeam.wins}V · ${championTeam.draws}E · ${championTeam.totalGoals} Gols`, width - 90, currentY + 96);
  }

  currentY += 140;

  // 5. Tabela de Classificação dos Times
  ctx.fillStyle = '#fde68a';
  ctx.font = '900 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('📊 CLASSIFICAÇÃO GERAL DOS TIMES', 64, currentY + 16);

  currentY += 30;

  // Cabeçalho da Tabela
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  roundRect(ctx, 60, currentY, width - 120, 36, 10);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('POS / TIME', 84, currentY + 23);
  ctx.textAlign = 'center';
  ctx.fillText('V', 660, currentY + 23);
  ctx.fillText('E', 740, currentY + 23);
  ctx.fillText('GOLS', 830, currentY + 23);
  ctx.fillText('PTS', 940, currentY + 23);

  currentY += 44;

  // Linhas dos Times
  teamsStats.forEach((t, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)';
    roundRect(ctx, 60, currentY, width - 120, 48, 10);
    ctx.fill();

    // Pos
    ctx.fillStyle = idx === 0 ? '#fbbf24' : '#e2e8f0';
    ctx.font = '900 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${idx + 1}º`, 84, currentY + 30);

    // Nome do Time
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(t.teamName, 130, currentY + 30);

    // Números
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(String(t.wins), 660, currentY + 30);
    ctx.fillText(String(t.draws), 740, currentY + 30);
    ctx.fillText(String(t.totalGoals), 830, currentY + 30);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(String(t.points), 940, currentY + 30);

    currentY += 56;
  });

  currentY += 20;

  // 6. Artilharia & Gols da Rodada
  const allScorers: { name: string; goals: number; team: string }[] = [];
  Object.entries(sumula.teamLineups || {}).forEach(([team, players]) => {
    players.forEach((p) => {
      const g = Number(p.goals) || 0;
      if (g > 0) {
        allScorers.push({ name: p.player, goals: g, team });
      }
    });
  });

  allScorers.sort((a, b) => b.goals - a.goals);

  ctx.fillStyle = '#fde68a';
  ctx.font = '900 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🎯 ARTILHARIA & GOLS REGISTRADOS', 64, currentY + 16);

  currentY += 30;

  if (allScorers.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    roundRect(ctx, 60, currentY, width - 120, 50, 10);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhum gol individual anotado nesta súmula.', width / 2, currentY + 31);
    currentY += 60;
  } else {
    // Exibe até os 5 maiores artilheiros
    const topScorers = allScorers.slice(0, 5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    const boxHeight = topScorers.length * 42 + 20;
    roundRect(ctx, 60, currentY, width - 120, boxHeight, 14);
    ctx.fill();

    let scorerY = currentY + 30;
    topScorers.forEach((sc, i) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = i === 0 ? '#f59e0b' : '#cbd5e1';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${i + 1}. ${sc.name.toUpperCase()}`, 84, scorerY);

      ctx.fillStyle = '#64748b';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`(${sc.team})`, 320, scorerY);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#34d399';
      ctx.font = '900 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`⚽ ${sc.goals} gol${sc.goals > 1 ? 's' : ''}`, width - 84, scorerY);

      scorerY += 40;
    });

    currentY += boxHeight + 20;
  }

  // 7. Rodapé com Selo Oficial de Autenticidade
  const stampY = height - 190;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
  roundRect(ctx, 60, stampY, width - 120, 100, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 60, stampY, width - 120, 100, 16);
  ctx.stroke();

  // Carimbo Verde
  ctx.fillStyle = '#10b981';
  ctx.font = '900 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('✅ REGISTRO GRAVADO E VALIDADO OFICIALMENTE', 90, stampY + 38);

  const hashId = `SUM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Código de Autenticação: ${hashId}   ·   Gravado às ${timeStr}`, 90, stampY + 68);

  // Link inferior
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Sistema FutPlay Lite · Liga Oficial de Futebol Society e Peladas', width / 2, height - 42);

  // Exportar Data URL e File
  const dataUrl = canvas.toDataURL('image/png', 0.95);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Erro ao converter Canvas em Blob'));
          return;
        }
        const file = new File([blob], `comprovante-sumula-${sumula.id || 'oficial'}.png`, {
          type: 'image/png',
        });
        resolve({ dataUrl, file });
      },
      'image/png',
      0.95
    );
  });
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
