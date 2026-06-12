import type { Pace, SuspenseConfig } from '../types'
import type { Sfx } from '../audio'

/**
 * Moteur de suspense COSMÉTIQUE partagé par la roue et la machine à sous.
 *
 * Invariant absolu : à `u >= 1`, la position rendue retombe EXACTEMENT sur `span`
 * (l'angle/position encodant le gagnant), garanti par construction. Aucune fonction
 * d'ici ne lit ni ne modifie `ctx.order` — le voisin du faux-suspense est purement
 * géométrique (un cran avant la cible).
 */

export interface SuspensePlan {
  /** Faux-suspense : on s'arrête visuellement un cran avant, on attend, puis on avance. */
  nearMiss: boolean
  /** Ralenti dramatique des derniers crans (décélération plus marquée + ratchet sonore). */
  finalSlowdown: boolean
  /** Tours entiers supplémentaires (surprise « double-tour »). Multiple entier ⇒ gagnant inchangé. */
  bonusLoops: number
  /** Secteur/case « chanceux » décoratif, index indépendant du gagnant (null = aucun). */
  goldenIndex: number | null
  /** Amplitude d'un ralenti inopiné en milieu de course (0 = aucun). Préserve le point final. */
  slowmoAmp: number
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)
const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5)
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * Construit le plan de suspense d'un tirage. Le premier tour (roundIndex 0) est le
 * plus solennel. Le faux-suspense est désactivé s'il y a trop peu de participants
 * (sinon le « cran voisin » n'a pas de sens visuel).
 *
 * `slots` = nombre de secteurs/cases du tirage courant (pour situer le secteur doré).
 * Toutes les « surprises » sont purement décoratives : aucune ne lit ni ne dérive du gagnant.
 */
export function planSuspense(
  roundIndex: number,
  total: number,
  slots: number,
  _pace: Pace,
  cfg: SuspenseConfig,
): SuspensePlan {
  const enoughForNearMiss = total - roundIndex >= 3
  // faux-suspense purement aléatoire (jamais forcé) : ~40% des tirages quand il est activé,
  // pour qu'il reste une surprise occasionnelle et que couper le réglage le supprime vraiment.
  const nearMiss = cfg.nearMiss && enoughForNearMiss && Math.random() < 0.4
  const finalSlowdown = cfg.slowdown
  const bonusLoops = cfg.surprises && Math.random() < 0.2 ? 1 : 0
  const goldenIndex = cfg.surprises && slots > 2 && Math.random() < 0.15 ? Math.floor(Math.random() * slots) : null
  // pas de ralenti inopiné s'il y a déjà un faux-suspense (on évite la surcharge)
  const slowmoAmp = cfg.surprises && !nearMiss && Math.random() < 0.15 ? 0.16 : 0
  return { nearMiss, finalSlowdown, bonusLoops, goldenIndex, slowmoAmp }
}

/** Plan « net » sans surprise propre, partageant les tours bonus (rouleaux non finaux du slot). */
export function plainPlan(bonusLoops: number): SuspensePlan {
  return { nearMiss: false, finalSlowdown: true, bonusLoops, goldenIndex: null, slowmoAmp: 0 }
}

/** Ralenti inopiné : remappe u en préservant u'(0)=0 et u'(1)=1, monotone si amp < 1. */
const slowmoWarp = (u: number, amp: number): number => u + (amp / (2 * Math.PI)) * Math.sin(2 * Math.PI * u)

/**
 * Position animée (offset depuis le départ) à appliquer.
 * - wheel : `rot = from + suspensePosition(u, to - from, sec, plan)`
 * - slot  : `pos = suspensePosition(u, to, 1, plan)` (from = 0)
 *
 * Trajectoire monotone croissante. Garantit `=== span` à `u >= 1`.
 */
export function suspensePosition(u: number, span: number, stepSize: number, plan: SuspensePlan): number {
  if (u >= 1) return span // garantie dure de l'invariant
  if (u <= 0) return 0

  // ralenti inopiné : remappage temporel (n'affecte ni u=0 ni u=1)
  const uu = plan.slowmoAmp ? slowmoWarp(u, plan.slowmoAmp) : u

  if (!plan.nearMiss || stepSize >= span) {
    return span * (plan.finalSlowdown ? easeOutQuint(uu) : easeOutCubic(uu))
  }

  // Faux-suspense en trois temps : décélère sur le voisin, plateau, dernier cran.
  const uHold = 0.86 // arrivée sur le cran voisin (span - stepSize)
  const uGo = 0.94 // début de l'ultime cran vers la cible
  const near = span - stepSize
  if (uu <= uHold) return near * easeOutQuint(uu / uHold)
  if (uu <= uGo) return near // plateau — semble s'arrêter sur le voisin
  const p = (uu - uGo) / (1 - uGo)
  return near + stepSize * easeInOutCubic(p)
}

/** True pendant la phase de ralenti final (pour basculer tick → ratchet). */
export function isSlowPhase(u: number, plan: SuspensePlan): boolean {
  return plan.finalSlowdown && u > 0.7
}

/**
 * Orchestre l'audio d'un spin : roulement de tambour pendant le ralenti, riser au
 * moment du faux-suspense. À instancier par spin ; appeler `update(u)` chaque frame
 * et `land()` à l'atterrissage.
 */
export class SuspenseAudio {
  private roll: { stop(): void } | null = null
  private riserFired = false

  constructor(private sfx: Sfx, private plan: SuspensePlan) {}

  update(u: number): void {
    if (this.plan.finalSlowdown && u > 0.6 && !this.roll) {
      this.roll = this.sfx.drumroll()
    }
    if (this.plan.nearMiss && !this.riserFired && u > 0.86 && u < 0.94) {
      this.riserFired = true
      this.sfx.riser(0.7)
    }
  }

  land(): void {
    if (this.roll) {
      this.roll.stop()
      this.roll = null
    }
  }
}
