import React, { useEffect, useState } from 'react';
import { BrandLogo } from './BrandLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Play welcome sound
    playWelcomeSound();

    // Start exit animation after 800ms
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 800);

    // Complete and unmount after 1000ms
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 1000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const playWelcomeSound = () => {
    // Create a subtle, professional notification sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Single clean tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.25);
  };

  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-white dark:bg-black flex items-center justify-center overflow-hidden transition-all duration-500 ${
        isExiting ? 'translate-y-[-100%]' : 'translate-y-0'
      }`}
    >
      {/* Minimal Grid Pattern Background */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      {/* Main Content */}
      <div className={`relative z-10 text-center transition-all duration-700 ${
        isExiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
      }`}>
        {/* Logo — vector emblem, sharp at any size */}
        <div className="mb-8 animate-slide-up-bounce">
          <div className="relative inline-block">
            <BrandLogo size={96} className="rounded-2xl shadow-2xl shadow-emerald-500/20" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-black text-black dark:text-white mb-2 animate-slide-up-delay-1 tracking-tighter uppercase">
          HESAB FLOW
        </h1>
        
        {/* Subtitle */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 animate-slide-up-delay-2 font-normal tracking-wide">
          سیستم جامع حسابداری
        </p>

        {/* Minimal Loading Indicator */}
        <div className="flex justify-center gap-1.5 animate-slide-up-delay-3">
          <div className="w-1.5 h-1.5 bg-black dark:bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1.5 h-1.5 bg-black dark:bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-1.5 h-1.5 bg-black dark:bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>

      {/* Version/Copyright */}
      <div className="absolute bottom-8 left-0 right-0 text-center animate-fade-in-delay">
        <p className="text-gray-400 dark:text-gray-600 text-xs font-light tracking-wider">نسخه 1.0.0</p>
      </div>
    </div>
  );
};
