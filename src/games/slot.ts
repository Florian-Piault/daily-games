import { type GameDef, type Participant, DEFAULT_SUSPENSE } from '../types'
import {
  setupCanvas,
  loop,
  drawAvatar,
  drawName,
  Confetti,
  drawRankPanel,
  roundRectPath,
  Camera,
  glow,
  clearShadow,
} from './common'
import { shuffle } from '../draw'
import {
  planSuspense,
  plainPlan,
  suspensePosition,
  isSlowPhase,
  SuspenseAudio,
  type SuspensePlan,
} from './suspense'
import { runIntro, type IntroController } from './intro'
import { readPalette } from './palette'

interface Reel {
  strip: Participant[]
  to: number
  dur: number
  pos: number
  landed: boolean
  lastTick: number
  plan: SuspensePlan
  audio: SuspenseAudio
}

interface Spin {
  reels: Reel[]
  target: Participant
  t: number
  pause: number
  allLanded: boolean
}

export const slot: GameDef = {
  id: 'slot',
  name: 'Machine à sous',
  emoji: '🎰',
  tagline: 'Le rouleau décide',
  family: 'elim',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode, pace } = ctx
    const pal = ctx.palette ?? readPalette()
    const susp = ctx.suspense ?? DEFAULT_SUSPENSE
    const rounds = mode === 'single' ? 1 : ctx.order.length
    const reelCount = ctx.stage?.format === 'reels3' ? 3 : 1
    const results: Participant[] = []
    const confetti = new Confetti()
    const camera = new Camera()
    camera.enabled = susp.camera
    let spin: Spin | null = null
    let done = false
    let timer: number | undefined
    let elapsed = 0

    function startSpin() {
      const remaining = ctx.order.filter((p) => !results.includes(p))
      const target = ctx.order[results.length]
      const basePlan = planSuspense(results.length, ctx.order.length, remaining.length, pace, susp)
      // la machine à sous cale toujours net sur le gagnant : pas de faux-suspense ici
      // (réservé à la roue, où l'arrêt sur le secteur voisin est naturel). Ralenti et
      // surprises restent actifs selon les réglages.
      basePlan.nearMiss = false
      const baseDur = (results.length === 0 ? 4.2 : Math.max(1.8, 3.6 - results.length * 0.45)) * pace.round
      const reels: Reel[] = []
      for (let k = 0; k < reelCount; k++) {
        const strip = shuffle(remaining)
        const idx = strip.indexOf(target)
        // bonusLoops = tours entiers communs à tous les rouleaux : multiple de la longueur ⇒ gagnant inchangé
        const loops = (strip.length <= 2 ? 7 : strip.length <= 4 ? 5 : 4) + k + basePlan.bonusLoops
        // surprises (secteur doré / ralenti inopiné) portées par le dernier rouleau ; les autres calent net
        const plan = reelCount === 1 || k === reelCount - 1 ? basePlan : plainPlan(basePlan.bonusLoops)
        reels.push({
          strip,
          to: loops * strip.length + idx,
          dur: baseDur + k * 0.6 * pace.round, // arrêt échelonné gauche → droite
          pos: 0,
          landed: false,
          lastTick: -1,
          plan,
          audio: new SuspenseAudio(sfx, plan),
        })
      }
      spin = { reels, target, t: 0, pause: 0, allLanded: false }
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
      const mw = Math.min(440, Math.max(260, areaW - 40))
      const rowH = Math.min(96, Math.max(56, (h - 200) / 3))
      const wh = rowH * 3
      const mx = (areaW - mw) / 2
      const my = (h - wh) / 2
      elapsed += dt

      if (spin && !done) {
        if (!spin.allLanded) {
          spin.t += dt
          let all = true
          for (const r of spin.reels) {
            if (r.landed) continue
            const u = Math.min(1, spin.t / r.dur)
            r.pos = suspensePosition(u, r.to, 1, r.plan)
            r.audio.update(u)
            if (Math.floor(r.pos) !== r.lastTick) {
              r.lastTick = Math.floor(r.pos)
              if (isSlowPhase(u, r.plan)) sfx.ratchet()
              else sfx.tick()
            }
            if (u >= 1) {
              r.pos = r.to
              r.landed = true
              r.audio.land()
              sfx.pop()
              camera.shake(4, 0.2)
            } else {
              all = false
            }
          }
          if (all) {
            spin.allLanded = true
            camera.shake(8, 0.4)
            camera.flash(0.25)
          }
        } else {
          spin.pause += dt
          if (spin.pause > pace.round) {
            results.push(ctx.order[results.length])
            if (results.length >= rounds) {
              done = true
              sfx.jackpot()
              camera.shake(12, 0.5)
              camera.flash(0.5)
              camera.zoomPulse(1.08)
              confetti.burst(areaW / 2, my, 150)
              timer = window.setTimeout(() => ctx.onFinish(ctx.order), 1800 * pace.result)
            } else {
              startSpin()
            }
          }
        }
      }

      camera.apply(c, areaW / 2, my + wh / 2, dt)

      // « spin chanceux » décoratif : le cadre scintille en doré pendant le défilement
      const lastReel = spin?.reels[spin.reels.length - 1]
      const luckySpin = !!spin && !spin.allLanded && lastReel?.plan.goldenIndex !== null
      const goldPulse = 0.5 + 0.5 * Math.sin(elapsed * 7)

      // corps de la machine
      c.save()
      c.fillStyle = pal.surface
      roundRectPath(c, mx - 18, my - 18, mw + 36, wh + 36, 22)
      c.fill()
      if (luckySpin) {
        c.strokeStyle = pal.gold
        glow(c, pal.gold, 8 + 14 * goldPulse)
      } else {
        c.strokeStyle = pal.accent
      }
      c.lineWidth = 3
      c.stroke()
      clearShadow(c)
      c.restore()

      if (spin) {
        const count = spin.reels.length
        const gap = count > 1 ? 12 : 0
        const colW = (mw - (count - 1) * gap) / count

        spin.reels.forEach((reel, ri) => {
          const colX = mx + ri * (colW + gap)
          const cxk = colX + colW / 2
          const len = reel.strip.length
          const frac = reel.pos - Math.floor(reel.pos)
          const base = Math.floor(reel.pos)

          c.save()
          c.fillStyle = '#0b1222'
          roundRectPath(c, colX, my, colW, wh, 12)
          c.fill()
          c.clip()
          for (let k = -2; k <= 2; k++) {
            const item = reel.strip[(((base + k) % len) + len) % len]
            const y = my + wh / 2 + (k - frac) * rowH
            const isCenter = reel.landed && k === 0
            c.globalAlpha = isCenter ? 1 : Math.max(0.25, 1 - Math.abs(k - frac) * 0.45)
            if (count === 1) {
              // le rouleau garde un fond sombre quel que soit le thème : on force un texte clair lisible dessus
              drawAvatar(c, item, colX + 64, y, Math.min(34, rowH * 0.36))
              drawName(c, item.name, colX + 112, y, isCenter ? 26 : 20, isCenter ? pal.gold : '#e2e8f0', 'left')
            } else {
              drawAvatar(c, item, cxk, y, Math.min(rowH * 0.34, colW * 0.32))
            }
            c.globalAlpha = 1
          }
          c.restore()
        })

        // ligne centrale (gagnant) sur toute la largeur
        c.save()
        const lit = spin.allLanded
        c.strokeStyle = lit ? pal.gold : 'rgba(251,191,36,.45)'
        c.lineWidth = lit ? 4 : 2
        if (lit) glow(c, pal.gold, 20)
        roundRectPath(c, mx + 8, my + wh / 2 - rowH / 2, mw - 16, rowH, 10)
        c.stroke()
        clearShadow(c)
        c.restore()

        // en multi-rouleaux, le nom du gagnant s'affiche sous la machine (les cases ne le portent pas).
        // On lit spin.target (figé) et non ctx.order[results.length], qui change dès le push du résultat.
        if (count > 1 && spin.allLanded) {
          drawName(c, spin.target.name, areaW / 2, my + wh + 30, 26, pal.gold)
        }
      }

      camera.release(c)

      if (mode === 'order' && !done) {
        drawName(c, `Tirage ${Math.min(results.length + 1, rounds)} / ${rounds}`, areaW / 2, my - 44, 18, pal.muted)
      }

      if (mode === 'order') {
        const entries: (Participant | null)[] = ctx.order.map((p, i) => (i < results.length ? p : null))
        drawRankPanel(c, w - panelW + 8, 24, h - 50, ctx.order.length, entries)
      }

      confetti.step(c, dt)

      if (done) {
        const msg = mode === 'single' ? `${ctx.order[0].name} est tiré·e au sort !` : 'Ordre déterminé !'
        drawName(c, msg, areaW / 2, h - 40, 24, pal.gold)
      }

      camera.drawOverlay(c, w, h)
    })

    return () => {
      stop()
      view.dispose()
      window.clearTimeout(timer)
    }
  },
}
