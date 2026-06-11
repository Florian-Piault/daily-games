import type { GameDef, Participant } from '../types'
import { setupCanvas, loop, drawAvatar, drawName, drawBadge, drawRankPanel, Confetti, clamp01 } from './common'

interface Player {
  p: Participant
  rank: number
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

const INTRO = 1.2

export const potato: GameDef = {
  id: 'potato',
  name: 'Patate chaude',
  emoji: '🥔',
  tagline: 'Ça va exploser… mais sur qui ?',
  family: 'elim',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode } = ctx
    const n = ctx.order.length
    const confetti = new Confetti()

    const players: Player[] = ctx.participants.map((p) => ({
      p,
      rank: ctx.order.indexOf(p),
      alive: true,
    }))

    let eliminated = 0
    let holder = Math.floor(Math.random() * n)
    let path: number[] = []
    let hopIdx = 0
    let hopT = 0
    let phase: 'intro' | 'pass' | 'explode' | 'win' = 'intro'
    let phaseT = 0
    const sparks: Spark[] = []
    let flash = 0
    let done = false
    let timer: number | undefined

    /** Construit le trajet scripté de la manche : balade aléatoire qui finit sur la victime. */
    function buildRound() {
      const victim = players.findIndex((pl) => pl.p === ctx.order[n - 1 - eliminated])
      const alive = players.map((pl, i) => (pl.alive ? i : -1)).filter((i) => i >= 0)
      const dur = Math.max(1.4, 3 - eliminated * 0.25)
      const hop = Math.max(0.18, 0.32 - eliminated * 0.015)
      const hops = Math.max(3, Math.round(dur / hop))
      path = []
      let cur = holder
      for (let k = 0; k < hops - 1; k++) {
        const choices = alive.filter((i) => i !== cur && (alive.length <= 2 || i !== path[path.length - 2]))
        cur = choices[Math.floor(Math.random() * choices.length)]
        path.push(cur)
      }
      // la dernière passe atterrit sur la victime
      if (path[path.length - 1] === victim) {
        const alt =
          alive.find((i) => i !== victim && i !== path[path.length - 2]) ?? alive.find((i) => i !== victim)
        if (alt !== undefined) path[path.length - 1] = alt
      }
      path.push(victim)
      hopIdx = 0
      hopT = 0
      phase = 'pass'
      phaseT = 0
    }

    const hopDur = () => Math.max(0.16, 0.3 - eliminated * 0.015)

    const stop = loop((dt, t) => {
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      const panelW = 220
      const cx = (w - panelW) / 2
      const cy = h / 2 + 6
      const R = Math.max(90, Math.min((w - panelW) / 2 - 60, h / 2 - 70))
      const pr = Math.max(14, Math.min(24, R * 0.16))
      const pos = (i: number) => ({
        x: cx + Math.cos((i / n) * Math.PI * 2 - Math.PI / 2) * R,
        y: cy + Math.sin((i / n) * Math.PI * 2 - Math.PI / 2) * R,
      })

      if (phase === 'intro' && t > INTRO) buildRound()

      // bombe : position courante
      let bx = pos(holder).x
      let by = pos(holder).y - pr - 16
      if (phase === 'pass') {
        hopT += dt
        const from = hopIdx === 0 ? holder : path[hopIdx - 1]
        const to = path[hopIdx]
        const u = clamp01(hopT / hopDur())
        const a = pos(from)
        const b = pos(to)
        bx = a.x + (b.x - a.x) * u
        by = a.y + (b.y - a.y) * u - pr - 16 - Math.sin(Math.PI * u) * 36
        if (u >= 1) {
          hopT = 0
          hopIdx++
          sfx.tick()
          if (hopIdx >= path.length) {
            holder = path[path.length - 1]
            const victim = players[holder]
            victim.alive = false
            victim.deadAt = t
            eliminated++
            sfx.boom()
            flash = 1
            const vp = pos(holder)
            for (let i = 0; i < 30; i++) {
              sparks.push({
                x: vp.x,
                y: vp.y,
                vx: (Math.random() - 0.5) * 420,
                vy: (Math.random() - 0.5) * 420,
                life: 0.5 + Math.random() * 0.4,
                color: i % 3 ? '#fbbf24' : victim.p.color,
              })
            }
            phase = 'explode'
            phaseT = 0
          }
        }
      } else if (phase === 'explode') {
        phaseT += dt
        if (phaseT > 0.9) {
          if (eliminated >= n - 1) {
            phase = 'win'
          } else {
            const alive = players.map((pl, i) => (pl.alive ? i : -1)).filter((i) => i >= 0)
            holder = alive[Math.floor(Math.random() * alive.length)]
            buildRound()
          }
        }
      }

      // joueurs
      players.forEach((pl, i) => {
        const { x, y } = pos(i)
        if (pl.alive) {
          const tremble = phase === 'pass' && path[hopIdx] === i ? Math.sin(t * 40) * 2 : 0
          drawAvatar(c, pl.p, x + tremble, y, pr)
          drawName(c, pl.p.name, x, y - pr - 12, 12)
        } else {
          c.save()
          c.globalAlpha = pl.deadAt !== undefined && t - pl.deadAt < 0.5 ? 1 - (t - pl.deadAt) : 0.3
          c.filter = 'grayscale(1)'
          drawAvatar(c, pl.p, x, y, pr)
          c.restore()
          drawBadge(c, pl.rank + 1, x + pr + 4, y + pr - 2, 11)
        }
      })

      // bombe (sauf pendant l'explosion et après la victoire)
      if (phase === 'pass' || phase === 'intro') {
        c.save()
        c.beginPath()
        c.arc(bx, by, 13, 0, Math.PI * 2)
        c.fillStyle = '#0f172a'
        c.fill()
        c.strokeStyle = '#475569'
        c.lineWidth = 2
        c.stroke()
        // mèche + étincelle
        c.strokeStyle = '#a16207'
        c.beginPath()
        c.moveTo(bx + 6, by - 10)
        c.quadraticCurveTo(bx + 14, by - 18, bx + 10, by - 24)
        c.stroke()
        c.fillStyle = Math.random() > 0.5 ? '#fbbf24' : '#f87171'
        c.beginPath()
        c.arc(bx + 10 + (Math.random() - 0.5) * 4, by - 24 + (Math.random() - 0.5) * 4, 3, 0, Math.PI * 2)
        c.fill()
        c.restore()
      }

      // étincelles + flash
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life -= dt
        if (s.life <= 0) {
          sparks.splice(i, 1)
          continue
        }
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.vx *= 0.9
        s.vy *= 0.9
        c.save()
        c.globalAlpha = Math.min(1, s.life * 2)
        c.fillStyle = s.color
        c.fillRect(s.x - 2, s.y - 2, 4, 4)
        c.restore()
      }
      if (flash > 0) {
        flash = Math.max(0, flash - dt * 3)
        c.save()
        c.globalAlpha = flash * 0.35
        c.fillStyle = '#fff7ed'
        c.fillRect(0, 0, w, h)
        c.restore()
      }

      if (phase === 'win' && !done) {
        done = true
        sfx.fanfare()
        const winner = players.find((pl) => pl.alive)!
        const wp = pos(players.indexOf(winner))
        confetti.burst(wp.x, wp.y, 140)
        timer = window.setTimeout(() => ctx.onFinish(ctx.order), 2000)
      }
      if (done) {
        const winner = players.find((pl) => pl.alive)!
        const wp = pos(players.indexOf(winner))
        drawName(c, '👑', wp.x, wp.y - pr - 34, 30)
        const msg =
          mode === 'single' ? `${winner.p.name} est tiré·e au sort !` : `${winner.p.name} parlera en premier !`
        drawName(c, msg, cx, h - 30, 24, '#fbbf24')
      }

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
