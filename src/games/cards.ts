import type { GameDef, Participant } from '../types'
import { setupCanvas, loop, drawAvatar, drawName, drawBadge, drawRankPanel, Confetti, clamp01, easeOutCubic, roundRectPath } from './common'
import { shuffle } from '../draw'

interface Card {
  p: Participant
  rank: number
  /** Indice de case dans la grille (assignation visuelle aléatoire). */
  slot: number
  flipT: number | null
  revealed: boolean
}

const SHUFFLE_DUR = 1.6
const FLIP_DUR = 0.55

export const cards: GameDef = {
  id: 'cards',
  name: 'Cartes mystère',
  emoji: '🃏',
  tagline: 'Retournées une à une, la dernière gagne',
  family: 'elim',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode } = ctx
    const n = ctx.order.length
    const confetti = new Confetti()

    const slots = shuffle(ctx.order.map((_, i) => i))
    const cardList: Card[] = ctx.participants.map((p) => {
      const rank = ctx.order.indexOf(p)
      return { p, rank, slot: slots[rank], flipT: null, revealed: false }
    })

    const interval = n > 8 ? 1.05 : 1.4
    // mode ordre : révélation du dernier rang vers le premier ; la carte n°1 attend un peu plus
    const revealAt = (rank: number) =>
      SHUFFLE_DUR + 0.8 + (n - 1 - rank) * interval + (rank === 0 ? 0.9 : 0)

    // mode une-personne : le surlignage hésite sur quelques cartes avant de choisir
    const wanderSeq: number[] = []
    if (mode === 'single') {
      let cur = -1
      for (let k = 0; k < Math.min(6, n + 2); k++) {
        let next = Math.floor(Math.random() * n)
        if (next === cur) next = (next + 1) % n
        wanderSeq.push(next)
        cur = next
      }
      wanderSeq.push(cardList.find((cd) => cd.rank === 0)!.slot)
    }
    const WANDER_STEP = 0.42
    const wanderStart = SHUFFLE_DUR + 0.5
    const singleFlipAt = wanderStart + wanderSeq.length * WANDER_STEP + 0.5

    let lastWander = -1
    let done = false
    let revealedCount = 0
    let timer: number | undefined

    const stop = loop((dt, t) => {
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      const panelW = mode === 'order' ? 220 : 0
      const areaW = w - panelW
      const cols = Math.ceil(Math.sqrt(n * 1.4))
      const rows = Math.ceil(n / cols)
      const cw = Math.min(116, Math.max(64, (areaW - 100) / cols - 16))
      const ch = cw * 1.38
      const gridW = cols * (cw + 16) - 16
      const gridH = rows * (ch + 16) - 16
      const gx = (areaW - gridW) / 2
      const gy = Math.max(64, (h - gridH) / 2)
      const slotPos = (s: number) => ({
        x: gx + (s % cols) * (cw + 16),
        y: gy + Math.floor(s / cols) * (ch + 16),
      })

      // surlignage baladeur (mode une-personne)
      let highlight = -1
      if (mode === 'single' && t > wanderStart && !done) {
        const step = Math.min(wanderSeq.length - 1, Math.floor((t - wanderStart) / WANDER_STEP))
        highlight = wanderSeq[step]
        if (step !== lastWander) {
          lastWander = step
          sfx.tick()
        }
      }

      cardList.forEach((card) => {
        // arrivée depuis la pile centrale pendant le mélange
        const su = easeOutCubic(clamp01((t - card.slot * 0.06) / (SHUFFLE_DUR * 0.55)))
        const target = slotPos(card.slot)
        const x = areaW / 2 - cw / 2 + (target.x - (areaW / 2 - cw / 2)) * su
        const y = h / 2 - ch / 2 + (target.y - (h / 2 - ch / 2)) * su

        // déclenchement du retournement
        const flipStart = mode === 'order' ? revealAt(card.rank) : card.rank === 0 ? singleFlipAt : Infinity
        if (card.flipT === null && t >= flipStart) {
          card.flipT = t
        }
        let fu = 0
        if (card.flipT !== null) {
          fu = clamp01((t - card.flipT) / FLIP_DUR)
          if (!card.revealed && fu >= 0.5) {
            card.revealed = true
            revealedCount++
            sfx.pop()
            if (card.rank === 0) {
              confetti.burst(x + cw / 2, y + ch / 2, 130)
              sfx.fanfare()
            }
          }
        }
        const scaleX = Math.abs(Math.cos(Math.PI * fu))

        c.save()
        c.translate(x + cw / 2, y + ch / 2)
        c.scale(Math.max(0.02, scaleX), 1)
        if (!card.revealed) {
          // dos de carte
          c.fillStyle = '#312e81'
          roundRectPath(c, -cw / 2, -ch / 2, cw, ch, 10)
          c.fill()
          c.strokeStyle = highlight === card.slot ? '#fbbf24' : 'rgba(148,163,184,.4)'
          c.lineWidth = highlight === card.slot ? 4 : 2
          c.stroke()
          c.save()
          roundRectPath(c, -cw / 2, -ch / 2, cw, ch, 10)
          c.clip()
          c.strokeStyle = 'rgba(129,140,248,.35)'
          c.lineWidth = 1.5
          for (let d = -ch; d < ch; d += 12) {
            c.beginPath()
            c.moveTo(-cw / 2 + d, -ch / 2)
            c.lineTo(-cw / 2 + d + ch, ch / 2)
            c.stroke()
          }
          c.restore()
          drawName(c, '?', 0, 0, cw * 0.42, '#c7d2fe')
        } else {
          // face
          c.fillStyle = '#e2e8f0'
          roundRectPath(c, -cw / 2, -ch / 2, cw, ch, 10)
          c.fill()
          c.strokeStyle = card.rank === 0 ? '#fbbf24' : 'rgba(2,6,23,.4)'
          c.lineWidth = card.rank === 0 ? 4 : 2
          c.stroke()
          drawAvatar(c, card.p, 0, -ch * 0.14, Math.min(30, cw * 0.3))
          c.save()
          c.font = `700 ${Math.min(14, cw * 0.16)}px system-ui, sans-serif`
          c.textAlign = 'center'
          c.textBaseline = 'middle'
          c.fillStyle = '#0f172a'
          c.fillText(card.p.name, 0, ch * 0.24)
          c.restore()
        }
        c.restore()
        if (card.revealed) drawBadge(c, card.rank + 1, x + cw - 6, y + 8, 12)
      })

      if (mode === 'order') {
        const entries: (Participant | null)[] = ctx.order.map((p, i) =>
          cardList.find((cd) => cd.rank === i)!.revealed ? p : null,
        )
        drawRankPanel(c, w - panelW + 8, 24, h - 50, n, entries)
      }

      confetti.step(c, dt)

      const needed = mode === 'single' ? 1 : n
      if (revealedCount >= needed && !done) {
        done = true
        timer = window.setTimeout(() => ctx.onFinish(ctx.order), 1800)
      }
      if (done) {
        const msg = mode === 'single' ? `🎉 ${ctx.order[0].name} est tiré·e au sort !` : '🏁 Ordre déterminé !'
        drawName(c, msg, areaW / 2, h - 26, 24, '#fbbf24')
      }
    })

    return () => {
      stop()
      view.dispose()
      window.clearTimeout(timer)
    }
  },
}
