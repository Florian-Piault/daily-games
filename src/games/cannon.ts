import type { GameDef, Participant } from '../types'
import { setupCanvas, loop, drawAvatar, drawName, drawBadge, drawRankPanel, Confetti, clamp01 } from './common'
import { shuffle } from '../draw'

interface Shot {
  p: Participant
  rank: number
  /** Distance d'atterrissage en fraction de la piste (rang 1 = le plus loin). */
  fd: number
  fireAt: number
  flight: number
  spin: number
  landed: boolean
}

const INTRO = 1.2

export const cannon: GameDef = {
  id: 'cannon',
  name: 'Canon de cirque',
  emoji: '🎪',
  tagline: 'Le plus long vol parle en premier',
  family: 'rank',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode } = ctx
    const n = ctx.order.length
    const confetti = new Confetti()

    // ordre de tir mélangé ; la distance encode le rang (jitter < écart entre rangs)
    const fireSeq = shuffle(ctx.participants)
    const gap = 1 / Math.max(1, n)
    const shots: Shot[] = fireSeq.map((p, i) => {
      const rank = ctx.order.indexOf(p)
      const u = n === 1 ? 0 : rank / (n - 1)
      return {
        p,
        rank,
        fd: 0.97 - u * 0.72 + (rank > 0 ? (Math.random() - 0.5) * gap * 0.45 : 0),
        fireAt: INTRO + i * Math.max(0.95, 1.5 - i * 0.05),
        flight: 1.5,
        spin: 3 + Math.random() * 3,
        landed: false,
      }
    })

    let fired = -1
    let done = false
    let timer: number | undefined

    const stop = loop((dt, t) => {
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      const panelW = mode === 'order' ? 220 : 0
      const areaW = w - panelW
      const groundY = h - 70
      const muzzle = { x: 86, y: groundY - 36 }
      const trackX0 = 170
      const trackX1 = areaW - 50
      const r = Math.min(20, Math.max(13, areaW / (n * 5)))

      // piste avec graduations
      c.save()
      c.strokeStyle = 'rgba(148,163,184,.4)'
      c.lineWidth = 2
      c.beginPath()
      c.moveTo(30, groundY + r + 8)
      c.lineTo(areaW - 20, groundY + r + 8)
      c.stroke()
      c.strokeStyle = 'rgba(148,163,184,.2)'
      for (let g = 0; g <= 10; g++) {
        const gx = trackX0 + ((trackX1 - trackX0) * g) / 10
        c.beginPath()
        c.moveTo(gx, groundY + r + 8)
        c.lineTo(gx, groundY + r - 2)
        c.stroke()
      }
      c.restore()

      // tirs déclenchés
      const due = shots.filter((s) => s.fireAt <= t).length - 1
      if (due > fired && !done) {
        fired = due
        sfx.boom()
      }

      // canon (recule brièvement après un tir)
      const lastFire = fired >= 0 ? shots[fired].fireAt : -10
      const recoil = Math.max(0, 1 - (t - lastFire) / 0.25) * 9
      c.save()
      c.translate(muzzle.x - recoil, muzzle.y)
      c.rotate(-0.62)
      c.fillStyle = '#334155'
      c.beginPath()
      c.roundRect(-16, -16, 74, 32, 12)
      c.fill()
      c.strokeStyle = '#6366f1'
      c.lineWidth = 2.5
      c.stroke()
      c.restore()
      c.save()
      c.beginPath()
      c.arc(muzzle.x - 14, groundY + 2, 17, 0, Math.PI * 2)
      c.fillStyle = '#1e293b'
      c.fill()
      c.strokeStyle = '#6366f1'
      c.lineWidth = 2.5
      c.stroke()
      c.restore()
      if (t - lastFire < 0.16) drawName(c, '💥', muzzle.x + 52, muzzle.y - 52, 30)

      shots.forEach((s) => {
        if (s.fireAt > t) return
        const v = clamp01((t - s.fireAt) / s.flight)
        const landX = trackX0 + (trackX1 - trackX0) * s.fd
        const x = muzzle.x + 40 + (landX - muzzle.x - 40) * v
        const peak = 120 + (h - 260) * s.fd
        const y = muzzle.y - 40 - Math.sin(Math.PI * v) * peak + (groundY - muzzle.y + 40) * v

        if (!s.landed && v >= 1) {
          s.landed = true
          sfx.pop()
          confetti.burst(landX, groundY, s.rank === 0 ? 110 : 22)
        }

        if (s.landed) {
          drawAvatar(c, s.p, landX, groundY, r)
          drawName(c, s.p.name, landX, groundY - r - 12, 12)
          drawBadge(c, s.rank + 1, landX + r + 13, groundY - r - 10, 11)
        } else {
          // traînée
          c.save()
          for (let k = 1; k <= 4; k++) {
            const pv = clamp01(v - k * 0.04)
            const px = muzzle.x + 40 + (landX - muzzle.x - 40) * pv
            const py = muzzle.y - 40 - Math.sin(Math.PI * pv) * peak + (groundY - muzzle.y + 40) * pv
            c.globalAlpha = 0.25 - k * 0.05
            c.beginPath()
            c.arc(px, py, r * 0.5, 0, Math.PI * 2)
            c.fillStyle = s.p.color
            c.fill()
          }
          c.restore()
          c.save()
          c.translate(x, y)
          c.rotate(v * s.spin)
          drawAvatar(c, s.p, 0, 0, r)
          c.restore()
        }
      })

      if (mode === 'order') {
        const entries: (Participant | null)[] = ctx.order.map((p) => (shots.find((s) => s.p === p)!.landed ? p : null))
        drawRankPanel(c, w - panelW + 8, 24, h - 50, n, entries)
      }

      confetti.step(c, dt)

      const landedCount = shots.filter((s) => s.landed).length
      if (landedCount >= n && !done) {
        done = true
        sfx.fanfare()
        timer = window.setTimeout(() => ctx.onFinish(ctx.order), 1800)
      }
      if (done) {
        const msg = mode === 'single' ? `🎉 ${ctx.order[0].name} est tiré·e au sort !` : '🏁 Ordre déterminé !'
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
