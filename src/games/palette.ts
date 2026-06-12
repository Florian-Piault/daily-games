/**
 * Palette de dessin pour le canvas, lue depuis les variables CSS du thème actif.
 * Le canvas dessine ses propres couleurs : cette lecture (une fois au lancement)
 * permet à la roue / la machine d'épouser le thème (habillage saisonnier auto).
 */
export interface CanvasPalette {
  accent: string
  accentStrong: string
  gold: string
  text: string
  muted: string
  surface: string
  isDark: boolean
}

export function readPalette(): CanvasPalette {
  const s = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string): string => s.getPropertyValue(name).trim() || fallback
  return {
    accent: get('--accent', '#6366f1'),
    accentStrong: get('--accent-strong', get('--accent', '#4f46e5')),
    gold: get('--gold', '#fbbf24'),
    text: get('--text', '#e2e8f0'),
    muted: get('--muted', '#94a3b8'),
    surface: get('--modal-bg', '#1e293b'),
    isDark: get('color-scheme', 'dark').includes('dark'),
  }
}
