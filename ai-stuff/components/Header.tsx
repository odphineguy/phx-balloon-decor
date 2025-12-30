
import React from 'react';

export const Header = () => {
  return (
    <header className="bg-white/30 backdrop-blur-lg shadow-sm sticky top-0 z-10 border-b border-white/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-center">
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 font-pacifico">
            Balloon Vision AI
          </h1>
        </div>
      </div>
    </header>
  );
};
