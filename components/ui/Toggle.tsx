import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  activeColor?: 'blue' | 'emerald' | 'primary';
  className?: string;
}

/**
 * RTL-friendly toggle. The thumb sits on the RIGHT side when off (the RTL
 * starting position) and moves LEFT when on, so it always slides toward the
 * label which sits to its right in Persian layout.
 *
 * The previous Tailwind peer-checked toggle positioned the after-pseudo with
 * absolute left:2px regardless of dir=rtl, so the thumb was visually offset
 * and the translate-x-full moved it OFF the track in RTL. This component
 * uses real DOM positioning and works the same way regardless of direction.
 */
export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  activeColor = 'blue',
  className = '',
}) => {
  const activeBg =
    activeColor === 'emerald' ? 'bg-emerald-600' :
    activeColor === 'primary' ? 'bg-primary dark:bg-white' :
    'bg-blue-600';

  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      {label && (
        <span className={`text-[11px] font-bold transition-colors ${checked ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-neutral-400'}`}>
          {label}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative w-10 h-5 rounded-full shrink-0
          transition-colors duration-200 ease-out
          ${checked ? activeBg : 'bg-gray-300 dark:bg-neutral-700'}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-400 dark:focus-visible:ring-offset-neutral-900
        `}
      >
        <span
          className={`
            absolute top-1/2 -translate-y-1/2 w-4 h-4
            bg-white rounded-full shadow-sm
            transition-all duration-200 ease-out
            ${checked ? 'right-[22px]' : 'right-0.5'}
          `}
        />
      </button>
    </label>
  );
};
