import type { GameDef, Participant } from '../types'
import { setupCanvas, loop, drawAvatar, drawName, drawBadge, Confetti, clamp01 } from './common'

interface Racer {
  p: Participant
  T: number
  rank: number
  phase: number
  freq: number
  finished: boolean
}

const COUNTDOWN = 2.4

export const race: GameDef = {
  id: 'race',
  name: 'La Grande Course',
  emoji: '🏁',
  tagline: "L'ordre d'arrivée fait l'ordre de passage",
  family: 'rank',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode, pace } = ctx
    const n = ctx.order.length
    const confetti = new Confetti()
    const countdown = COUNTDOWN * pace.intro

    // temps d'arrivée par rang, strictement croissants (jitter < écart minimal)
    const tFirst = 4.2 * pace.continuous
    const tLast = Math.min(9.5, 4.2 + Math.max(1.5, n * 0.55)) * pace.continuous
    const times = ctx.order.map((_, i) => {
      const u = n === 1 ? 0 : i / (n - 1)
      return tFirst + u * (tLast - tFirst) + (i > 0 ? Math.random() * 0.12 * pace.continuous : 0)
    })

    const racers: Racer[] = ctx.participants.map((p) => {
      const rank = ctx.order.indexOf(p)
      return {
        p,
        T: times[rank],
        rank,
        phase: Math.random() * Math.PI * 2,
        freq: 2 + Math.random() * 2,
        finished: false,
      }
    })

    let beeped = -1
    let done = false
    let timer: number | undefined

    const stop = loop((dt, t) => {
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      const startX = 90
      const finishX = w - 130
      const topY = 64
      const laneH = Math.min(76, (h - topY - 30) / n)
      const r = Math.min(24, laneH * 0.36)

      if (t < countdown) {
        const sec = Math.floor(t)
        if (sec !== beeped) {
          beeped = sec
          sfx.beep(false)
        }
      } else if (beeped !== -2) {
        beeped = -2
        sfx.beep(true)
      }

      const raceT = Math.max(0, t - countdown)

      // couloirs
      racers.forEach((_, lane) => {
        const y = topY + lane * laneH
        c.fillStyle = lane % 2 ? 'rgba(148,163,184,.05)' : 'rgba(148,163,184,.1)'
        c.fillRect(0, y, w, laneH - 3)
      })

      // ligne d'arrivée en damier
      const lineX = finishX + r + 12
      for (let yy = topY; yy < topY + n * laneH; yy += 12) {
        c.fillStyle = Math.floor(yy / 12) % 2 ? '#cbd5e1' : '#334155'
        c.fillRect(lineX, yy, 10, 12)
      }

      racers.forEach((racer, lane) => {
        const y = topY + lane * laneH + laneH / 2
        const u = clamp01(racer.T <= 0 ? 1 : raceT / racer.T)
        const wob = 0.07 * Math.sin(racer.phase + raceT * racer.freq) * Math.sin(Math.PI * u)
        const x = startX + (finishX - startX) * clamp01(u + wob)
        const bob = racer.finished || raceT <= 0 ? 0 : Math.sin(t * 14 + racer.phase) * 3
        if (!racer.finished && u >= 1) {
          racer.finished = true
          sfx.pop()
          if (racer.rank === 0) confetti.burst(finishX, y, 110)
        }
        drawAvatar(c, racer.p, x, y + bob, r)
        drawName(c, racer.p.name, x, y - r - 12, 13)
        if (racer.finished) drawBadge(c, racer.rank + 1, x + r + 17, y, 12)
      })

      if (t < countdown + 0.6) {
        const remain = countdown - t
        const label = remain > 0 ? String(Math.ceil(remain)) : 'GO !'
        drawName(c, label, w / 2, h / 2, 80, remain > 0 ? '#e2e8f0' : '#34d399')
      }

      confetti.step(c, dt)

      const finishedCount = racers.filter((x) => x.finished).length
      const over = mode === 'single' ? finishedCount >= 1 : finishedCount >= n
      if (over && !done) {
        done = true
        sfx.fanfare()
        timer = window.setTimeout(() => ctx.onFinish(ctx.order), 1600 * pace.result)
      }
      if (done) {
        const msg = mode === 'single' ? `🏆 ${ctx.order[0].name} !` : '🏁 Ordre déterminé !'
        drawName(c, msg, w / 2, 32, 26, '#fbbf24')
      }
    })

    return () => {
      stop()
      view.dispose()
      window.clearTimeout(timer)
    }
  },
}
