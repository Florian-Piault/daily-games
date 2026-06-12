import type { GameContext, IntroKind } from '../types'
import { type View, drawAvatar, drawName, clamp01, type Camera } from './common'

/** Une intro non bloquante : `step(dt)` dessine la frame ; `done` passe à true quand c'est fini. */
export interface IntroController {
  step(dt: number): void
  done: boolean
}

const easeOutBack = (t: number): number => {
  const c = 1.70158
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

const ANNOUNCER_LINES = [
  'Et c’est partiii…',
  'Le sort va parler…',
  'Qui ouvrira le bal ?',
  'Accrochez-vous bien…',
  'Mesdames et messieurs…',
  'Roulement de tambour…',
]

/**
 * Crée une intro réutilisable (présentation / décompte / annonceur). Durées pilotées
 * par `ctx.pace.intro`. Dessine sur le canvas via `view` et peut animer `camera`.
 */
export function runIntro(kind: IntroKind, view: View, ctx: GameContext, camera: Camera): IntroController {
  if (kind === 'presentation') return presentation(view, ctx)
  if (kind === 'countdown') return countdown(view, ctx, camera)
  if (kind === 'announcer') return announcer(view, ctx)
  return { step() {}, done: true }
}

/** Les participants s'allument un par un, comme une présentation de plateau. */
function presentation(view: View, ctx: GameContext): IntroController {
  const { participants, sfx, pace } = ctx
  const per = 0.42 * pace.intro // délai entre deux apparitions
  const hold = 0.9 * pace.intro // pause finale, tout le monde affiché
  let t = 0
  let revealed = -1

  const ctrl: IntroController = {
    done: false,
    step(dt) {
      t += dt
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)
      drawName(c, 'Sur le plateau ce matin…', w / 2, Math.max(40, h * 0.16), 22, '#94a3b8')

      const n = participants.length
      const idx = Math.floor(t / per)
      if (idx > revealed && idx < n) {
        revealed = idx
        sfx.pop()
      }

      // grille centrée, lignes de 6 maxi
      const perRow = Math.min(6, n)
      const rows = Math.ceil(n / perRow)
      const cell = Math.min(150, (w - 80) / perRow, (h * 0.6) / rows)
      const r = cell * 0.32
      const gx = w / 2 - ((perRow - 1) * cell) / 2
      const gy = h / 2 - ((rows - 1) * cell) / 2

      participants.forEach((p, i) => {
        if (i > idx) return
        const since = clamp01((t - i * per) / (0.32 * pace.intro))
        const s = easeOutBack(since)
        const col = i % perRow
        const row = Math.floor(i / perRow)
        const x = gx + col * cell
        const y = gy + row * cell
        c.save()
        c.globalAlpha = since
        c.translate(x, y)
        c.scale(s, s)
        drawAvatar(c, p, 0, 0, r)
        c.restore()
        if (since > 0.6) drawName(c, p.name, x, y + r + 16, Math.min(15, r * 0.55))
      })

      if (idx >= n - 1 && t > n * per + hold) ctrl.done = true
    },
  }
  return ctrl
}

/** Gros 3 – 2 – 1 – GO avec build-up sonore. */
function countdown(view: View, ctx: GameContext, camera: Camera): IntroController {
  const { sfx, pace } = ctx
  const step = 0.72 * pace.intro
  let t = 0
  let shown = -1
  const labels = ['3', '2', '1', 'GO']

  const ctrl: IntroController = {
    done: false,
    step(dt) {
      t += dt
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      const idx = Math.min(labels.length - 1, Math.floor(t / step))
      if (idx > shown) {
        shown = idx
        if (idx < 3) {
          sfx.beep(true)
          camera.zoomPulse(1.12)
          if (idx === 0) sfx.riser(step * 3)
        } else {
          sfx.boom()
          camera.zoomPulse(1.2)
          camera.flash(0.4)
        }
      }

      camera.apply(c, w / 2, h / 2, dt)
      const local = (t - idx * step) / step // 0..1 dans la tranche courante
      const pop = easeOutBack(clamp01(local * 1.6))
      const fade = clamp01(1 - Math.max(0, local - 0.5) * 2)
      const label = labels[idx]
      c.save()
      c.globalAlpha = fade
      c.translate(w / 2, h / 2)
      c.scale(pop, pop)
      drawName(c, label, 0, 0, Math.min(220, h * 0.4), label === 'GO' ? '#34d399' : '#fbbf24')
      c.restore()
      camera.release(c)
      camera.drawOverlay(c, w, h)

      if (t > labels.length * step) ctrl.done = true
    },
  }
  return ctrl
}

/** Bandeau « annonceur » qui glisse, façon télé-réalité. */
function announcer(view: View, ctx: GameContext): IntroController {
  const { sfx, pace } = ctx
  const line = ANNOUNCER_LINES[Math.floor(Math.random() * ANNOUNCER_LINES.length)]
  const dur = 2.4 * pace.intro
  let t = 0
  let beeped = false

  const ctrl: IntroController = {
    done: false,
    step(dt) {
      t += dt
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)
      if (!beeped) {
        beeped = true
        sfx.beep(false)
      }
      const u = clamp01(t / dur)
      // slide-in, hold, slide-out
      const inP = clamp01(u / 0.25)
      const outP = clamp01((u - 0.75) / 0.25)
      const x = w / 2 // centré horizontalement, le bandeau coulisse via translate
      const bandH = Math.min(96, h * 0.22)
      const y = h / 2
      const slide = (1 - inP) * w + outP * w // entre par la droite, sort par la gauche
      c.save()
      c.globalAlpha = inP - outP
      c.translate(-slide, 0)
      c.fillStyle = 'rgba(99,102,241,.9)'
      c.fillRect(0, y - bandH / 2, w, bandH)
      c.fillStyle = 'rgba(2,6,23,.25)'
      c.fillRect(0, y + bandH / 2 - 4, w, 4)
      drawName(c, line, x, y, Math.min(40, h * 0.075), '#fff')
      c.restore()

      if (u >= 1) ctrl.done = true
    },
  }
  return ctrl
}
