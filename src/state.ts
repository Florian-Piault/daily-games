import type { DrawMode } from './types'

export interface SavedState {
  members: string[]
  present: Record<string, boolean>
  mode: DrawMode
  muted: boolean
  lastFirst: { date: string; name: string } | null
  lastGame: string | null
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
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as Partial<SavedState>) }
  } catch {
    return fallback
  }
}

export function saveState(s: SavedState): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}
