import React from 'react';
import { PlayerConfig, PlayerControls } from '../types';
import { ArrowLeft, RefreshCw } from 'lucide-react';

interface SettingsProps {
  configs: PlayerConfig[];
  onSave: (configs: PlayerConfig[]) => void;
  onBack: () => void;
  onReset: () => void;
}

const Settings: React.FC<SettingsProps> = ({ configs, onSave, onBack, onReset }) => {
  const [localConfigs, setLocalConfigs] = React.useState<PlayerConfig[]>(configs);
  const [listening, setListening] = React.useState<{ playerId: number; key: keyof PlayerControls } | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (listening) {
        e.preventDefault();
        const code = e.code;
        setLocalConfigs(prev => prev.map(p => {
          if (p.id === listening.playerId) {
            return {
              ...p,
              controls: {
                ...p.controls,
                [listening.key]: code
              }
            };
          }
          return p;
        }));
        setListening(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listening]);

  const handleSave = () => {
    onSave(localConfigs);
  };

  const translateKey = (key: string) => {
      const map: Record<string, string> = {
          'up': 'AVANCER',
          'down': 'RECULER',
          'left': 'GAUCHE',
          'right': 'DROITE',
          'shoot': 'TIRER'
      };
      return map[key] || key;
  };

  return (
    <div className="flex flex-col w-full h-full text-white p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center space-x-2 hover:text-yellow-400">
          <ArrowLeft size={20} /> <span>Retour</span>
        </button>
        <h2 className="text-2xl text-yellow-400">Configuration des Contrôles</h2>
        <button onClick={() => { onReset(); setLocalConfigs(configs); }} className="flex items-center space-x-2 text-red-400 hover:text-red-300">
          <RefreshCw size={16} /> <span>Réinitialiser</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {localConfigs.map((player) => (
          <div key={player.id} className="bg-stone-800 border-2 border-stone-600 p-4 relative">
             <div className="absolute top-0 left-0 w-4 h-4" style={{ backgroundColor: player.color }}></div>
             <h3 className="text-lg font-bold mb-4 ml-2" style={{ color: player.color }}>{player.name}</h3>
             
             <div className="space-y-2 text-sm">
                {Object.entries(player.controls).map(([action, code]) => (
                  <div key={action} className="flex justify-between items-center bg-stone-900 p-2 rounded">
                    <span className="uppercase text-gray-400">{translateKey(action)}</span>
                    <button
                      onClick={() => setListening({ playerId: player.id, key: action as keyof PlayerControls })}
                      className={`px-3 py-1 border border-stone-700 min-w-[150px] text-center ${
                        listening?.playerId === player.id && listening?.key === action 
                        ? 'bg-yellow-500 text-black animate-pulse' 
                        : 'bg-stone-700 hover:bg-stone-600'
                      }`}
                    >
                      {listening?.playerId === player.id && listening?.key === action ? 'APPUYEZ SUR TOUCHE' : code}
                    </button>
                  </div>
                ))}
             </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={handleSave}
          className="px-8 py-3 bg-green-600 hover:bg-green-500 border-b-4 border-green-900 active:border-b-0 active:translate-y-1 transition-all text-lg font-bold"
        >
          SAUVEGARDER
        </button>
      </div>
    </div>
  );
};

export default Settings;