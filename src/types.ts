import type { Sfx } from './audio'
import type { CanvasPalette } from './games/palette'

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

/** Activation des effets de suspense, configurable dans les Réglages. */
export interface SuspenseConfig {
  /** Faux-suspense : arrêt visuel sur le voisin avant de caler sur le gagnant. */
  nearMiss: boolean
  /** Ralenti dramatique des derniers crans (+ roulement de tambour). */
  slowdown: boolean
  /** Surprises décoratives aléatoires (tour bonus, secteur doré, ralenti inopiné). */
  surprises: boolean
  /** Secousses d'écran et flash au verdict (couper pour la sensibilité au mouvement). */
  camera: boolean
}

export const DEFAULT_SUSPENSE: SuspenseConfig = {
  nearMiss: true,
  slowdown: true,
  surprises: true,
  camera: true,
}

export type IntroKind = 'none' | 'presentation' | 'countdown' | 'announcer'

/** Mise en scène choisie pour un tirage (intro + variante de format propre au jeu). */
export interface GameStage {
  intro: IntroKind
  /** Variante de format, sémantique propre au jeu (ex. slot : 'reels1' | 'reels3'). */
  format?: string
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
  /** Mise en scène optionnelle (intro, format). Absente = comportement par défaut du jeu. */
  stage?: GameStage
  /** Palette du thème actif pour teinter le canvas (lue une fois au lancement). */
  palette?: CanvasPalette
  /** Effets de suspense activés (Réglages). Absent = tous actifs. */
  suspense?: SuspenseConfig
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
