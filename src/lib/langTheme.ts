import type { Language } from './types'

export interface LangTheme {
  flag: string
  greeting: string
  /** tailwind gradient stops for card/hero backgrounds */
  gradient: string
  /** raw hex for glows, dots, accents */
  accent: string
  accent2: string
  /** soft ring color for chips */
  chip: string
  /** decorative word shown on cards */
  word: string
}

const themes: Record<string, LangTheme> = {
  en: {
    flag: '🇬🇧', greeting: 'Hello', word: 'English',
    gradient: 'from-[#1e3a8a] via-[#274690] to-[#9f1239]',
    accent: '#3b82f6', accent2: '#e11d48',
    chip: 'rgba(59,130,246,0.18)',
  },
  fr: {
    flag: '🇫🇷', greeting: 'Bonjour', word: 'Français',
    gradient: 'from-[#0f1e5c] via-[#283593] to-[#b91c3c]',
    accent: '#60a5fa', accent2: '#ef4444',
    chip: 'rgba(96,165,250,0.18)',
  },
  de: {
    flag: '🇩🇪', greeting: 'Hallo', word: 'Deutsch',
    gradient: 'from-[#1c1917] via-[#3f3226] to-[#b45309]',
    accent: '#f59e0b', accent2: '#fbbf24',
    chip: 'rgba(245,158,11,0.18)',
  },
  es: {
    flag: '🇪🇸', greeting: 'Hola', word: 'Español',
    gradient: 'from-[#7f1d1d] via-[#b91c1c] to-[#f59e0b]',
    accent: '#f87171', accent2: '#fbbf24',
    chip: 'rgba(248,113,113,0.18)',
  },
  ja: {
    flag: '🇯🇵', greeting: 'こんにちは', word: '日本語',
    gradient: 'from-[#4c0519] via-[#9d174d] to-[#f9a8d4]',
    accent: '#fb7185', accent2: '#f9a8d4',
    chip: 'rgba(251,113,133,0.18)',
  },
  ko: {
    flag: '🇰🇷', greeting: '안녕하세요', word: '한국어',
    gradient: 'from-[#1e1b4b] via-[#4338ca] to-[#f472b6]',
    accent: '#818cf8', accent2: '#f9a8d4',
    chip: 'rgba(129,140,248,0.18)',
  },
  zh: {
    flag: '🇨🇳', greeting: '你好', word: '中文',
    gradient: 'from-[#450a0a] via-[#b91c1c] to-[#d4af37]',
    accent: '#ef4444', accent2: '#eab308',
    chip: 'rgba(239,68,68,0.18)',
  },
  ar: {
    flag: '🇸🇦', greeting: 'مرحبا', word: 'العربية',
    gradient: 'from-[#022c22] via-[#065f46] to-[#d4af37]',
    accent: '#34d399', accent2: '#d4af37',
    chip: 'rgba(52,211,153,0.18)',
  },
  hi: {
    flag: '🇮🇳', greeting: 'नमस्ते', word: 'हिन्दी',
    gradient: 'from-[#4a044e] via-[#c2410c] to-[#16a34a]',
    accent: '#fb923c', accent2: '#4ade80',
    chip: 'rgba(251,146,60,0.18)',
  },
  it: {
    flag: '🇮🇹', greeting: 'Ciao', word: 'Italiano',
    gradient: 'from-[#14532d] via-[#166534] to-[#b91c1c]',
    accent: '#4ade80', accent2: '#f87171',
    chip: 'rgba(74,222,128,0.18)',
  },
}

export function getLangTheme(lang?: Language | null): LangTheme {
  if (lang && themes[lang.code]) return themes[lang.code]
  return {
    flag: '🌍', greeting: 'Hello', word: 'Language',
    gradient: 'from-[#312e81] via-[#6d28d9] to-[#b45309]',
    accent: '#a5b4fc', accent2: '#fbbf24',
    chip: 'rgba(165,180,252,0.18)',
  }
}

/** All greetings for the hero 3D scene / marquee */
export const greetings: { word: string; lang: string; accent: string }[] = [
  { word: 'Hello', lang: 'en', accent: '#3b82f6' },
  { word: 'Bonjour', lang: 'fr', accent: '#60a5fa' },
  { word: 'Hola', lang: 'es', accent: '#f87171' },
  { word: 'こんにちは', lang: 'ja', accent: '#fb7185' },
  { word: '안녕하세요', lang: 'ko', accent: '#818cf8' },
  { word: 'Ciao', lang: 'it', accent: '#4ade80' },
  { word: 'Hallo', lang: 'de', accent: '#f59e0b' },
  { word: 'مرحبا', lang: 'ar', accent: '#34d399' },
  { word: 'नमस्ते', lang: 'hi', accent: '#fb923c' },
  { word: '你好', lang: 'zh', accent: '#ef4444' },
]
