// Banner looks and accent colors a host can pick. Shared by server and client.

export type BannerPreset = { label: string; css: string; og: string };

export const BANNER_PRESETS: Record<string, BannerPreset> = {
  citrus: {
    label: 'Citrus',
    css: 'radial-gradient(rgba(255,255,255,.22) 2px, transparent 3px) 0 0/26px 26px, linear-gradient(120deg, #ffbe0b 0%, #fb5607 100%)',
    og: 'linear-gradient(120deg, #ffbe0b 0%, #fb5607 100%)',
  },
  confetti: {
    label: 'Confetti',
    css: 'radial-gradient(#ff006e 3px, transparent 4px) 0 0/38px 38px, radial-gradient(#3a86ff 3px, transparent 4px) 19px 19px/38px 38px, linear-gradient(135deg, #ffd166 0%, #ef476f 100%)',
    og: 'linear-gradient(135deg, #ffd166 0%, #ef476f 100%)',
  },
  lagoon: {
    label: 'Lagoon',
    css: 'linear-gradient(135deg, #0ead69 0%, #0a6c74 55%, #073b4c 100%)',
    og: 'linear-gradient(135deg, #0ead69 0%, #0a6c74 55%, #073b4c 100%)',
  },
  berry: {
    label: 'Berry',
    css: 'linear-gradient(125deg, #ff4d6d 0%, #a4133c 100%)',
    og: 'linear-gradient(125deg, #ff4d6d 0%, #a4133c 100%)',
  },
  sage: {
    label: 'Sage',
    css: 'linear-gradient(135deg, #b5c99a 0%, #3a5a40 100%)',
    og: 'linear-gradient(135deg, #b5c99a 0%, #3a5a40 100%)',
  },
  night: {
    label: 'Night',
    css: 'radial-gradient(rgba(255,255,255,.55) 1px, transparent 1.5px) 0 0/31px 31px, radial-gradient(rgba(255,255,255,.3) 1px, transparent 1.5px) 13px 17px/47px 47px, linear-gradient(160deg, #23265a 0%, #0b0d1f 100%)',
    og: 'linear-gradient(160deg, #23265a 0%, #0b0d1f 100%)',
  },
};

export const ACCENTS: Record<string, { label: string; light: string; dark: string }> = {
  ember: { label: 'Ember', light: '#c2410c', dark: '#fb8c4c' },
  rose: { label: 'Rose', light: '#be123c', dark: '#fb7185' },
  teal: { label: 'Teal', light: '#0f766e', dark: '#2dd4bf' },
  indigo: { label: 'Indigo', light: '#4338ca', dark: '#a5b4fc' },
  forest: { label: 'Forest', light: '#15803d', dark: '#4ade80' },
  gold: { label: 'Gold', light: '#a16207', dark: '#facc15' },
};

export function presetFor(key: string): BannerPreset {
  return BANNER_PRESETS[key] ?? BANNER_PRESETS.citrus;
}

export function accentFor(key: string) {
  return ACCENTS[key] ?? ACCENTS.ember;
}
