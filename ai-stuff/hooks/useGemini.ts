
import { useState } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';

const fileToGenerativePart = async (file: File) => {
  const base64EncodedData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Failed to read file as data URL."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
};

export const useGemini = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState<string | null>(null);

  const generateImage = async (imageFile: File, prompt: string) => {
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    setGeneratedText(null);

    if (!process.env.API_KEY) {
      setError("API key is not configured. This application requires an API_KEY environment variable to be set.");
      setIsLoading(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });
      const imagePart = await fileToGenerativePart(imageFile);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
          role: 'user',
          parts: [
            imagePart,
            { text: prompt },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      let foundImage = false;
      let textResponse = '';
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const { mimeType, data } = part.inlineData;
          setGeneratedImage(`data:${mimeType};base64,${data}`);
          foundImage = true;
        } else if (part.text) {
          textResponse += part.text;
        }
      }
      
      setGeneratedText(textResponse.trim() || null);

      if (!foundImage) {
        setError(textResponse || "The AI did not return an image. Please try a different prompt or image.");
      }

    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(`Failed to generate image. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearResult = () => {
      setError(null);
      setGeneratedImage(null);
      setGeneratedText(null);
  };

  return { isLoading, error, generatedImage, generatedText, generateImage, clearResult };
};
