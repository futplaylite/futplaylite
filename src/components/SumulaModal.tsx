import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';

interface SumulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (sumulaData: any) => void;
}

export const SumulaModal: React.FC<SumulaModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { profiles } = useLeague();

  // Cabeçalho da súmula
  const [matchDate, setMatchDate] = useState<string>(
    new Date().toLocaleDateString('pt-BR')
  );
  const [startTime, setStartTime] = useState<string>('20:15');

  // 1. Lista Ordem de Chegada (com Goleiros e Linha)
  const [arrivalList, setArrivalList] = useState<
    { order: number; playerName: string; confirmed: boolean; note?: string; isGoalkeeper?: boolean }[]
  >(() => {
    return [
      { order: 1, playerName: 'PALITO', confirmed: true, isGoalkeeper: true },
      { order: 2, playerName: 'EMERSOM GOLEIRO', confirmed: true, isGoalkeeper: true },
      { order: 3, playerName: 'MANELÃO', confirmed: true, isGoalkeeper: true },
      { order: 4, playerName: 'RAFAEL GOLEIROS', confirmed: true, isGoalkeeper: true },
      { order: 5, playerName: 'JUNIOR (GANSO)', confirmed: true },
      { order: 6, playerName: 'MARLOM', confirmed: true },
      { order: 7, playerName: 'ROBSOM', confirmed: true },
      { order: 8, playerName: 'SEVERINO', confirmed: true },
      { order: 9, playerName: 'YAGO', confirmed: true },
      { order: 10, playerName: 'ELIZEU (ZEU)', confirmed: true },
      { order: 11, playerName: 'DEDA', confirmed: true },
      { order: 12, playerName: 'HUGO PAÇOCA', confirmed: true },
      { order: 13, playerName: 'RAFAEL (RAFA)', confirmed: true },
      { order: 14, playerName: 'HENRIQUE', confirmed: true },
      { order: 15, playerName: 'JUACY', confirmed: true },
      { order: 16, playerName: 'MAILOM', confirmed: true },
      { order: 17, playerName: 'CARLOS', confirmed: true },
      { order: 18, playerName: 'TEI (SUJO)', confirmed: true },
      { order: 19, playerName: 'DAMIÃO', confirmed: true },
      { order: 20, playerName: 'DAYVID', confirmed: true },
      { order: 21, playerName: 'GLEISOM', confirmed: true },
      { order: 22, playerName: 'JASOM', confirmed: true },
      { order: 23, playerName: 'MELQUIZ', confirmed: true },
      { order: 24, playerName: 'PITBUL', confirmed: true },
    ];
  });

  const [newArrivalName, setNewArrivalName] = useState('');

  // 2. Lista de Cartões (Amarelo, Azul, Vermelho)
  const [yellowCards, setYellowCards] = useState<string[]>([
    'YAGO',
    'RAFAEL (RAFA)',
    'ELIZEU (ZEU)',
    'HENRIQUE',
    'GLEISOM',
  ]);
  const [blueCards, setBlueCards] = useState<string[]>([]);
  const [redCards, setRedCards] = useState<string[]>([]);

  const [newCardPlayer, setNewCardPlayer] = useState('');
  const [selectedCardType, setSelectedCardType] = useState<
    'amarelo' | 'azul' | 'vermelho'
  >('amarelo');

  // 3. Goleiros Fixos (Sincronizados automaticamente com a presença)
  const [goalkeepers, setGoalkeepers] = useState<
    { num: string; name: string }[]
  >([
    { num: '01', name: 'PALITO' },
    { num: '02', name: 'EMERSOM GOLEIRO' },
    { num: '03', name: 'MANELÃO' },
    { num: '04', name: 'RAFAEL GOLEIROS' },
  ]);

  // 4. Grade de Pontos dos Times (Rodadas / Partidas)
  // Time 01 a Time 04, cada um com array de resultados: 'V', 'E', '-'
  const [teamsGrid, setTeamsGrid] = useState<
    { teamName: string; matches: string[] }[]
  >([
    { teamName: 'Time 01', matches: ['-', '-', 'V', 'E', '-', '-', 'E', '-', '-', '-', 'V'] },
    { teamName: 'Time 02', matches: ['V', 'V', 'V', '-', 'V', '-', '-', 'E', '-', 'V', 'V'] },
    { teamName: 'Time 03', matches: ['-', '-', '-', 'E', '-', 'V', 'V', 'E', '-', '-', '-'] },
    { teamName: 'Time 04', matches: ['-', '-', '-', '-', '-', '-', 'E', '-', 'V', '-', '-'] },
  ]);

  // 5. Escalação dos 4 Times com Gols anotados
  const [teamLineups, setTeamLineups] = useState<{
    [key: string]: { player: string; goals: number | string; isSub?: boolean }[];
  }>({
    'Time 01': [
      { player: 'JUNIOR (GANSO)', goals: 1 },
      { player: 'PITBUL', goals: 0 },
      { player: 'HUGO PAÇOCA', goals: 1 },
      { player: 'CARLOS', goals: 0 },
      { player: 'ROBSOM', goals: 0 },
      { player: 'DAMIÃO', goals: 0, isSub: true },
      { player: 'GEO', goals: 1, isSub: true },
    ],
    'Time 02': [
      { player: 'DAYVID', goals: 3 },
      { player: 'HENRIQUE', goals: 1 },
      { player: 'MARLOM', goals: 1 },
      { player: 'GLEISOM', goals: 1 },
      { player: 'MAILOM', goals: 2 },
    ],
    'Time 03': [
      { player: 'SEVERINO', goals: 0 },
      { player: 'PITBUL', goals: 2 },
      { player: 'RAFAEL (RAFA)', goals: 2 },
      { player: 'JASOM', goals: 0 },
      { player: 'YAGO', goals: 1, isSub: true },
    ],
    'Time 04': [
      { player: 'TEI (SUJO)', goals: 0 },
      { player: 'MELQUIZ', goals: 4 },
      { player: 'JUACY', goals: 1 },
      { player: 'DEDA', goals: 0 },
      { player: 'ELIZEU (ZEU)', goals: 1, isSub: true },
    ],
  });

  // 6. Gols Destaque (Jogador | Hora)
  const [highlightGoals, setHighlightGoals] = useState<
    { player: string; time: string }[]
  >([
    { player: 'SEVERINO', time: '21:31' },
    { player: 'JUNIOR (GANSO)', time: '22:04' },
    { player: 'MELQUIZ', time: '22:05' },
  ]);
  const [newHighlightPlayer, setNewHighlightPlayer] = useState('');
  const [newHighlightTime, setNewHighlightTime] = useState('');

  if (!isOpen) return null;

  const handleAddArrival = () => {
    if (!newArrivalName.trim()) return;
    setArrivalList((prev) => [
      ...prev,
      {
        order: prev.length + 1,
        playerName: newArrivalName.trim().toUpperCase(),
        confirmed: true,
      },
    ]);
    setNewArrivalName('');
  };

  const handleToggleArrival = (idx: number) => {
    setArrivalList((prev) => {
      const updated = prev.map((item, i) =>
        i === idx ? { ...item, confirmed: !item.confirmed } : item
      );
      // Sincroniza Goleiros Fixos com os goleiros confirmados
      const confirmedGks = updated
        .filter(
          (a) =>
            a.confirmed &&
            (a.isGoalkeeper ||
              a.playerName.includes('GOLEIRO') ||
              ['PALITO', 'MANELÃO', 'RAFAEL GOLEIROS'].includes(a.playerName))
        )
        .map((a) => a.playerName);

      setGoalkeepers([
        { num: '01', name: confirmedGks[0] || '' },
        { num: '02', name: confirmedGks[1] || '' },
        { num: '03', name: confirmedGks[2] || '' },
        { num: '04', name: confirmedGks[3] || '' },
      ]);

      return updated;
    });
  };

  const handleAddCard = () => {
    if (!newCardPlayer.trim()) return;
    const name = newCardPlayer.trim().toUpperCase();
    if (selectedCardType === 'amarelo') {
      setYellowCards((prev) => [...prev, name]);
    } else if (selectedCardType === 'azul') {
      setBlueCards((prev) => [...prev, name]);
    } else {
      setRedCards((prev) => [...prev, name]);
    }
    setNewCardPlayer('');
  };

  const handleAddHighlightGoal = () => {
    if (!newHighlightPlayer.trim()) return;
    setHighlightGoals((prev) => [
      ...prev,
      {
        player: newHighlightPlayer.trim().toUpperCase(),
        time: newHighlightTime.trim() || '22:00',
      },
    ]);
    setNewHighlightPlayer('');
    setNewHighlightTime('');
  };

  const handleGoalChange = (teamKey: string, pIdx: number, delta: number) => {
    setTeamLineups((prev) => {
      const list = [...prev[teamKey]];
      const current = Number(list[pIdx].goals) || 0;
      const next = Math.max(0, current + delta);
      list[pIdx] = { ...list[pIdx], goals: next };
      return { ...prev, [teamKey]: list };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-[500px] rounded-2xl bg-white shadow-2xl border border-slate-300 text-slate-800 my-auto overflow-hidden">
        {/* Barra de Data e Início */}
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span>Data do Jogo:</span>
            <input
              type="text"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              className="w-24 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-center font-mono font-bold text-blue-900 focus:outline-blue-500"
            />
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>Início:</span>
            <input
              type="text"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-14 rounded border border-slate-300 bg-white px-1 py-0.5 text-center font-mono text-xs font-bold"
            />
          </div>
        </div>

        {/* Corpo da Prancheta estilo Papel */}
        <div className="p-3 space-y-4 max-h-[80vh] overflow-y-auto text-xs bg-[#fdfdfd]">
          {/* Seção 1: Lista de Cartões & Goleiros (Lado a Lado ou Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Lista de Cartões */}
            <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
              <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide">
                  Lista de Cartões
                </span>
                <span className="text-[10px] text-slate-400">
                  {yellowCards.length + blueCards.length + redCards.length} reg.
                </span>
              </div>

              {/* Amarelos */}
              <div className="space-y-1 mb-2">
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700">
                  <span className="h-3 w-2.5 rounded-2xs bg-amber-400 border border-amber-600 inline-block"></span>
                  Amarelo:
                </div>
                <div className="flex flex-wrap gap-1">
                  {yellowCards.map((p, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-900"
                    >
                      {p}
                      <button
                        onClick={() =>
                          setYellowCards((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-amber-500 hover:text-amber-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Azuis */}
              <div className="space-y-1 mb-2">
                <div className="flex items-center gap-1 text-[10px] font-bold text-blue-700">
                  <span className="h-3 w-2.5 rounded-2xs bg-blue-500 border border-blue-700 inline-block"></span>
                  Azul:
                </div>
                <div className="flex flex-wrap gap-1">
                  {blueCards.length === 0 ? (
                    <span className="text-[10px] text-slate-400 italic">
                      Nenhum
                    </span>
                  ) : (
                    blueCards.map((p, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[9px] font-bold text-blue-900"
                      >
                        {p}
                        <button
                          onClick={() =>
                            setBlueCards((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-blue-500 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Formulário rápido para adicionar cartão */}
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1">
                <select
                  value={selectedCardType}
                  onChange={(e: any) => setSelectedCardType(e.target.value)}
                  className="rounded border border-slate-200 bg-slate-50 text-[10px] p-1 font-bold"
                >
                  <option value="amarelo">🟨 Amarelo</option>
                  <option value="azul">🟦 Azul</option>
                  <option value="vermelho">🟥 Vermelho</option>
                </select>
                <input
                  type="text"
                  placeholder="Nome do atleta"
                  value={newCardPlayer}
                  onChange={(e) => setNewCardPlayer(e.target.value)}
                  className="flex-1 rounded border border-slate-200 px-1.5 py-1 text-[10px] uppercase font-semibold"
                />
                <button
                  type="button"
                  onClick={handleAddCard}
                  className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700"
                >
                  +
                </button>
              </div>
            </div>

            {/* Goleiros Fixos */}
            <div className="rounded-xl border border-blue-200 bg-white p-2.5 shadow-2xs">
              <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide flex items-center gap-1 font-extrabold text-blue-900">
                  🧤 Goleiros Fixos
                </span>
                <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 font-bold">
                  {goalkeepers.filter((g) => g.name.trim()).length} de 4 Definidos
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {goalkeepers.map((gk, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1.5"
                  >
                    <span className="font-mono text-[10px] font-extrabold text-blue-700">
                      {gk.num}
                    </span>
                    <input
                      type="text"
                      value={gk.name}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setGoalkeepers((prev) =>
                          prev.map((g, i) =>
                            i === idx ? { ...g, name: val } : g
                          )
                        );
                      }}
                      className="w-full bg-transparent font-bold text-[11px] text-slate-800 uppercase focus:outline-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Seção 2: Grade de Pontos (Time 01 a 04 com V / E / -) */}
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
            <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide">
                Pontos e Partidas dos Times
              </span>
              <span className="text-[10px] text-slate-500">
                (V = Vitória, E = Empate, - = Derrota/Folga)
              </span>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[10px] font-bold text-slate-600">
                    <th className="p-1 text-left">Time</th>
                    {Array.from({ length: 11 }).map((_, i) => (
                      <th key={i} className="p-1 w-6">
                        J{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {teamsGrid.map((row, tIdx) => (
                    <tr key={tIdx} className="hover:bg-slate-50">
                      <td className="p-1 text-left font-sans font-bold text-slate-800 text-[10px] whitespace-nowrap">
                        {row.teamName}
                      </td>
                      {row.matches.map((res, mIdx) => (
                        <td key={mIdx} className="p-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              // Alterna entre '-', 'V', 'E'
                              const next =
                                res === '-' ? 'V' : res === 'V' ? 'E' : '-';
                              setTeamsGrid((prev) => {
                                const copy = [...prev];
                                const mCopy = [...copy[tIdx].matches];
                                mCopy[mIdx] = next;
                                copy[tIdx] = { ...copy[tIdx], matches: mCopy };
                                return copy;
                              });
                            }}
                            className={`w-5 h-5 rounded text-[10px] font-bold transition ${
                              res === 'V'
                                ? 'bg-blue-600 text-white'
                                : res === 'E'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'text-slate-400 bg-slate-50 border border-slate-200'
                            }`}
                          >
                            {res}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Seção 3: Escalação & Gols por Time (Time 01, Time 02, Time 03, Time 04) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(teamLineups).map(([tName, players]) => {
              const totalTeamGoals = players.reduce(
                (acc, p) => acc + (Number(p.goals) || 0),
                0
              );
              return (
                <div
                  key={tName}
                  className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1.5">
                    <span className="font-bold text-[11px] text-blue-900 uppercase">
                      {tName}
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-extrabold text-blue-700">
                      ⚽ {totalTeamGoals} Gols
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {players.map((item, pIdx) => (
                      <div
                        key={pIdx}
                        className="py-1 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {item.isSub && (
                            <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 rounded px-1">
                              S-
                            </span>
                          )}
                          <span className="font-semibold text-slate-800 truncate text-[11px]">
                            {item.player}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleGoalChange(tName, pIdx, -1)}
                            className="h-5 w-5 rounded bg-slate-100 text-slate-700 font-bold text-xs"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-mono font-extrabold text-blue-800 text-[11px]">
                            {item.goals}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleGoalChange(tName, pIdx, 1)}
                            className="h-5 w-5 rounded bg-blue-600 text-white font-bold text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Seção 4: Lista Ordem de Chegada & Gols Destaque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Lista Ordem de Chegada */}
            <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
              <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                  Ordem de Chegada ({arrivalList.length})
                </span>
                <span className="text-[10px] text-slate-400">Presenças</span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-slate-50 pr-1">
                {arrivalList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleToggleArrival(idx)}
                    className="pt-1 flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded px-1 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-slate-400 w-4">
                        {String(item.order).padStart(2, '0')}
                      </span>
                      <span
                        className={`text-[11px] font-bold ${
                          item.confirmed ? 'text-slate-800' : 'text-slate-400 line-through'
                        }`}
                      >
                        {item.playerName}
                      </span>
                      {item.note && (
                        <span className="text-[10px] text-amber-600 font-black">
                          {item.note}
                        </span>
                      )}
                    </div>
                    <span
                      className={`h-4 w-4 rounded flex items-center justify-center text-[10px] ${
                        item.confirmed
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-300 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                  </div>
                ))}
              </div>

              {/* Adicionar chegada */}
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Novo atleta na chegada"
                  value={newArrivalName}
                  onChange={(e) => setNewArrivalName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddArrival()}
                  className="flex-1 rounded border border-slate-200 px-2 py-1 text-[10px] uppercase font-semibold"
                />
                <button
                  type="button"
                  onClick={handleAddArrival}
                  className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white"
                >
                  Adicionar
                </button>
              </div>
            </div>

            {/* Gols Destaque (Jogador | Hora) */}
            <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
              <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-red-700 font-black flex items-center gap-1">
                  ⚽ Gols Destaque
                </span>
                <span className="text-[10px] text-slate-400">Jogador | Hora</span>
              </div>

              <div className="space-y-1.5 divide-y divide-slate-100">
                {highlightGoals.map((h, idx) => (
                  <div
                    key={idx}
                    className="pt-1.5 flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-slate-800 text-[11px]">
                      ⚽ {h.player}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-red-600 bg-red-50 rounded px-1.5 py-0.5 border border-red-200">
                      {h.time}
                    </span>
                  </div>
                ))}
              </div>

              {/* Adicionar Gol Destaque */}
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Jogador"
                  value={newHighlightPlayer}
                  onChange={(e) => setNewHighlightPlayer(e.target.value)}
                  className="flex-1 rounded border border-slate-200 px-2 py-1 text-[10px] uppercase font-semibold"
                />
                <input
                  type="text"
                  placeholder="Hora (22:04)"
                  value={newHighlightTime}
                  onChange={(e) => setNewHighlightTime(e.target.value)}
                  className="w-16 rounded border border-slate-200 px-1 py-1 text-center font-mono text-[10px] font-bold"
                />
                <button
                  type="button"
                  onClick={handleAddHighlightGoal}
                  className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-700"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (onSave) {
                onSave({
                  matchDate,
                  startTime,
                  arrivalList,
                  yellowCards,
                  blueCards,
                  redCards,
                  goalkeepers,
                  teamsGrid,
                  teamLineups,
                  highlightGoals,
                });
              }
              onClose();
            }}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
          >
            Salvar e Confirmar Súmula Oficial
          </button>
        </div>
      </div>
    </div>
  );
};
