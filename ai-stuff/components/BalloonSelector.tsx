
import React from 'react';
import type { BalloonOption } from '../types';

interface BalloonSelectorProps {
  options: BalloonOption[];
  selectedOption: string;
  onSelectOption: (id: string) => void;
}

export const BalloonSelector: React.FC<BalloonSelectorProps> = ({ options, selectedOption, onSelectOption }) => {
  return (
    <div className="space-y-3">
      {options.map((option) => (
        <label
          key={option.id}
          htmlFor={option.id}
          className={`block p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
            selectedOption === option.id
              ? 'bg-purple-100 border-purple-500 shadow-md'
              : 'bg-white hover:border-purple-300 hover:bg-purple-50 border-gray-200'
          }`}
        >
          <input
            type="radio"
            id={option.id}
            name="balloon-option"
            value={option.id}
            checked={selectedOption === option.id}
            onChange={() => onSelectOption(option.id)}
            className="sr-only"
            aria-labelledby={`${option.id}-label`}
            aria-describedby={`${option.id}-desc`}
          />
          <h3 id={`${option.id}-label`} className="font-semibold text-gray-800">{option.name}</h3>
          <p id={`${option.id}-desc`} className="text-sm text-gray-600 mt-1">{option.description}</p>
        </label>
      ))}
    </div>
  );
};
