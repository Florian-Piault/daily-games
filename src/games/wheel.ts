import { type GameDef, type Participant, DEFAULT_SUSPENSE } from '../types'
import {
  setupCanvas,
  loop,
  drawAvatar,
  drawName,
  drawRankPanel,
  Confetti,
  clamp01,
  Camera,
  glow,
  clearShadow,
  radialGradientFill,
} from './common'
import { planSuspense, suspensePosition, isSlowPhase, SuspenseAudio, type SuspensePlan } from './suspense'
import { runIntro, type IntroController } from './intro'
import { readPalette } from './palette'

interface Spin {
  target: Participant
  from: number
  to: number
  t: number
  dur: number
  landed: boolean
  pause: number
  plan: SuspensePlan
  audio: SuspenseAudio
}

export const wheel: GameDef = {
  id: 'wheel',
  name: 'Roue de la fortune',
  emoji: '🎡',
  tagline: 'La classique, en mieux',
  family: 'rank',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode, pace } = ctx
    const pal = ctx.palette ?? readPalette()
    const susp = ctx.suspense ?? DEFAULT_SUSPENSE
    const n = ctx.order.length
    const confetti = new Confetti()
    const camera = new Camera()
    camera.enabled = susp.camera
    const rounds = mode === 'single' ? 1 : n

    let remaining: Participant[] = [...ctx.participants]
    const results: Participant[] = []
    let rot = Math.random() * Math.PI * 2
    let prevRot = rot
    let elapsed = 0
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
      const plan = planSuspense(results.length, n, remaining.length, pace, susp)
      // mode « une personne » : pas de faux-suspense (sans séquence de classement, l'arrêt sur
      // le voisin donnerait l'impression que le résultat change). On garde ralenti et surprises.
      if (mode === 'single') plan.nearMiss = false
      // bonusLoops = tours entiers supplémentaires : multiple de 2π ⇒ gagnant inchangé
      const loops = 3 + (results.length === 0 ? 2 : 0) + plan.bonusLoops
      let to = base
      while (to < rot + loops * Math.PI * 2) to += Math.PI * 2
      spin = {
        target,
        from: rot,
        to,
        t: 0,
        dur: (results.length === 0 ? 4.2 : Math.max(1.6, 3.4 - results.length * 0.4)) * pace.round,
        landed: false,
        pause: 0,
        plan,
        audio: new SuspenseAudio(sfx, plan),
      }
      lastTick = -1
    }

    const introKind = ctx.stage?.intro
    let intro: IntroController | null =
      introKind && introKind !== 'none' ? runIntro(introKind, view, ctx, camera) : null
    if (!intro) startSpin()

    const stop = loop((dt) => {
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      if (intro) {
        if (!intro.done) {
          intro.step(dt)
          return
        }
        intro = null
        startSpin()
      }

      const panelW = mode === 'order' ? 220 : 0
      const areaW = w - panelW
      const cx = areaW / 2
      const cy = h / 2 + 10
      const R = Math.max(90, Math.min(areaW / 2 - 50, h / 2 - 70))
      const sec = (Math.PI * 2) / Math.max(1, remaining.length)
      elapsed += dt

      if (spin && !done) {
        if (!spin.landed) {
          spin.t += dt
          const u = clamp01(spin.t / spin.dur)
          rot = spin.from + suspensePosition(u, spin.to - spin.from, sec, spin.plan)
          spin.audio.update(u)
          // tick à chaque frontière de secteur qui passe sous le pointeur
          const k = Math.floor((-Math.PI / 2 - rot) / sec)
          if (k !== lastTick) {
            lastTick = k
            if (isSlowPhase(u, spin.plan)) sfx.ratchet()
            else sfx.tick()
          }
          if (u >= 1) {
            spin.landed = true
            spin.audio.land()
            sfx.pop()
            camera.shake(6, 0.3)
            camera.flash(0.25)
            camera.zoomPulse(1.05)
            if (results.length === 0) confetti.burst(cx, cy - R, 110)
          }
        } else {
          spin.pause += dt
          if (spin.pause > 1.1 * pace.round) {
            const target = ctx.order[results.length]
            results.push(target)
            const after = remaining.filter((p) => p !== target)
            if (results.length >= rounds || after.length <= 1) {
              // la roue reste affichée telle quelle pour le final
              if (after.length === 1 && mode === 'order') results.push(after[0])
              done = true
              sfx.jackpot()
              camera.shake(12, 0.5)
              camera.flash(0.5)
              camera.zoomPulse(1.08)
              confetti.burst(cx, cy - R, 140)
              timer = window.setTimeout(() => ctx.onFinish(ctx.order), 1800 * pace.result)
            } else {
              remaining = after
              startSpin()
            }
          }
        }
      }

      // motion blur : on estompe les détails quand la roue tourne vite
      const speed = Math.abs(rot - prevRot) / Math.max(dt, 0.001)
      const sharp = clamp01(1 - speed / 18)

      camera.apply(c, cx, cy, dt)

      // secteur « chanceux » décoratif (surprise) : scintille pendant que la roue tourne
      const goldenIdx = spin && !spin.landed ? spin.plan.goldenIndex : null
      const goldPulse = 0.5 + 0.5 * Math.sin(elapsed * 7)

      // secteurs
      remaining.forEach((p, i) => {
        const a0 = rot + i * sec
        const winner = spin?.landed === true && p === spin.target
        const golden = i === goldenIdx
        c.save()
        c.beginPath()
        c.moveTo(cx, cy)
        c.arc(cx, cy, R, a0, a0 + sec)
        c.closePath()
        c.fillStyle = winner
          ? radialGradientFill(c, cx, cy, R, p.color, 'rgba(255,255,255,.25)')
          : p.color
        c.globalAlpha = winner ? 0.97 : 0.55
        if (winner) glow(c, pal.gold, 24)
        else if (golden) glow(c, pal.gold, 10 + 14 * goldPulse)
        c.fill()
        clearShadow(c)
        c.globalAlpha = 1
        c.strokeStyle = winner ? pal.gold : golden ? pal.gold : 'rgba(2,6,23,.55)'
        c.lineWidth = winner ? 4 : golden ? 3 : 2
        c.stroke()
        c.restore()

        const mid = a0 + sec / 2
        const ar = Math.min(22, Math.max(11, R * sec * 0.22))
        drawAvatar(c, p, cx + Math.cos(mid) * R * 0.58, cy + Math.sin(mid) * R * 0.58, ar)
        if (remaining.length <= 14 && sharp > 0.15) {
          c.save()
          c.globalAlpha = sharp
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
      c.fillStyle = radialGradientFill(c, cx, cy - R * 0.04, Math.max(16, R * 0.12), pal.accent, pal.surface)
      c.fill()
      c.strokeStyle = pal.accent
      c.lineWidth = 3
      c.stroke()
      c.beginPath()
      c.moveTo(cx - 14, cy - R - 16)
      c.lineTo(cx + 14, cy - R - 16)
      c.lineTo(cx, cy - R + 14)
      c.closePath()
      glow(c, pal.gold, spin?.landed ? 18 : 0)
      c.fillStyle = pal.gold
      c.fill()
      clearShadow(c)
      c.strokeStyle = 'rgba(2,6,23,.6)'
      c.lineWidth = 2
      c.stroke()
      c.restore()

      camera.release(c)

      if (mode === 'order' && !done) {
        drawName(c, `Tirage ${Math.min(results.length + 1, rounds)} / ${rounds}`, cx, 28, 18, pal.muted)
      }
      if (mode === 'order') {
        const entries: (Participant | null)[] = ctx.order.map((p, i) => (i < results.length ? p : null))
        drawRankPanel(c, w - panelW + 8, 24, h - 50, n, entries)
      }

      confetti.step(c, dt)

      if (done) {
        const msg = mode === 'single' ? `${ctx.order[0].name} est tiré·e au sort !` : 'Ordre déterminé !'
        drawName(c, msg, cx, h - 26, 24, pal.gold)
      }

      camera.drawOverlay(c, w, h)
      prevRot = rot
    })

    return () => {
      stop()
      view.dispose()
      window.clearTimeout(timer)
    }
  },
}
