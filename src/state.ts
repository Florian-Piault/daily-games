import { DEFAULT_SUSPENSE, type DrawMode, type GameStage, type Pace, type SuspenseConfig } from './types'

export const DEFAULT_PACE: Pace = { round: 1, continuous: 1, intro: 1, result: 1 }

export type ThemeKey =
  | 'dark'
  | 'light'
  | 'printemps'
  | 'ete'
  | 'automne'
  | 'hiver'
  | 'noel'
  | 'halloween'

/** Un tirage enregistré au journal — un seul par date, le dernier de la journée gagne. */
export interface HistoryEntry {
  date: string
  game: string
  order: string[]
  /** Temps de parole cumulé du jour, en secondes par personne. */
  speak?: Record<string, number>
}

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
  /** Seed d'avatar par membre (absent = le nom lui-même). Conservé au renommage. */
  avatarSeed: Record<string, string>
  theme: ThemeKey
  /** Time-box par personne en secondes (0 = désactivé). */
  timeboxSec: number
  /** Dernière mise en scène choisie par jeu (intro + format), mémorisée pour le picker. */
  stagePrefs: Record<string, GameStage>
  /** Effets de suspense activés (roue / machine à sous). */
  suspense: SuspenseConfig
  history: HistoryEntry[]
}

const KEY = 'daily-games-v1'
const HISTORY_MAX = 90

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
    avatarSeed: {},
    theme: 'dark',
    timeboxSec: 0,
    stagePrefs: {},
    suspense: { ...DEFAULT_SUSPENSE },
    history: [],
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<SavedState>
    const state = {
      ...fallback,
      ...parsed,
      pace: { ...DEFAULT_PACE, ...parsed.pace },
      suspense: { ...DEFAULT_SUSPENSE, ...parsed.suspense },
    }
    // migration : avatarSeed stockait un numéro de variante, désormais le seed complet
    for (const [name, v] of Object.entries(state.avatarSeed)) {
      if (typeof v === 'number') {
        if (v > 0) state.avatarSeed[name] = `${name}#${v}`
        else delete state.avatarSeed[name]
      }
    }
    return state
  } catch {
    return fallback
  }
}

export function saveState(s: SavedState): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}

/** Sérialise l'état complet pour l'export (sauvegarde lisible). */
export function exportStateJson(s: SavedState): string {
  return JSON.stringify(s, null, 2)
}

/**
 * Parse et valide un backup importé. Retourne l'état si le JSON est valide et
 * contient au moins un tableau `members`, sinon `null`. Les champs manquants ou
 * anciens seront normalisés par loadState() au prochain chargement.
 */
export function parseImportedState(raw: string): SavedState | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as SavedState).members)) {
      return null
    }
    return parsed as SavedState
  } catch {
    return null
  }
}

/** Enregistre le tirage du jour au journal (remplace l'entrée existante du jour, temps de parole conservé). */
export function recordDraw(s: SavedState, game: string, order: string[]): void {
  const date = todayKey()
  const prev = s.history.find((e) => e.date === date)
  s.history = s.history.filter((e) => e.date !== date)
  s.history.push({ date, game, order: [...order], ...(prev?.speak ? { speak: prev.speak } : {}) })
  if (s.history.length > HISTORY_MAX) s.history = s.history.slice(-HISTORY_MAX)
  saveState(s)
}

/** Ajoute du temps de parole au compteur du jour pour une personne. */
export function recordSpeakTime(s: SavedState, name: string, seconds: number): void {
  const date = todayKey()
  let entry = s.history.find((e) => e.date === date)
  if (!entry) {
    entry = { date, game: s.lastGame ?? '', order: [] }
    s.history.push(entry)
  }
  entry.speak = entry.speak ?? {}
  entry.speak[name] = Math.round((entry.speak[name] ?? 0) + seconds)
  saveState(s)
}
