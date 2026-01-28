import React from 'react';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
}

const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onRestart, onExit }) => {
  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
      <h2 className="text-4xl text-white mb-8 font-bold tracking-widest">PAUSE</h2>
      <div className="flex flex-col space-y-4 w-64">
        <button
          onClick={onResume}
          className="px-6 py-3 bg-green-600 text-white border-b-4 border-green-800 hover:bg-green-500 font-bold"
        >
          REPRENDRE
        </button>
        <button
          onClick={onRestart}
          className="px-6 py-3 bg-yellow-600 text-white border-b-4 border-yellow-800 hover:bg-yellow-500 font-bold"
        >
          RECOMMENCER
        </button>
        <button
          onClick={onExit}
          className="px-6 py-3 bg-red-600 text-white border-b-4 border-red-800 hover:bg-red-500 font-bold"
        >
          QUITTER
        </button>
      </div>
    </div>
  );
};

export default PauseMenu;