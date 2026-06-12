import type { GameDef, Participant } from '../types'
import { setupCanvas, loop, drawAvatar, drawName, Confetti, drawRankPanel } from './common'

interface Fighter {
  p: Participant
  rank: number
  x: number
  y: number
  ang: number
  speed: number
  alive: boolean
  deadAt?: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

const INTRO = 1.6
const INTERVAL = 1.25

export const battle: GameDef = {
  id: 'battle',
  name: 'Battle Royale',
  emoji: '⚔️',
  tagline: 'Le dernier debout est tiré au sort',
  family: 'elim',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode, pace } = ctx
    const n = ctx.order.length
    const confetti = new Confetti()
    const intro = INTRO * pace.intro
    const interval = INTERVAL * pace.round

    const fighters: Fighter[] = ctx.participants.map((p) => ({
      p,
      rank: ctx.order.indexOf(p),
      x: 0,
      y: 0,
      ang: Math.random() * Math.PI * 2,
      speed: 70 + Math.random() * 50,
      alive: true,
    }))
    let placed = false
    let eliminated = 0
    const sparks: Spark[] = []
    let done = false
    let timer: number | undefined

    const stop = loop((dt, t) => {
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      const panelW = 220
      const cx = (w - panelW) / 2
      const cy = h / 2 + 6
      const R0 = Math.max(80, Math.min((w - panelW) / 2 - 40, h / 2 - 56))
      const Rmin = Math.max(70, R0 * 0.25)
      const R = R0 - (R0 - Rmin) * (eliminated / Math.max(1, n - 1))
      const fr = Math.max(14, Math.min(22, R * 0.16))

      if (!placed) {
        placed = true
        fighters.forEach((f) => {
          const a = Math.random() * Math.PI * 2
          const d = Math.sqrt(Math.random()) * R0 * 0.72
          f.x = cx + Math.cos(a) * d
          f.y = cy + Math.sin(a) * d
        })
      }

      // arène
      c.save()
      c.beginPath()
      c.arc(cx, cy, R, 0, Math.PI * 2)
      c.fillStyle = 'rgba(99,102,241,.08)'
      c.fill()
      c.lineWidth = 3
      c.strokeStyle = 'rgba(129,140,248,.8)'
      c.stroke()
      c.restore()

      // éliminations programmées
      const due = t > intro ? Math.min(n - 1, Math.floor((t - intro) / interval)) : 0
      if (eliminated < due && !done) {
        const victim = fighters.find((f) => f.p === ctx.order[n - 1 - eliminated])!
        victim.alive = false
        victim.deadAt = t
        eliminated++
        sfx.boom()
        for (let i = 0; i < 26; i++) {
          sparks.push({
            x: victim.x,
            y: victim.y,
            vx: (Math.random() - 0.5) * 360,
            vy: (Math.random() - 0.5) * 360,
            life: 0.6 + Math.random() * 0.3,
            color: victim.p.color,
          })
        }
      }

      // déplacement des survivants
      fighters.forEach((f) => {
        if (!f.alive) return
        if (t > intro * 0.5) {
          f.ang += (Math.random() - 0.5) * 3 * dt
          f.x += Math.cos(f.ang) * f.speed * dt
          f.y += Math.sin(f.ang) * f.speed * dt
        }
        const dx = f.x - cx
        const dy = f.y - cy
        const d = Math.hypot(dx, dy)
        const maxD = R - fr - 6
        if (d > maxD) {
          const a = Math.atan2(dy, dx)
          f.x = cx + Math.cos(a) * maxD
          f.y = cy + Math.sin(a) * maxD
          f.ang = a + Math.PI + (Math.random() - 0.5)
        }
      })

      fighters.forEach((f) => {
        if (f.alive) {
          drawAvatar(c, f.p, f.x, f.y, fr)
          drawName(c, f.p.name, f.x, f.y - fr - 11, 12)
        } else if (f.deadAt !== undefined && t - f.deadAt < 0.8) {
          const k = (t - f.deadAt) / 0.8
          c.save()
          c.globalAlpha = 1 - k
          drawAvatar(c, f.p, f.x, f.y, fr * (1 - k))
          c.restore()
        }
      })

      // étincelles
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life -= dt
        if (s.life <= 0) {
          sparks.splice(i, 1)
          continue
        }
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.vx *= 0.92
        s.vy *= 0.92
        c.save()
        c.globalAlpha = Math.min(1, s.life * 2)
        c.fillStyle = s.color
        c.fillRect(s.x - 2, s.y - 2, 4, 4)
        c.restore()
      }

      if (eliminated >= n - 1 && !done) {
        done = true
        sfx.fanfare()
        const winner = fighters.find((f) => f.alive)!
        confetti.burst(winner.x, winner.y, 140)
        timer = window.setTimeout(() => ctx.onFinish(ctx.order), 2000 * pace.result)
      }
      if (done) {
        const winner = fighters.find((f) => f.alive)!
        drawName(c, '★', winner.x, winner.y - fr - 36, 30)
        const msg =
          mode === 'single'
            ? `${winner.p.name} est tiré·e au sort !`
            : `${winner.p.name} parlera en premier !`
        drawName(c, msg, cx, h - 30, 24, '#fbbf24')
      }

      // panneau : les éliminés se révèlent du bas vers le haut, le survivant à la fin
      const entries: (Participant | null)[] = ctx.order.map((p, i) => {
        if (i === 0) return done ? p : null
        return n - i <= eliminated ? p : null
      })
      drawRankPanel(c, w - panelW + 8, 24, h - 50, n, entries, mode === 'single' ? 'Éliminations' : 'Ordre de passage')

      confetti.step(c, dt)
    })

    return () => {
      stop()
      view.dispose()
      window.clearTimeout(timer)
    }
  },
}
