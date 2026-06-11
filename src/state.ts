import type { DrawMode, Pace } from './types'

export const DEFAULT_PACE: Pace = { round: 1, continuous: 1, intro: 1, result: 1 }

export interface SavedState {
  members: string[]
  present: Record<string, boolean>
  mode: DrawMode
  muted: boolean
  lastFirst: { date: string; name: string } | null
  lastGame: string | null
  pace: Pace
  /** Ids des jeux marqués favoris, affichés dans leur propre famille. */
  favorites: string[]
}

const KEY = 'daily-games-v1'

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function loadState(): SavedState {
  const fallback: SavedState = {
    members: [],
    present: {},
    mode: 'order',
    muted: false,
    lastFirst: null,
    lastGame: null,
    pace: { ...DEFAULT_PACE },
    favorites: [],
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<SavedState>
    return { ...fallback, ...parsed, pace: { ...DEFAULT_PACE, ...parsed.pace } }
  } catch {
    return fallback
  }
}

export function saveState(s: SavedState): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}
