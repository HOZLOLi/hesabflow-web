import React from 'react';
import { useWindowStore } from '../store/windowStore';
import { Window } from './Window';

export const WindowManager: React.FC = () => {
  const windows = useWindowStore((state) => state.windows);
  const hasActiveWindow = windows.some(w => !w.isMinimized);

  return (
    <>
      {windows.map((window) => (
        <Window key={window.id} window={window} />
      ))}
      {/* Overlay to dim background when a window is active */}
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 z-40 
        ${hasActiveWindow ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
      />
    </>
  );
};