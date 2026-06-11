import type { GameDef, Participant } from '../types'
import { setupCanvas, loop, drawAvatar, drawName, drawBadge, drawRankPanel, Confetti, clamp01 } from './common'
import { shuffle } from '../draw'

interface Player {
  p: Participant
  rank: number
  alive: boolean
  /** Position polaire courante (angle + facteur de rayon : 1 = ronde, 0.55 = assis, 1.3 = éliminé). */
  ang: number
  radF: number
  fromAng: number
  fromRadF: number
  toAng: number
  toRadF: number
  seated: boolean
}

type Phase = 'spin' | 'dive' | 'sad' | 'reset' | 'win'

const NOTES = [523.25, 659.25, 783.99, 659.25, 880, 783.99]
const lerpAng = (a: number, b: number, u: number) => {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  return a + d * u
}

export const chairs: GameDef = {
  id: 'chairs',
  name: 'Chaises musicales',
  emoji: '🪑',
  tagline: 'La musique s’arrête… qui reste debout ?',
  family: 'elim',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode, pace } = ctx
    const n = ctx.order.length
    const confetti = new Confetti()

    const players: Player[] = ctx.participants.map((p, i) => ({
      p,
      rank: ctx.order.indexOf(p),
      alive: true,
      ang: (i / n) * Math.PI * 2,
      radF: 1,
      fromAng: 0,
      fromRadF: 1,
      toAng: 0,
      toRadF: 1,
      seated: false,
    }))

    let eliminated = 0
    let phase: Phase = 'spin'
    let phaseT = 0
    let chairOffset = Math.random() * Math.PI * 2
    let lastBeat = -1
    let done = false
    let timer: number | undefined

    const chairCount = () => n - eliminated - 1
    const chairAng = (j: number) => chairOffset + (j / Math.max(1, chairCount())) * Math.PI * 2
    const spinDur = () => Math.max(1.2, (n > 8 ? 2.2 : 3) - eliminated * 0.3) * pace.round

    function startDive() {
      const victim = players.find((pl) => pl.p === ctx.order[n - 1 - eliminated])!
      const survivors = shuffle(players.filter((pl) => pl.alive && pl !== victim))
      const free = new Set(Array.from({ length: chairCount() }, (_, j) => j))
      players.forEach((pl) => {
        pl.fromAng = pl.ang
        pl.fromRadF = pl.radF
      })
      survivors.forEach((pl) => {
        let best = -1
        let bestD = Infinity
        free.forEach((j) => {
          const d = Math.abs(((chairAng(j) - pl.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
          if (d < bestD) {
            bestD = d
            best = j
          }
        })
        free.delete(best)
        pl.toAng = chairAng(best)
        pl.toRadF = 0.55
      })
      victim.toAng = victim.ang
      victim.toRadF = 1.18
      phase = 'dive'
      phaseT = 0
    }

    const stop = loop((dt, t) => {
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      const panelW = 220
      const cx = (w - panelW) / 2
      const cy = h / 2 + 8
      const R = Math.max(95, Math.min((w - panelW) / 2 - 60, h / 2 - 72))
      const pr = Math.max(14, Math.min(22, R * 0.15))
      const pos = (ang: number, radF: number) => ({
        x: cx + Math.cos(ang) * R * radF,
        y: cy + Math.sin(ang) * R * radF,
      })

      phaseT += dt

      if (phase === 'spin') {
        const omega = 1.5 + eliminated * 0.12
        players.forEach((pl) => {
          if (pl.alive) pl.ang += omega * dt
        })
        // petite mélodie de manège pendant la ronde
        const beat = Math.floor(t / 0.18)
        if (beat !== lastBeat) {
          lastBeat = beat
          sfx.tone(NOTES[beat % NOTES.length], 0.13, { type: 'square', vol: 0.06 })
        }
        if (phaseT > spinDur()) startDive()
      } else if (phase === 'dive') {
        const u = clamp01(phaseT / (0.55 * pace.round))
        const e = u * u * (3 - 2 * u)
        players.forEach((pl) => {
          if (!pl.alive) return
          pl.ang = lerpAng(pl.fromAng, pl.toAng, e)
          pl.radF = pl.fromRadF + (pl.toRadF - pl.fromRadF) * e
        })
        if (u >= 1) {
          const victim = players.find((pl) => pl.p === ctx.order[n - 1 - eliminated])!
          victim.alive = false
          eliminated++
          sfx.tone(330, 0.8, { type: 'sawtooth', vol: 0.18, glideTo: 110 })
          players.forEach((pl) => {
            if (pl.alive) pl.seated = true
          })
          phase = 'sad'
          phaseT = 0
        }
      } else if (phase === 'sad') {
        // la victime glisse hors du cercle
        const victim = players.find((pl) => !pl.alive && pl.radF < 1.3)
        if (victim) victim.radF = Math.min(1.3, victim.radF + dt * 0.4)
        if (phaseT > 1.3 * pace.round) {
          if (players.filter((pl) => pl.alive).length === 1) {
            phase = 'win'
          } else {
            chairOffset = Math.random() * Math.PI * 2
            players.forEach((pl) => {
              if (!pl.alive) return
              pl.fromAng = pl.ang
              pl.fromRadF = pl.radF
              pl.toAng = pl.ang
              pl.toRadF = 1
              pl.seated = false
            })
            phase = 'reset'
            phaseT = 0
          }
        }
      } else if (phase === 'reset') {
        const u = clamp01(phaseT / (0.5 * pace.round))
        players.forEach((pl) => {
          if (!pl.alive) return
          pl.radF = pl.fromRadF + (pl.toRadF - pl.fromRadF) * u
        })
        if (u >= 1) {
          phase = 'spin'
          phaseT = 0
        }
      }

      // chaises (en phase finale, il ne reste que celle du gagnant)
      for (let j = 0; j < chairCount() + (phase === 'win' ? 1 : 0); j++) {
        const cp = pos(chairAng(j), 0.55)
        drawName(c, '🪑', cp.x, cp.y, Math.max(20, pr * 1.2))
      }

      // joueurs
      players.forEach((pl) => {
        const { x, y } = pos(pl.ang, pl.radF)
        if (pl.alive) {
          const bob = phase === 'spin' ? Math.sin(t * 10 + pl.rank) * 3 : 0
          drawAvatar(c, pl.p, x, y - (pl.seated ? 14 : 0) + bob, pr)
          drawName(c, pl.p.name, x, y - pr - 14 - (pl.seated ? 14 : 0), 12)
        } else {
          c.save()
          c.globalAlpha = 0.35
          drawAvatar(c, pl.p, x, y, pr)
          c.restore()
          drawBadge(c, pl.rank + 1, x + pr + 4, y + pr - 2, 11)
        }
      })

      if (phase === 'win' && !done) {
        done = true
        sfx.fanfare()
        const winner = players.find((pl) => pl.alive)!
        const wp = pos(winner.ang, winner.radF)
        confetti.burst(wp.x, wp.y, 140)
        timer = window.setTimeout(() => ctx.onFinish(ctx.order), 2000 * pace.result)
      }
      if (done) {
        const winner = players.find((pl) => pl.alive)!
        const wp = pos(winner.ang, winner.radF)
        drawName(c, '👑', wp.x, wp.y - pr - 40, 30)
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
