import type { Sfx } from './audio'

export interface Participant {
  name: string
  color: string
  img: HTMLImageElement
}

export type DrawMode = 'order' | 'single'

export interface GameContext {
  canvas: HTMLCanvasElement
  participants: Participant[]
  /** Ordre prédéterminé (anti-répétition déjà appliquée). Le jeu l'anime — sauf le Plinko, où la physique décide. */
  order: Participant[]
  mode: DrawMode
  forbiddenFirst: string | null
  sfx: Sfx
  onFinish: (finalOrder: Participant[]) => void
}

export interface GameDef {
  id: string
  name: string
  emoji: string
  tagline: string
  /** Lance le jeu, retourne une fonction de nettoyage. */
  run(ctx: GameContext): () => void
}
