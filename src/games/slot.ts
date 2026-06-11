import type { GameDef, Participant } from '../types'
import {
  setupCanvas,
  loop,
  drawAvatar,
  drawName,
  Confetti,
  drawRankPanel,
  easeOutCubic,
  roundRectPath,
} from './common'
import { shuffle } from '../draw'

interface Spin {
  strip: Participant[]
  to: number
  t: number
  dur: number
  landed: boolean
  pause: number
}

export const slot: GameDef = {
  id: 'slot',
  name: 'Machine à sous',
  emoji: '🎰',
  tagline: 'Le rouleau décide',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode } = ctx
    const rounds = mode === 'single' ? 1 : ctx.order.length
    const results: Participant[] = []
    const confetti = new Confetti()
    let spin: Spin | null = null
    let lastTick = -1
    let done = false
    let timer: number | undefined

    function startSpin() {
      const remaining = ctx.order.filter((p) => !results.includes(p))
      const strip = shuffle(remaining)
      const target = ctx.order[results.length]
      const idx = strip.indexOf(target)
      const loops = strip.length <= 2 ? 7 : strip.length <= 4 ? 5 : 4
      spin = {
        strip,
        to: loops * strip.length + idx,
        t: 0,
        dur: results.length === 0 ? 4.2 : Math.max(1.8, 3.6 - results.length * 0.45),
        landed: false,
        pause: 0,
      }
      lastTick = -1
    }
    startSpin()

    const stop = loop((dt) => {
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      const panelW = mode === 'order' ? 220 : 0
      const areaW = w - panelW
      const mw = Math.min(440, Math.max(260, areaW - 40))
      const rowH = Math.min(96, Math.max(56, (h - 200) / 3))
      const wh = rowH * 3
      const mx = (areaW - mw) / 2
      const my = (h - wh) / 2

      let pos = 0
      if (spin) {
        if (!spin.landed) {
          spin.t += dt
          const u = Math.min(1, spin.t / spin.dur)
          pos = spin.to * easeOutCubic(u)
          if (Math.floor(pos) !== lastTick) {
            lastTick = Math.floor(pos)
            sfx.tick()
          }
          if (u >= 1) {
            pos = spin.to
            spin.landed = true
            sfx.pop()
          }
        } else {
          pos = spin.to
          if (!done) {
            spin.pause += dt
            if (spin.pause > 1) {
              results.push(ctx.order[results.length])
              if (results.length >= rounds) {
                done = true
                sfx.fanfare()
                confetti.burst(areaW / 2, my, 130)
                timer = window.setTimeout(() => ctx.onFinish(ctx.order), 1800)
              } else {
                startSpin()
              }
            }
          }
        }
      }

      // corps de la machine
      c.save()
      c.fillStyle = '#1e293b'
      roundRectPath(c, mx - 18, my - 18, mw + 36, wh + 36, 22)
      c.fill()
      c.strokeStyle = '#6366f1'
      c.lineWidth = 3
      c.stroke()
      c.fillStyle = '#0b1222'
      roundRectPath(c, mx, my, mw, wh, 12)
      c.fill()
      c.restore()

      if (spin) {
        const len = spin.strip.length
        const frac = pos - Math.floor(pos)
        const base = Math.floor(pos)
        c.save()
        roundRectPath(c, mx, my, mw, wh, 12)
        c.clip()
        for (let k = -2; k <= 2; k++) {
          const item = spin.strip[(((base + k) % len) + len) % len]
          const y = my + wh / 2 + (k - frac) * rowH
          const isCenter = spin.landed && k === 0
          c.globalAlpha = isCenter ? 1 : Math.max(0.25, 1 - Math.abs(k - frac) * 0.45)
          drawAvatar(c, item, mx + 64, y, Math.min(34, rowH * 0.36))
          drawName(c, item.name, mx + 112, y, isCenter ? 26 : 20, isCenter ? '#fbbf24' : '#e2e8f0', 'left')
          c.globalAlpha = 1
        }
        c.restore()
        c.save()
        c.strokeStyle = spin.landed ? '#fbbf24' : 'rgba(251,191,36,.45)'
        c.lineWidth = spin.landed ? 4 : 2
        roundRectPath(c, mx + 8, my + wh / 2 - rowH / 2, mw - 16, rowH, 10)
        c.stroke()
        c.restore()
      }

      if (mode === 'order' && !done) {
        drawName(c, `Tirage ${Math.min(results.length + 1, rounds)} / ${rounds}`, areaW / 2, my - 44, 18, '#94a3b8')
      }

      if (mode === 'order') {
        const entries: (Participant | null)[] = ctx.order.map((p, i) => (i < results.length ? p : null))
        drawRankPanel(c, w - panelW + 8, 24, h - 50, ctx.order.length, entries)
      }

      confetti.step(c, dt)

      if (done) {
        const msg =
          mode === 'single' ? `🎉 ${ctx.order[0].name} est tiré·e au sort !` : '🏁 Ordre déterminé !'
        drawName(c, msg, areaW / 2, h - 40, 24, '#fbbf24')
      }
    })

    return () => {
      stop()
      view.dispose()
      window.clearTimeout(timer)
    }
  },
}
