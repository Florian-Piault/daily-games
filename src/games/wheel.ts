import type { GameDef, Participant } from '../types'
import { setupCanvas, loop, drawAvatar, drawName, drawRankPanel, Confetti, easeOutCubic, clamp01 } from './common'

interface Spin {
  target: Participant
  from: number
  to: number
  t: number
  dur: number
  landed: boolean
  pause: number
}

export const wheel: GameDef = {
  id: 'wheel',
  name: 'Roue de la fortune',
  emoji: '🎡',
  tagline: 'La classique, en mieux',
  family: 'rank',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode } = ctx
    const n = ctx.order.length
    const confetti = new Confetti()
    const rounds = mode === 'single' ? 1 : n

    let remaining: Participant[] = [...ctx.participants]
    const results: Participant[] = []
    let rot = Math.random() * Math.PI * 2
    let spin: Spin | null = null
    let lastTick = -1
    let done = false
    let timer: number | undefined

    function startSpin() {
      const sec = (Math.PI * 2) / remaining.length
      const target = ctx.order[results.length]
      const idx = remaining.indexOf(target)
      // angle final : le milieu du secteur cible sous le pointeur (haut), avec un léger décalage dans le secteur
      const offset = (Math.random() - 0.5) * sec * 0.5
      const base = -Math.PI / 2 - (idx + 0.5) * sec + offset
      const loops = 3 + (results.length === 0 ? 2 : 0)
      let to = base
      while (to < rot + loops * Math.PI * 2) to += Math.PI * 2
      spin = {
        target,
        from: rot,
        to,
        t: 0,
        dur: results.length === 0 ? 4.2 : Math.max(1.6, 3.4 - results.length * 0.4),
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
      const cx = areaW / 2
      const cy = h / 2 + 10
      const R = Math.max(90, Math.min(areaW / 2 - 50, h / 2 - 70))
      const sec = (Math.PI * 2) / Math.max(1, remaining.length)

      if (spin && !done) {
        if (!spin.landed) {
          spin.t += dt
          const u = clamp01(spin.t / spin.dur)
          rot = spin.from + (spin.to - spin.from) * easeOutCubic(u)
          // tick à chaque frontière de secteur qui passe sous le pointeur
          const k = Math.floor((-Math.PI / 2 - rot) / sec)
          if (k !== lastTick) {
            lastTick = k
            sfx.tick()
          }
          if (u >= 1) {
            spin.landed = true
            sfx.pop()
            if (results.length === 0) confetti.burst(cx, cy - R, 110)
          }
        } else {
          spin.pause += dt
          if (spin.pause > 1.1) {
            const target = ctx.order[results.length]
            results.push(target)
            const after = remaining.filter((p) => p !== target)
            if (results.length >= rounds || after.length <= 1) {
              // la roue reste affichée telle quelle pour le final
              if (after.length === 1 && mode === 'order') results.push(after[0])
              done = true
              sfx.fanfare()
              timer = window.setTimeout(() => ctx.onFinish(ctx.order), 1800)
            } else {
              remaining = after
              startSpin()
            }
          }
        }
      }

      // secteurs
      remaining.forEach((p, i) => {
        const a0 = rot + i * sec
        const winner = spin?.landed === true && p === spin.target
        c.save()
        c.beginPath()
        c.moveTo(cx, cy)
        c.arc(cx, cy, R, a0, a0 + sec)
        c.closePath()
        c.fillStyle = p.color
        c.globalAlpha = winner ? 0.95 : 0.55
        c.fill()
        c.globalAlpha = 1
        c.strokeStyle = winner ? '#fbbf24' : 'rgba(2,6,23,.55)'
        c.lineWidth = winner ? 4 : 2
        c.stroke()
        c.restore()

        const mid = a0 + sec / 2
        const ar = Math.min(22, Math.max(11, R * sec * 0.22))
        drawAvatar(c, p, cx + Math.cos(mid) * R * 0.58, cy + Math.sin(mid) * R * 0.58, ar)
        if (remaining.length <= 14) {
          c.save()
          c.translate(cx + Math.cos(mid) * R * 0.82, cy + Math.sin(mid) * R * 0.82)
          c.rotate(mid + Math.PI / 2)
          drawName(c, p.name, 0, 0, Math.min(13, Math.max(10, R * sec * 0.13)))
          c.restore()
        }
      })

      // moyeu + pointeur
      c.save()
      c.beginPath()
      c.arc(cx, cy, Math.max(16, R * 0.12), 0, Math.PI * 2)
      c.fillStyle = '#1e293b'
      c.fill()
      c.strokeStyle = '#6366f1'
      c.lineWidth = 3
      c.stroke()
      c.beginPath()
      c.moveTo(cx - 14, cy - R - 16)
      c.lineTo(cx + 14, cy - R - 16)
      c.lineTo(cx, cy - R + 14)
      c.closePath()
      c.fillStyle = '#fbbf24'
      c.fill()
      c.strokeStyle = 'rgba(2,6,23,.6)'
      c.lineWidth = 2
      c.stroke()
      c.restore()

      if (mode === 'order' && !done) {
        drawName(c, `Tirage ${Math.min(results.length + 1, rounds)} / ${rounds}`, cx, 28, 18, '#94a3b8')
      }
      if (mode === 'order') {
        const entries: (Participant | null)[] = ctx.order.map((p, i) => (i < results.length ? p : null))
        drawRankPanel(c, w - panelW + 8, 24, h - 50, n, entries)
      }

      confetti.step(c, dt)

      if (done) {
        const msg = mode === 'single' ? `🎉 ${ctx.order[0].name} est tiré·e au sort !` : '🏁 Ordre déterminé !'
        drawName(c, msg, cx, h - 26, 24, '#fbbf24')
      }
    })

    return () => {
      stop()
      view.dispose()
      window.clearTimeout(timer)
    }
  },
}
