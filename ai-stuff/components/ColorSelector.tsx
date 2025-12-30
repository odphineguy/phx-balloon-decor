
import React from 'react';
import type { BalloonColor } from '../types';
import { CheckIcon } from './icons/CheckIcon';

interface ColorSelectorProps {
  colors: BalloonColor[];
  selectedColors: string[];
  onColorChange: (colorName: string) => void;
}

export const ColorSelector: React.FC<ColorSelectorProps> = ({ colors, selectedColors, onColorChange }) => {
  const canSelectMore = selectedColors.length < 3;

  return (
    <div>
      <div className="flex flex-wrap gap-3 justify-center">
        {colors.map((color) => {
          const isSelected = selectedColors.includes(color.name);
          const isDisabled = !isSelected && !canSelectMore;
          return (
            <button
              key={color.name}
              type="button"
              onClick={() => onColorChange(color.name)}
              disabled={isDisabled}
              className={`w-12 h-12 rounded-full transition-all duration-200 border-2 flex items-center justify-center
                ${color.tailwindClass}
                ${isSelected ? 'border-purple-600 ring-2 ring-purple-600 ring-offset-2' : 'border-white/50'}
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-100'}
                ${!isDisabled ? 'hover:scale-110' : ''}
              `}
              aria-label={`Select ${color.name}`}
              aria-pressed={isSelected}
            >
              {isSelected && <CheckIcon className="w-6 h-6 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))' }} />}
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm text-gray-500 mt-3">
        Select 1 to 3 colors. ({selectedColors.length} / 3 selected)
      </p>
    </div>
  );
};
