import type { Sfx } from './audio'

export interface Participant {
  name: string
  color: string
  img: HTMLImageElement
}

export type DrawMode = 'order' | 'single'

/** Multiplicateurs de rythme (×1 = valeurs d'origine), appliqués aux durées finales calculées. */
export interface Pace {
  /** Durée des manches/tours : spins, passes, éliminations, prises… */
  round: number
  /** Durée des jeux continus : course, largage, canon. */
  continuous: number
  /** Durée des intros : comptes à rebours, mélange, traversée de l'avion. */
  intro: number
  /** Pause entre la fanfare et l'écran résultat. */
  result: number
}

export interface GameContext {
  canvas: HTMLCanvasElement
  participants: Participant[]
  /** Ordre prédéterminé (anti-répétition déjà appliquée). Le jeu l'anime — sauf le Plinko, où la physique décide. */
  order: Participant[]
  mode: DrawMode
  forbiddenFirst: string | null
  sfx: Sfx
  pace: Pace
  onFinish: (finalOrder: Participant[]) => void
}

export interface GameDef {
  id: string
  name: string
  emoji: string
  tagline: string
  /** Famille pour le regroupement sur l'accueil. */
  family: 'rank' | 'elim'
  /** Lance le jeu, retourne une fonction de nettoyage. */
  run(ctx: GameContext): () => void
}
