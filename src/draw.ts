import type { Participant } from './types'

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Tirage aléatoire avec anti-répétition légère : le premier d'hier ne peut pas ressortir premier. */
export function computeOrder(parts: Participant[], forbiddenFirst: string | null): Participant[] {
  const order = shuffle(parts)
  if (forbiddenFirst && order.length > 1 && order[0].name === forbiddenFirst) {
    const j = 1 + Math.floor(Math.random() * (order.length - 1))
    ;[order[0], order[j]] = [order[j], order[0]]
  }
  return order
}
