import React, { useState, useEffect } from 'react';
import { GameHistory, PlayerProfile, PlayerConfig, GameMode, PlayerControls } from '../types';
import { Play, History, Keyboard, Save, Film, Edit2, Shield, AlertTriangle, UserPlus, BarChart2, Check, X, Flag } from 'lucide-react';
import { AudioSystem } from '../utils/audio';
import { DEFAULT_CONTROLS, COLORS } from '../constants';

interface MenuProps {
  onStart: (activeConfigs: PlayerConfig[], mode: GameMode) => void;
  onSettings: () => void;
  history: GameHistory[];
  profiles: PlayerProfile[];
  onCreateProfile: (name: string, color: string) => void;
  onUpdateHistoryNote: (id: string, note: string) => void;
  onWatchReplay: (historyId: string) => void;
}

const Menu: React.FC<MenuProps> = ({ 
    onStart, onSettings, history, profiles, onCreateProfile, 
    onUpdateHistoryNote, onWatchReplay 
}) => {
  const [playerCount, setPlayerCount] = useState(2);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.DEATHMATCH);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfileStats, setShowProfileStats] = useState<string | null>(null);
  
  const [selectedProfiles, setSelectedProfiles] = useState<(string | null)[]>([null, null, null, null]);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileColor, setNewProfileColor] = useState(COLORS.p1);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // Auto-select based on localStorage or default logic
  useEffect(() => {
      // Try to load from storage
      const savedSelection = localStorage.getItem('lastSquadSelection');
      if (savedSelection) {
          try {
              const parsed = JSON.parse(savedSelection);
              if (Array.isArray(parsed)) {
                  setSelectedProfiles(parsed);
                  setPlayerCount(parsed.filter(id => id !== null).length || 2);
                  return;
              }
          } catch(e) {}
      }

      // Fallback default logic
      const newSelection = [...selectedProfiles];
      let assignedCount = 0;
      profiles.forEach(p => {
          if (assignedCount < 4 && !newSelection.includes(p.id)) {
             if (newSelection[assignedCount] === null) {
                 newSelection[assignedCount] = p.id;
                 assignedCount++;
             }
          }
      });
      setSelectedProfiles(newSelection);
  }, [profiles]); // Dependencies: only run when profiles load

  const handlePlayerCountChange = (delta: number) => {
    AudioSystem.uiClick();
    const newCount = Math.max(2, Math.min(4, playerCount + delta));
    setPlayerCount(newCount);
    
    // Clean up selection for hidden slots if needed (optional)
    const newSelection = [...selectedProfiles];
    for(let i = newCount; i < 4; i++) newSelection[i] = null;
    setSelectedProfiles(newSelection);
    localStorage.setItem('lastSquadSelection', JSON.stringify(newSelection));
  };

  const handleProfileSelect = (slotIndex: number, profileId: string) => {
      AudioSystem.uiClick();
      const newSelection = [...selectedProfiles];
      newSelection[slotIndex] = profileId;
      setSelectedProfiles(newSelection);
      localStorage.setItem('lastSquadSelection', JSON.stringify(newSelection));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (newProfileName.trim().length > 0) {
          onCreateProfile(newProfileName, newProfileColor);
          setNewProfileName('');
          setIsCreatingProfile(false);
          AudioSystem.uiClick();
      }
  };

  const handleStart = () => {
    AudioSystem.uiClick();
    
    const activeConfigs: PlayerConfig[] = [];
    const usedControlSets = new Set<string>();

    // 1. Process players WITH profiles first to reserve their controls
    const tempPlayers: (PlayerConfig | null)[] = Array(playerCount).fill(null);

    for (let i = 0; i < playerCount; i++) {
        const profileId = selectedProfiles[i];
        if (profileId) {
            const profile = profiles.find(p => p.id === profileId);
            if (profile) {
                // Use profile controls OR default if none set (but stick to that slot default usually)
                // To safely detect overlap, we construct a key string
                const controls = profile.controls || DEFAULT_CONTROLS[i].controls;
                const controlKey = JSON.stringify(controls);
                usedControlSets.add(controlKey);

                tempPlayers[i] = {
                    id: i + 1,
                    profileId: profile.id,
                    name: profile.name,
                    color: profile.color,
                    controls: controls,
                    active: true
                };
            }
        }
    }

    // 2. Process players WITHOUT profiles, assigning unused Default Control sets
    for (let i = 0; i < playerCount; i++) {
        if (!tempPlayers[i]) {
            // Find a default control set that hasn't been used yet
            // Preference order: Default 1, Default 2, Default 3, Default 4
            let assignedControls: PlayerControls | null = null;
            
            // Try to assign the default corresponding to this slot first
            const preferredDefault = DEFAULT_CONTROLS[i].controls;
            if (!usedControlSets.has(JSON.stringify(preferredDefault))) {
                assignedControls = preferredDefault;
            } else {
                // If taken (e.g. Player 1 profile uses arrow keys which are Default 2), find next available
                for (const def of DEFAULT_CONTROLS) {
                    if (!usedControlSets.has(JSON.stringify(def.controls))) {
                        assignedControls = def.controls;
                        break;
                    }
                }
            }

            // Fallback (should theoretically not happen with 4 distinct sets and 4 players)
            if (!assignedControls) assignedControls = DEFAULT_CONTROLS[i].controls;

            usedControlSets.add(JSON.stringify(assignedControls));

            tempPlayers[i] = {
                id: i + 1,
                name: `Joueur ${i + 1}`,
                color: DEFAULT_CONTROLS[i].color,
                controls: assignedControls,
                active: true
            };
        }
    }

    // Filter out nulls (TS check)
    tempPlayers.forEach(p => { if(p) activeConfigs.push(p); });
    
    onStart(activeConfigs, gameMode);
  };

  const startNoteEdit = (game: GameHistory) => {
      setEditingNoteId(game.id);
      setNoteText(game.note || '');
  };

  const saveNote = (id: string) => {
      onUpdateHistoryNote(id, noteText);
      setEditingNoteId(null);
  };

  const renderHistoryItem = (game: GameHistory) => {
      let resultText = game.winner;
      if (game.mode === GameMode.RACE) {
          const losers = game.scores.filter(s => s.name !== game.winner).map(s => s.name).join(', ');
          resultText = `${game.winner} a gagné contre ${losers || 'personne'}`;
      }

      return (
         <div key={game.id} className="bg-neutral-800/50 border border-neutral-700 p-4 rounded-md flex flex-col gap-2">
             <div className="flex justify-between items-start">
                 <div className="flex items-center gap-2">
                     <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${game.mode === GameMode.RACE ? 'bg-blue-900 text-blue-200' : 'bg-red-900 text-red-200'}`}>
                         {game.mode === GameMode.RACE ? 'COURSE' : 'COMBAT'}
                     </span>
                     <span className="text-xs text-stone-500">{new Date(game.date).toLocaleDateString()}</span>
                 </div>
                 {game.replayData && (
                    <button onClick={() => { AudioSystem.uiClick(); onWatchReplay(game.id); }} className="text-blue-400 hover:text-blue-300">
                        <Film size={16} />
                    </button>
                 )}
             </div>
             
             <div className="font-bold text-white text-sm">
                 {resultText}
             </div>

             <div className="flex flex-wrap gap-2 mt-1">
                {game.scores.map((s,i) => <span key={i} className="text-[10px] bg-black/30 px-2 py-1 rounded text-stone-300">{s.name}: {s.score} pts</span>)}
             </div>

             <div className="mt-2 pt-2 border-t border-white/10">
                {editingNoteId === game.id ? (
                    <div className="flex gap-2">
                        <input 
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            className="bg-black border border-amber-500/50 text-white px-2 py-1 w-full rounded text-xs focus:outline-none"
                            placeholder="Note..."
                            maxLength={50}
                            autoFocus
                        />
                        <button onClick={() => saveNote(game.id)} className="text-green-500"><Save size={14}/></button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => startNoteEdit(game)}>
                        <span className={`text-xs italic ${game.note ? 'text-stone-400' : 'text-stone-600'}`}>
                            {game.note || "Ajouter une note..."}
                        </span>
                        <Edit2 size={10} className="opacity-0 group-hover:opacity-100 text-stone-500"/>
                    </div>
                )}
             </div>
         </div>
      );
  }

  const renderStatsModal = () => {
      if (!showProfileStats) return null;
      const profile = profiles.find(p => p.id === showProfileStats);
      if (!profile) return null;

      const winRate = profile.stats.gamesPlayed > 0 ? Math.round((profile.stats.wins / profile.stats.gamesPlayed) * 100) : 0;

      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-stone-800 border-2 border-stone-600 rounded-lg p-6 max-w-md w-full shadow-2xl relative animate-fade-in">
                <button onClick={() => setShowProfileStats(null)} className="absolute top-4 right-4 text-stone-400 hover:text-white"><X size={24}/></button>
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded shadow-lg border-2 border-white/20" style={{backgroundColor: profile.color}}></div>
                    <div>
                        <h2 className="text-3xl font-bold text-white uppercase">{profile.name}</h2>
                        <span className="text-xs text-stone-400 font-mono tracking-widest">ID: {profile.id.slice(-6)}</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-stone-900/50 p-4 rounded text-center"><div className="text-2xl font-bold text-white">{profile.stats.gamesPlayed}</div><div className="text-xs text-stone-500 uppercase tracking-widest">Parties</div></div>
                    <div className="bg-stone-900/50 p-4 rounded text-center"><div className="text-2xl font-bold text-green-400">{profile.stats.wins}</div><div className="text-xs text-stone-500 uppercase tracking-widest">Victoires</div></div>
                    <div className="bg-stone-900/50 p-4 rounded text-center"><div className="text-2xl font-bold text-amber-500">{profile.stats.totalScore}</div><div className="text-xs text-stone-500 uppercase tracking-widest">Score Total</div></div>
                    <div className="bg-stone-900/50 p-4 rounded text-center"><div className="text-2xl font-bold text-blue-400">{winRate}%</div><div className="text-xs text-stone-500 uppercase tracking-widest">Taux Victoire</div></div>
                </div>
            </div>
        </div>
      );
  };

  if (showHistory) {
      return (
      <div className="flex flex-col items-center justify-center w-full h-full text-white bg-neutral-900/90 backdrop-blur-md">
        <div className="w-11/12 md:w-5/6 max-h-[85vh] flex flex-col bg-black/40 border border-neutral-700 rounded-lg overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-neutral-700 flex justify-between items-center bg-black/60">
             <h2 className="text-3xl font-bold tracking-tighter text-amber-500 uppercase flex items-center gap-2">
                <History className="w-6 h-6" /> Journaux Tactiques
             </h2>
             <button onClick={() => { AudioSystem.uiClick(); setShowHistory(false); }} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded text-sm font-bold">FERMER</button>
          </div>
          <div className="overflow-y-auto p-4 flex-1">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {history.slice().reverse().map((game) => renderHistoryItem(game))}
             </div>
             {history.length === 0 && <div className="text-center text-stone-500 p-8 col-span-2">Aucun historique</div>}
          </div>
        </div>
      </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-white bg-gradient-to-b from-neutral-900 to-black relative overflow-hidden">
        {renderStatsModal()}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(10,10,10,0.5)_2px,transparent_2px),linear-gradient(90deg,rgba(10,10,10,0.5)_2px,transparent_2px)] bg-[size:40px_40px] opacity-20 pointer-events-none"></div>

      <div className="z-10 flex flex-col items-center w-full max-w-6xl px-4 animate-fade-in">
        <div className="text-center mb-8">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                TANK <span className="text-amber-500">TACTICS</span>
            </h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 w-full">
            
            {/* Left Panel: Squad Configuration */}
            <div className="flex-1 bg-neutral-900/80 backdrop-blur border border-neutral-700 rounded-xl p-6 shadow-2xl relative">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Shield size={20} className="text-amber-500"/> ESCOUADE
                    </h3>
                    <div className="flex items-center gap-4 bg-black/40 px-3 py-1 rounded-lg border border-neutral-800">
                        <button onClick={() => handlePlayerCountChange(-1)} className="w-6 h-6 flex items-center justify-center bg-neutral-700 rounded hover:bg-neutral-600">-</button>
                        <span className="font-mono font-bold text-amber-500">{playerCount}</span>
                        <button onClick={() => handlePlayerCountChange(1)} className="w-6 h-6 flex items-center justify-center bg-neutral-700 rounded hover:bg-neutral-600">+</button>
                    </div>
                </div>

                <div className="space-y-4">
                    {Array.from({length: playerCount}).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 bg-black/30 p-2 rounded border border-neutral-800">
                            <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-neutral-500 text-xs bg-neutral-900">
                                P{i+1}
                            </div>
                            <div className="flex-1">
                                <select 
                                    className="w-full bg-stone-200 text-black font-bold focus:outline-none cursor-pointer p-1 rounded border border-stone-400"
                                    value={selectedProfiles[i] || ''}
                                    onChange={(e) => handleProfileSelect(i, e.target.value)}
                                >
                                    <option value="" disabled className="text-stone-500">Sélectionner un profil</option>
                                    {profiles.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            {selectedProfiles[i] && (
                                <button onClick={() => setShowProfileStats(selectedProfiles[i])} className="text-stone-500 hover:text-amber-500 transition-colors">
                                    <BarChart2 size={16} />
                                </button>
                            )}
                            {selectedProfiles[i] && (
                                <div className="w-4 h-4 rounded-full shadow" style={{backgroundColor: profiles.find(p => p.id === selectedProfiles[i])?.color || '#555'}}></div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-6 border-t border-neutral-700">
                    {!isCreatingProfile ? (
                        <button onClick={() => setIsCreatingProfile(true)} className="w-full py-2 flex items-center justify-center gap-2 text-sm text-stone-400 hover:text-white border border-dashed border-stone-600 rounded hover:bg-stone-800 transition-all">
                            <UserPlus size={16} /> CRÉER UN NOUVEAU PROFIL
                        </button>
                    ) : (
                        <form onSubmit={handleCreateSubmit} className="bg-stone-800 p-3 rounded animate-fade-in">
                            <h4 className="text-xs font-bold text-stone-400 mb-2 uppercase">Nouveau Profil</h4>
                            <div className="flex gap-2 mb-2">
                                <input type="text" placeholder="Nom" value={newProfileName} onChange={e => setNewProfileName(e.target.value)} className="flex-1 bg-black/50 border border-stone-600 rounded px-2 py-1 text-sm text-white focus:border-amber-500 outline-none" maxLength={12} autoFocus />
                                <input type="color" value={newProfileColor} onChange={e => setNewProfileColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className="flex-1 bg-green-700 hover:bg-green-600 text-xs font-bold py-1 rounded text-white flex justify-center items-center gap-1"><Check size={12}/> SAUVEGARDER</button>
                                <button type="button" onClick={() => setIsCreatingProfile(false)} className="flex-1 bg-red-900/50 hover:bg-red-900 text-xs font-bold py-1 rounded text-red-200 flex justify-center items-center gap-1"><X size={12}/> ANNULER</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Right Panel: Mode & Actions */}
            <div className="flex-1 flex flex-col gap-4">
                 <div className="bg-neutral-900/80 backdrop-blur border border-neutral-700 rounded-xl p-6 shadow-2xl mb-4">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Flag size={20} className="text-blue-500"/> MODE DE JEU
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => { AudioSystem.uiClick(); setGameMode(GameMode.DEATHMATCH); }}
                            className={`p-4 rounded border flex flex-col items-center gap-2 transition-all ${gameMode === GameMode.DEATHMATCH ? 'bg-red-900/40 border-red-500 text-white shadow-lg shadow-red-900/20' : 'bg-black/30 border-neutral-700 text-stone-500 hover:bg-black/50'}`}
                        >
                            <Shield size={24} />
                            <span className="font-bold text-sm tracking-widest">COMBAT</span>
                        </button>
                        <button 
                            onClick={() => { AudioSystem.uiClick(); setGameMode(GameMode.RACE); }}
                            className={`p-4 rounded border flex flex-col items-center gap-2 transition-all ${gameMode === GameMode.RACE ? 'bg-blue-900/40 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-black/30 border-neutral-700 text-stone-500 hover:bg-black/50'}`}
                        >
                            <Flag size={24} />
                            <span className="font-bold text-sm tracking-widest">COURSE</span>
                        </button>
                    </div>
                 </div>

                <div className="flex-1 flex flex-col gap-4 justify-end">
                    <button onClick={handleStart} className="group relative w-full h-24 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-xl flex items-center justify-between px-8 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all transform hover:scale-[1.02]">
                        <div className="flex flex-col items-start"><span className="text-3xl font-black italic text-black uppercase tracking-tighter">DÉPLOYER</span><span className="text-xs font-bold text-amber-900 bg-amber-500/50 px-2 py-0.5 rounded uppercase tracking-widest">LANCER LE JEU</span></div>
                        <Play size={40} className="text-black fill-black group-hover:translate-x-1 transition-transform" />
                    </button>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => { AudioSystem.uiClick(); setShowHistory(true); }} className="h-16 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-lg flex items-center justify-center gap-2 text-neutral-200 font-bold uppercase tracking-wider transition-colors"><History size={18} /> ARCHIVES</button>
                        <button onClick={() => { AudioSystem.uiClick(); onSettings(); }} className="h-16 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-lg flex items-center justify-center gap-2 text-neutral-200 font-bold uppercase tracking-wider transition-colors"><Keyboard size={18} /> CONTRÔLES</button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Menu;