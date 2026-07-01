import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EatSave',
    short_name: 'EatSave',
    description: 'Smart fridge + smart wallet',
    start_url: '/home',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#16a34a',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
