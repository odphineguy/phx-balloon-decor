
import React from 'react';

export const Footer = () => {
  return (
    <footer className="w-full py-4 mt-8">
      <div className="container mx-auto text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} Balloon Vision AI. Visualize your perfect party.</p>
      </div>
    </footer>
  );
};
