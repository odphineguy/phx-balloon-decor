
import React from 'react';
import { DownloadIcon } from './icons/DownloadIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface ResultDisplayProps {
  isLoading: boolean;
  error: string | null;
  originalImage: string | null;
  generatedImage: string | null;
  generatedText: string | null;
  onStartOver: () => void;
}

const LoadingState: React.FC = () => {
  const messages = [
    "Inflating your vision...",
    "Adding the final touches...",
    "Tying up the perfect look...",
    "Getting the party started...",
  ];
  const [message, setMessage] = React.useState(messages[0]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMessage(messages[Math.floor(Math.random() * messages.length)]);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-purple-500"></div>
      <p className="mt-4 text-lg font-semibold text-purple-700">{message}</p>
    </div>
  );
};

const InitialState: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-4">
    <SparklesIcon className="w-16 h-16 text-gray-300 mb-4" />
    <h3 className="font-bold text-lg text-gray-600">Your masterpiece will appear here</h3>
    <p className="mt-1">Upload an image and choose a style to begin.</p>
  </div>
);

const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center h-full text-center text-red-600 bg-red-50 rounded-lg p-4">
    <h3 className="font-bold text-lg">Oops! Something went wrong.</h3>
    <p className="mt-2 text-sm max-w-md">{message}</p>
    <button
      onClick={onRetry}
      className="mt-4 bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
    >
      Start Over
    </button>
  </div>
);

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  isLoading,
  error,
  originalImage,
  generatedImage,
  generatedText,
  onStartOver,
}) => {
  const renderContent = () => {
    if (isLoading) {
      return <LoadingState />;
    }
    if (error) {
      return <ErrorState message={error} onRetry={onStartOver} />;
    }
    if (generatedImage) {
      return (
        <div className="flex flex-col h-full">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg group flex-grow">
            <img src={generatedImage} alt="AI generated balloon decoration" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <a
                href={generatedImage}
                download="balloon-vision.png"
                className="flex items-center gap-2 bg-white/80 text-gray-800 font-bold py-2 px-4 rounded-lg backdrop-blur-sm hover:bg-white transition-colors"
                aria-label="Download generated image"
              >
                <DownloadIcon className="w-5 h-5" />
                Download
              </a>
            </div>
          </div>
          {generatedText && (
            <p className="mt-4 text-sm text-gray-600 bg-gray-100 p-3 rounded-lg">{generatedText}</p>
          )}
          <button
            onClick={onStartOver}
            className="mt-4 w-full bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Start Over
          </button>
        </div>
      );
    }
    if (originalImage) {
      return (
        <div className="flex flex-col h-full">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-md">
            <img src={originalImage} alt="Your uploaded space" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <p className="text-white font-semibold text-lg text-center">Now, choose a style and visualize!</p>
            </div>
          </div>
        </div>
      );
    }
    return <InitialState />;
  };

  return (
    <div className="w-full h-full min-h-[300px] lg:min-h-full bg-gray-50 rounded-xl flex items-center justify-center p-2">
      {renderContent()}
    </div>
  );
};
