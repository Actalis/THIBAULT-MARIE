import React, { useState, useEffect } from 'react';
import { GameState, PlayerConfig, GameHistory, ReplayFrame, PlayerProfile, GameMode } from './types';
import { DEFAULT_CONTROLS, COLORS } from './constants';
import Menu from './components/Menu';
import GameCanvas from './components/GameCanvas';
import RaceCanvas from './components/RaceCanvas';
import PauseMenu from './components/PauseMenu';
import Settings from './components/Settings';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [activeGameMode, setActiveGameMode] = useState<GameMode>(GameMode.DEATHMATCH);
  
  // Current Active Game Config
  const [playerConfigs, setPlayerConfigs] = useState<PlayerConfig[]>(DEFAULT_CONTROLS);
  
  // Persistent Data
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [history, setHistory] = useState<GameHistory[]>([]);
  
  // Transient Data
  const [winnerInfo, setWinnerInfo] = useState<{name: string, scores: {name: string, score: number}[]} | null>(null);
  const [activeReplayData, setActiveReplayData] = useState<ReplayFrame[]>([]);

  // Load Everything
  useEffect(() => {
    try {
        const savedHistory = localStorage.getItem('tankHistoryV2'); 
        if (savedHistory) setHistory(JSON.parse(savedHistory));

        const savedProfiles = localStorage.getItem('tankProfiles');
        if (savedProfiles) {
            setProfiles(JSON.parse(savedProfiles));
        } else {
            // Create default profiles if none exist
            const defaults: PlayerProfile[] = [
                { id: 'p1', name: 'Alpha', color: COLORS.p1, controls: DEFAULT_CONTROLS[0].controls, stats: { gamesPlayed: 0, wins: 0, totalKills: 0, totalScore: 0 } },
                { id: 'p2', name: 'Bravo', color: COLORS.p2, controls: DEFAULT_CONTROLS[1].controls, stats: { gamesPlayed: 0, wins: 0, totalKills: 0, totalScore: 0 } },
            ];
            setProfiles(defaults);
            localStorage.setItem('tankProfiles', JSON.stringify(defaults));
        }
    } catch (e) {
        console.error("Failed to load save data", e);
    }
  }, []);

  const saveHistory = (newHistory: GameHistory[]) => {
      setHistory(newHistory);
      try {
          const trimmedHistory = newHistory.length > 5 ? newHistory.slice(newHistory.length - 5) : newHistory;
          localStorage.setItem('tankHistoryV2', JSON.stringify(trimmedHistory));
      } catch (e) {
          console.warn("Storage full, could not save replay.");
      }
  }

  const saveProfiles = (newProfiles: PlayerProfile[]) => {
      setProfiles(newProfiles);
      localStorage.setItem('tankProfiles', JSON.stringify(newProfiles));
  }

  const handleStartGame = (activeConfigs: PlayerConfig[], mode: GameMode = GameMode.DEATHMATCH) => {
    setPlayerConfigs(activeConfigs);
    setActiveGameMode(mode);
    setGameState(GameState.PLAYING);
    setWinnerInfo(null);
    setActiveReplayData([]);
  };

  const handleGameOver = (winnerName: string, scores: {name: string, score: number, profileId?: string}[], replayData: ReplayFrame[] = []) => {
    // 1. Update History
    const newEntry: GameHistory = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      winner: winnerName,
      mode: activeGameMode,
      scores,
      note: '',
      replayData: activeGameMode === GameMode.DEATHMATCH ? replayData : undefined // Only save replays for deathmatch for now
    };
    
    const newHistory = [...history, newEntry];
    if (newHistory.length > 5) newHistory.shift();
    saveHistory(newHistory);
    
    // 2. Update Profile Stats
    const updatedProfiles = [...profiles];
    scores.forEach(s => {
        if (s.profileId) {
            const profile = updatedProfiles.find(p => p.id === s.profileId);
            if (profile) {
                profile.stats.gamesPlayed += 1;
                profile.stats.totalScore += s.score;
                profile.stats.totalKills += s.score; // Using score as metric
                if (s.name === winnerName) {
                    profile.stats.wins += 1;
                }
            }
        }
    });
    saveProfiles(updatedProfiles);
    
    setWinnerInfo({ name: winnerName, scores });
    setGameState(GameState.GAME_OVER);
  };

  const handleWatchReplay = (historyId: string) => {
      const game = history.find(h => h.id === historyId);
      if (game && game.replayData) {
          setActiveReplayData(game.replayData);
          setGameState(GameState.REPLAY);
      }
  };

  const handleUpdateNote = (id: string, note: string) => {
      const newHistory = history.map(h => h.id === id ? { ...h, note } : h);
      saveHistory(newHistory);
  };

  const handleSettingsSave = (newConfigs: PlayerConfig[]) => {
    setPlayerConfigs(newConfigs);
    
    const updatedProfiles = [...profiles];
    let changed = false;

    newConfigs.forEach(cfg => {
        if (cfg.profileId) {
            const idx = updatedProfiles.findIndex(p => p.id === cfg.profileId);
            if (idx !== -1) {
                updatedProfiles[idx] = {
                    ...updatedProfiles[idx],
                    controls: cfg.controls, 
                    color: cfg.color
                };
                changed = true;
            }
        }
    });

    if (changed) saveProfiles(updatedProfiles);

    if (gameState === GameState.SETTINGS) setGameState(GameState.MENU);
  };

  const handleCreateProfile = (name: string, color: string) => {
      const newProfile: PlayerProfile = {
          id: Date.now().toString(),
          name,
          color,
          controls: DEFAULT_CONTROLS[0].controls, // Default
          stats: { gamesPlayed: 0, wins: 0, totalKills: 0, totalScore: 0 }
      };
      saveProfiles([...profiles, newProfile]);
  };

  return (
    <div className="w-screen h-screen bg-stone-900 flex items-center justify-center overflow-hidden">
      
      {gameState === GameState.MENU && (
        <Menu 
            onStart={handleStartGame} 
            onSettings={() => setGameState(GameState.SETTINGS)}
            history={history}
            profiles={profiles}
            onCreateProfile={handleCreateProfile}
            onUpdateHistoryNote={handleUpdateNote}
            onWatchReplay={handleWatchReplay}
        />
      )}

      {gameState === GameState.SETTINGS && (
        <Settings 
            configs={playerConfigs} 
            onSave={handleSettingsSave} 
            onBack={() => setGameState(GameState.MENU)}
            onReset={() => {}}
        />
      )}

      {(gameState === GameState.PLAYING || gameState === GameState.PAUSED || gameState === GameState.REPLAY) && (
        <div className="w-full h-full relative">
            {activeGameMode === GameMode.DEATHMATCH ? (
                <GameCanvas 
                    playerConfigs={playerConfigs}
                    onGameOver={handleGameOver}
                    onPause={() => !gameState.includes('REPLAY') && setGameState(gameState === GameState.PAUSED ? GameState.PLAYING : GameState.PAUSED)}
                    isPaused={gameState === GameState.PAUSED}
                    isReplayMode={gameState === GameState.REPLAY}
                    replayData={activeReplayData}
                    onExitReplay={() => setGameState(GameState.MENU)}
                />
            ) : (
                <RaceCanvas 
                     playerConfigs={playerConfigs}
                     onGameOver={(winner, scores) => handleGameOver(winner, scores, [])}
                     onPause={() => setGameState(gameState === GameState.PAUSED ? GameState.PLAYING : GameState.PAUSED)}
                     isPaused={gameState === GameState.PAUSED}
                />
            )}

            {gameState === GameState.PAUSED && (
                <PauseMenu 
                    onResume={() => setGameState(GameState.PLAYING)}
                    onRestart={() => {
                        handleStartGame(playerConfigs, activeGameMode);
                    }}
                    onExit={() => setGameState(GameState.MENU)}
                />
            )}
        </div>
      )}

      {gameState === GameState.GAME_OVER && winnerInfo && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-50 animate-fade-in duration-[5000ms]">
             <h1 className="text-5xl md:text-7xl text-yellow-500 mb-6 font-bold drop-shadow-lg animate-pulse">FIN DE PARTIE</h1>
             <p className="text-2xl md:text-3xl mb-8">Vainqueur: <span className="text-green-400 font-bold">{winnerInfo.name}</span></p>
             
             <div className="bg-stone-800 p-8 border-4 border-stone-600 mb-8 min-w-[300px]">
                <h3 className="text-xl mb-6 text-center border-b border-stone-500 pb-2 text-gray-300">SCORES</h3>
                {winnerInfo.scores.sort((a,b) => b.score - a.score).map((s, i) => (
                    <div key={i} className="flex justify-between w-full mb-3 text-lg">
                        <span>{s.name}</span>
                        <span className="font-bold text-yellow-400">{s.score}</span>
                    </div>
                ))}
             </div>

             <div className="flex space-x-6">
                 <button 
                    onClick={() => {
                        handleStartGame(playerConfigs, activeGameMode);
                    }}
                    className="px-8 py-4 bg-green-600 hover:bg-green-500 border-b-4 border-green-900 font-bold text-xl rounded shadow-lg"
                 >
                    REJOUER
                 </button>
                 <button 
                    onClick={() => setGameState(GameState.MENU)}
                    className="px-8 py-4 bg-stone-600 hover:bg-stone-500 border-b-4 border-stone-800 font-bold text-xl rounded shadow-lg"
                 >
                    MENU
                 </button>
             </div>
        </div>
      )}
    </div>
  );
};

export default App;