import type { GameDef, Participant } from '../types'
import { setupCanvas, loop, drawAvatar, drawName, drawBadge, drawRankPanel, Confetti, clamp01 } from './common'
import { shuffle } from '../draw'

interface Jumper {
  p: Participant
  rank: number
  /** Position horizontale de largage, en fraction de la largeur de zone. */
  fx: number
  dropAt: number | null
  landAt: number
  phase: number
  freq: number
  landed: boolean
}

const PLANE_DUR = 2.4

export const airdrop: GameDef = {
  id: 'airdrop',
  name: 'Largage aérien',
  emoji: '🪂',
  tagline: "L'ordre d'atterrissage décide",
  family: 'rank',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode, pace } = ctx
    const n = ctx.order.length
    const confetti = new Confetti()
    const planeDur = PLANE_DUR * pace.intro

    // temps d'atterrissage absolus, strictement croissants par rang (jitter < écart minimal)
    const tFirst = 5 * pace.continuous
    const tLast = Math.min(12, 5 + Math.max(1.6, n * 0.6)) * pace.continuous
    const slots = shuffle(ctx.order.map((_, i) => i))
    const jumpers: Jumper[] = ctx.participants.map((p) => {
      const rank = ctx.order.indexOf(p)
      const u = n === 1 ? 0 : rank / (n - 1)
      return {
        p,
        rank,
        fx: n === 1 ? 0.5 : 0.1 + (slots[rank] / (n - 1)) * 0.8,
        dropAt: null,
        landAt: tFirst + u * (tLast - tFirst) + (rank > 0 ? Math.random() * 0.15 * pace.continuous : 0),
        phase: Math.random() * Math.PI * 2,
        freq: 1.4 + Math.random() * 1.2,
        landed: false,
      }
    })

    let done = false
    let timer: number | undefined

    const stop = loop((dt, t) => {
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      const panelW = mode === 'order' ? 220 : 0
      const areaW = w - panelW
      const skyTop = 54
      const groundY = h - 56
      const r = Math.min(22, Math.max(14, areaW / (n * 4)))

      // sol
      c.save()
      c.fillStyle = 'rgba(52,211,153,.12)'
      c.fillRect(0, groundY + r + 6, areaW, h - groundY)
      c.strokeStyle = 'rgba(52,211,153,.5)'
      c.lineWidth = 2
      c.beginPath()
      c.moveTo(0, groundY + r + 6)
      c.lineTo(areaW, groundY + r + 6)
      c.stroke()
      c.restore()

      // avion qui traverse en larguant
      const planeX = -70 + (areaW + 180) * Math.min(1, t / planeDur)
      if (t < planeDur + 0.6) {
        drawName(c, '✈️', planeX, skyTop, 34)
      }
      jumpers.forEach((j) => {
        if (j.dropAt === null && planeX >= j.fx * areaW) {
          j.dropAt = t
          sfx.tick()
        }
      })

      jumpers.forEach((j) => {
        if (j.dropAt === null) return
        const v = clamp01((t - j.dropAt) / Math.max(0.2, j.landAt - j.dropAt))
        const chuteOpen = v >= 0.16 && v < 1
        const fall = Math.pow(v, 0.65) // chute libre rapide puis descente freinée
        const y = skyTop + (groundY - skyTop) * fall
        const sway = chuteOpen ? Math.sin(t * j.freq + j.phase) * 20 * (1 - v) : 0
        const x = j.fx * areaW + sway

        if (!j.landed && v >= 1) {
          j.landed = true
          sfx.pop()
          confetti.burst(x, groundY, j.rank === 0 ? 110 : 24)
        }
        if (!j.landed && chuteOpen) {
          // parachute aux couleurs du participant
          c.save()
          c.beginPath()
          c.arc(x, y - r - 14, r + 8, Math.PI, 0)
          c.fillStyle = j.p.color
          c.globalAlpha = 0.9
          c.fill()
          c.globalAlpha = 1
          c.strokeStyle = 'rgba(2,6,23,.5)'
          c.lineWidth = 1.5
          c.beginPath()
          c.moveTo(x - r - 8, y - r - 14)
          c.lineTo(x, y - r * 0.4)
          c.moveTo(x + r + 8, y - r - 14)
          c.lineTo(x, y - r * 0.4)
          c.stroke()
          c.restore()
        }
        drawAvatar(c, j.p, x, j.landed ? groundY : y, r)
        drawName(c, j.p.name, x, (j.landed ? groundY : y) - r - (chuteOpen ? 34 : 12), 12)
        if (j.landed) drawBadge(c, j.rank + 1, x + r + 14, groundY, 12)
      })

      if (mode === 'order') {
        const entries: (Participant | null)[] = ctx.order.map((p) => (jumpers.find((j) => j.p === p)!.landed ? p : null))
        drawRankPanel(c, w - panelW + 8, 24, h - 50, n, entries)
      }

      confetti.step(c, dt)

      const landedCount = jumpers.filter((j) => j.landed).length
      const over = mode === 'single' ? landedCount >= 1 : landedCount >= n
      if (over && !done) {
        done = true
        sfx.fanfare()
        timer = window.setTimeout(() => ctx.onFinish(ctx.order), 1600 * pace.result)
      }
      if (done) {
        const msg = mode === 'single' ? `${ctx.order[0].name} est tiré·e au sort !` : 'Ordre déterminé !'
        drawName(c, msg, areaW / 2, 30, 24, '#fbbf24')
      }
    })

    return () => {
      stop()
      view.dispose()
      window.clearTimeout(timer)
    }
  },
}
