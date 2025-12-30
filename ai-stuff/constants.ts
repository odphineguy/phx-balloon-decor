
import type { BalloonOption, BalloonColor } from './types';

export const BALLOON_COLORS: BalloonColor[] = [
  { name: 'Pastel Pink', hex: '#FFD1DC', tailwindClass: 'bg-[#FFD1DC]' },
  { name: 'Light Blue', hex: '#ADD8E6', tailwindClass: 'bg-[#ADD8E6]' },
  { name: 'Mint Green', hex: '#98FF98', tailwindClass: 'bg-[#98FF98]' },
  { name: 'Lavender', hex: '#E6E6FA', tailwindClass: 'bg-[#E6E6FA]' },
  { name: 'Butter Yellow', hex: '#FFFACD', tailwindClass: 'bg-[#FFFACD]' },
  { name: 'Shiny Gold', hex: '#FFD700', tailwindClass: 'bg-[#FFD700]' },
  { name: 'Chrome Silver', hex: '#C0C0C0', tailwindClass: 'bg-[#C0C0C0]' },
  { name: 'Rose Gold', hex: '#B76E79', tailwindClass: 'bg-[#B76E79]' },
  { name: 'Royal Blue', hex: '#4169E1', tailwindClass: 'bg-[#4169E1]' },
  { name: 'Emerald Green', hex: '#50C878', tailwindClass: 'bg-[#50C878]' },
  { name: 'Classic Red', hex: '#FF0000', tailwindClass: 'bg-[#FF0000]' },
  { name: 'Matte White', hex: '#F5F5F5', tailwindClass: 'bg-[#F5F5F5]' },
  { name: 'Glossy Black', hex: '#000000', tailwindClass: 'bg-[#000000]' },
  { name: 'Terracotta', hex: '#E2725B', tailwindClass: 'bg-[#E2725B]' },
  { name: 'Beige', hex: '#F5F5DC', tailwindClass: 'bg-[#F5F5DC]' },
];

export const BALLOON_OPTIONS: BalloonOption[] = [
  {
    id: 'classic-garland',
    name: 'Classic Garland',
    description: 'A beautiful, full balloon garland. Perfect for entryways and photo backdrops.',
    prompt: 'Add a beautiful, full balloon garland arch using the colors {colors} to the main area of this image. Make it look realistic, celebratory, and elegantly attached to the wall or structure.'
  },
  {
    id: 'boho-arch',
    name: 'Boho Chic Arch',
    description: 'An elegant arch with a touch of pampas grass for a trendy, bohemian vibe.',
    prompt: 'Integrate a stylish boho-themed balloon arch into the image using the colors {colors}. Add some dried pampas grass accents within the balloons for a chic, textured look. Ensure it fits the space naturally.'
  },
  {
    id: 'dynamic-splash',
    name: 'Dynamic Splash',
    description: 'A fun and energetic explosion of balloons, perfect for birthdays and joyful events.',
    prompt: 'Create a vibrant splash of balloons in the photo using the colors {colors}. The arrangement should be dynamic and asymmetrical, like a joyful explosion of color. Include balloons of various sizes.'
  },
  {
    id: 'sleek-modern',
    name: 'Sleek & Modern',
    description: 'A sophisticated arrangement for a modern, high-class event.',
    prompt: 'Add a sophisticated and elegant balloon arrangement using shades of {colors}. The design should be sleek and modern, perhaps a half-arch or a pillar, suitable for a formal event.'
  },
  {
    id: 'whimsical-theme',
    name: 'Whimsical Theme',
    description: 'A creative creation featuring clear "bubble" balloons for a magical feel.',
    prompt: 'Transform the space with a whimsical themed balloon decoration using the colors {colors}. Incorporate clear balloons to look like bubbles and maybe some twisted balloons to suggest unique shapes.'
  }
];
