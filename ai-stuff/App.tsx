
import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { ColorSelector } from './components/ColorSelector';
import { BalloonSelector } from './components/BalloonSelector';
import { ResultDisplay } from './components/ResultDisplay';
import { Footer } from './components/Footer';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { useGemini } from './hooks/useGemini';
import { BALLOON_OPTIONS, BALLOON_COLORS } from './constants';
import type { BalloonOption } from './types';

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string>(BALLOON_OPTIONS[0].id);
  const { isLoading, error, generatedImage, generatedText, generateImage, clearResult } = useGemini();

  const uploadedImageUrl = useMemo(() => {
    return imageFile ? URL.createObjectURL(imageFile) : null;
  }, [imageFile]);

  const handleColorChange = (colorName: string) => {
    setSelectedColors(prev => {
      if (prev.includes(colorName)) {
        return prev.filter(c => c !== colorName);
      }
      if (prev.length < 3) {
        return [...prev, colorName];
      }
      return prev; // Max 3 colors reached
    });
  };

  const formatColorsForPrompt = (colors: string[]): string => {
    if (colors.length === 0) return 'a variety of beautiful colors';
    if (colors.length === 1) return colors[0];
    if (colors.length === 2) return `${colors[0]} and ${colors[1]}`;
    const last = colors[colors.length - 1];
    const rest = colors.slice(0, -1).join(', ');
    return `${rest}, and ${last}`;
  };

  const handleGenerate = async () => {
    if (imageFile && selectedOptionId && selectedColors.length > 0) {
      const selectedOption = BALLOON_OPTIONS.find(opt => opt.id === selectedOptionId);
      if (selectedOption) {
        const colorString = formatColorsForPrompt(selectedColors);
        const finalPrompt = selectedOption.prompt.replace('{colors}', colorString);
        await generateImage(imageFile, finalPrompt);
      }
    }
  };

  const handleStartOver = () => {
    setImageFile(null);
    setSelectedOptionId(BALLOON_OPTIONS[0].id);
    setSelectedColors([]);
    clearResult();
    if (uploadedImageUrl) {
      URL.revokeObjectURL(uploadedImageUrl);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 text-gray-800 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left Panel */}
          <div className="bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg p-6 md:p-8 border border-white/50 flex flex-col space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-700">1. Upload Your Space</h2>
              <p className="text-gray-500 mt-1">Show us where the magic will happen.</p>
            </div>
            <ImageUploader onImageUpload={setImageFile} existingImage={uploadedImageUrl} />

            {imageFile && (
              <>
                <div className="text-center pt-4">
                  <h2 className="text-2xl font-bold text-gray-700">2. Pick Your Colors</h2>
                  <p className="text-gray-500 mt-1">Choose up to 3 colors for your design.</p>
                </div>
                <ColorSelector
                  colors={BALLOON_COLORS}
                  selectedColors={selectedColors}
                  onColorChange={handleColorChange}
                />

                <div className="text-center pt-4">
                  <h2 className="text-2xl font-bold text-gray-700">3. Choose a Style</h2>
                  <p className="text-gray-500 mt-1">Select your dream balloon arrangement.</p>
                </div>
                <BalloonSelector
                  options={BALLOON_OPTIONS}
                  selectedOption={selectedOptionId}
                  onSelectOption={setSelectedOptionId}
                />
                <div className="pt-4">
                  <button
                    onClick={handleGenerate}
                    disabled={isLoading || selectedColors.length === 0}
                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Visualizing...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="w-6 h-6" />
                        Visualize Decoration
                      </>
                    )}
                  </button>
                  {selectedColors.length === 0 && !isLoading && (
                    <p className="text-center text-sm text-purple-700 mt-2 font-medium">Please select at least one color to visualize.</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Panel */}
          <div className="bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg p-6 md:p-8 border border-white/50 flex flex-col">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-700">4. See The Result</h2>
              <p className="text-gray-500 mt-1">Your vision, brought to life by AI.</p>
            </div>
            <ResultDisplay
              isLoading={isLoading}
              error={error}
              originalImage={uploadedImageUrl}
              generatedImage={generatedImage}
              generatedText={generatedText}
              onStartOver={handleStartOver}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
