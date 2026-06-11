import type { GameDef, Participant } from '../types'
import { setupCanvas, loop, drawAvatar, drawName, drawRankPanel, Confetti, clamp01, roundRectPath } from './common'
import { shuffle } from '../draw'

type StepKind = 'move' | 'hesitate' | 'descend' | 'close' | 'lift' | 'carry' | 'drop' | 'pause'

interface Step {
  kind: StepKind
  dur: number
  /** Cible : indice de peluche (move/descend) — résolu en pixels au démarrage du pas. */
  slot?: number
  fromX?: number
  toX?: number
  fromY?: number
  toY?: number
}

interface Falling {
  p: Participant
  x: number
  y: number
  vy: number
}

const smooth = (u: number) => u * u * (3 - 2 * u)

export const claw: GameDef = {
  id: 'claw',
  name: 'Pince à peluches',
  emoji: '🕹️',
  tagline: 'La pince choisit sa peluche',
  family: 'elim',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode } = ctx
    const n = ctx.order.length
    const confetti = new Confetti()
    const rounds = mode === 'single' ? 1 : n

    // chaque participant occupe une place fixe dans le bac
    const binSlot = new Map<Participant, number>()
    shuffle(ctx.participants).forEach((p, i) => binSlot.set(p, i))
    const wobble = ctx.participants.map(() => (Math.random() - 0.5) * 0.5)
    const inBin = new Set(ctx.participants)

    let grab = 0
    let steps: Step[] = []
    let stepT = 0
    let clawX = -1 // initialisé au premier layout
    let clawY = -1
    let prongOpen = 1
    let holding: Participant | null = null
    let falling: Falling | null = null
    const entries: (Participant | null)[] = ctx.order.map(() => null)
    let done = false
    let timer: number | undefined

    function planGrab() {
      const sc = Math.max(0.6, Math.pow(0.86, grab))
      const next: Step[] = []
      if (mode === 'single' && n > 2) {
        // la pince hésite au-dessus de fausses cibles avant de choisir
        const decoys = shuffle(ctx.participants.filter((p) => p !== ctx.order[0])).slice(0, 2)
        decoys.forEach((d) => {
          next.push({ kind: 'move', dur: 0.9, slot: binSlot.get(d)! })
          next.push({ kind: 'hesitate', dur: 0.45 })
        })
      }
      const target = binSlot.get(ctx.order[grab])!
      next.push({ kind: 'move', dur: 0.9 * sc, slot: target })
      next.push({ kind: 'hesitate', dur: 0.35 * sc })
      next.push({ kind: 'descend', dur: 0.55 * sc, slot: target })
      next.push({ kind: 'close', dur: 0.25 })
      next.push({ kind: 'lift', dur: 0.5 * sc })
      next.push({ kind: 'carry', dur: 0.9 * sc })
      next.push({ kind: 'drop', dur: 0.25 })
      next.push({ kind: 'pause', dur: 0.4 * sc })
      steps = next
      stepT = 0
    }
    planGrab()

    const stop = loop((dt, t) => {
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      const panelW = mode === 'order' ? 220 : 0
      const areaW = w - panelW
      const railY = 66
      const bx0 = 46
      const bx1 = areaW - 46
      const binTop = Math.max(railY + 90, h * 0.4)
      const binBot = h - 34
      const chuteX = bx1 - 40
      const pr = Math.min(26, Math.max(15, (chuteX - bx0) / (Math.ceil(n / 2) * 2.6)))
      const homeY = railY + 26

      const plushiePos = (slot: number) => {
        const perRow = Math.ceil(n / 2)
        const row = slot < perRow ? 0 : 1
        const col = row === 0 ? slot : slot - perRow
        const span = chuteX - 40 - (bx0 + pr + 14)
        const cnt = row === 0 ? perRow : n - perRow
        const x = bx0 + pr + 14 + (cnt <= 1 ? span / 2 : (col / (cnt - 1)) * span)
        const y = binBot - pr - 6 - row * pr * 1.7
        return { x: x + ((slot * 7919) % 13) - 6, y }
      }

      if (clawX < 0) {
        clawX = chuteX
        clawY = homeY
      }

      // machine : cadre + vitre + goulotte
      c.save()
      c.strokeStyle = '#6366f1'
      c.lineWidth = 3
      roundRectPath(c, bx0 - 14, railY - 22, bx1 - bx0 + 28, binBot - railY + 40, 18)
      c.stroke()
      c.fillStyle = 'rgba(99,102,241,.05)'
      c.fill()
      c.strokeStyle = 'rgba(148,163,184,.3)'
      c.lineWidth = 2
      c.beginPath()
      c.moveTo(bx0 - 14, railY + 8)
      c.lineTo(bx1 + 14, railY + 8)
      c.stroke()
      // goulotte
      c.strokeStyle = 'rgba(251,191,36,.6)'
      c.beginPath()
      c.moveTo(chuteX - 24, binTop - 30)
      c.lineTo(chuteX - 24, binBot)
      c.moveTo(chuteX + 24, binTop - 30)
      c.lineTo(chuteX + 24, binBot)
      c.stroke()
      drawName(c, '⬇', chuteX, binTop - 44, 18, '#fbbf24')
      c.restore()

      // peluches dans le bac
      ctx.participants.forEach((p, i) => {
        if (!inBin.has(p) || p === holding) return
        const { x, y } = plushiePos(binSlot.get(p)!)
        c.save()
        c.translate(x, y)
        c.rotate(wobble[i])
        drawAvatar(c, p, 0, 0, pr)
        c.restore()
        drawName(c, p.name, x, y - pr - 10, 11)
      })

      // machine à états de la pince
      if (!done && steps.length > 0) {
        const step = steps[0]
        if (stepT === 0) {
          // résolution des bornes au démarrage du pas
          step.fromX = clawX
          step.fromY = clawY
          if (step.kind === 'move') step.toX = plushiePos(step.slot!).x
          if (step.kind === 'carry') step.toX = chuteX
          if (step.kind === 'descend') step.toY = plushiePos(step.slot!).y - pr - 16
          if (step.kind === 'lift') step.toY = homeY
        }
        stepT += dt
        const u = clamp01(stepT / step.dur)
        switch (step.kind) {
          case 'move':
          case 'carry':
            clawX = step.fromX! + (step.toX! - step.fromX!) * smooth(u)
            break
          case 'hesitate':
            clawX = step.fromX! + Math.sin(u * Math.PI * 3) * 7
            break
          case 'descend':
            clawY = step.fromY! + (step.toY! - step.fromY!) * smooth(u)
            break
          case 'lift':
            clawY = step.fromY! + (step.toY! - step.fromY!) * smooth(u)
            break
          case 'close':
            prongOpen = 1 - u
            break
          case 'drop':
            prongOpen = u
            break
          case 'pause':
            break
        }
        if (u >= 1) {
          if (step.kind === 'close') {
            holding = ctx.order[grab]
            inBin.delete(holding)
            sfx.tick()
          }
          if (step.kind === 'drop' && holding) {
            falling = { p: holding, x: clawX, y: clawY + 26 + pr, vy: 60 }
            holding = null
            sfx.pop()
            entries[grab] = ctx.order[grab]
            if (grab === 0) confetti.burst(chuteX, binTop, 110)
          }
          if (step.kind === 'pause') {
            grab++
            if (grab >= rounds) {
              done = true
              sfx.fanfare()
              timer = window.setTimeout(() => ctx.onFinish(ctx.order), 1800)
            } else {
              planGrab()
            }
          }
          steps.shift()
          stepT = 0
        }
      }

      // peluche qui tombe dans la goulotte
      if (falling) {
        falling.vy += 900 * dt
        falling.y += falling.vy * dt
        const fade = clamp01((binBot - falling.y) / 60)
        c.save()
        c.globalAlpha = Math.max(0, fade)
        drawAvatar(c, falling.p, falling.x, falling.y, pr)
        c.restore()
        if (falling.y > binBot + pr) falling = null
      }

      // pince : câble, corps, pinces
      c.save()
      c.strokeStyle = '#94a3b8'
      c.lineWidth = 2.5
      c.beginPath()
      c.moveTo(clawX, railY + 8)
      c.lineTo(clawX, clawY)
      c.stroke()
      c.fillStyle = '#334155'
      roundRectPath(c, clawX - 11, clawY, 22, 14, 4)
      c.fill()
      c.strokeStyle = '#cbd5e1'
      c.lineWidth = 3.5
      c.lineCap = 'round'
      const spread = 6 + prongOpen * 12
      for (const s of [-1, 1]) {
        c.beginPath()
        c.moveTo(clawX + s * 7, clawY + 13)
        c.quadraticCurveTo(clawX + s * (spread + 6), clawY + 24, clawX + s * spread * 0.6, clawY + 34)
        c.stroke()
      }
      c.restore()

      // peluche tenue par la pince
      if (holding) {
        const sway = Math.sin(t * 4) * 5
        drawAvatar(c, holding, clawX + sway * 0.4, clawY + 28 + pr, pr)
        drawName(c, holding.name, clawX, clawY + 28 + pr * 2 + 14, 12)
      }

      if (mode === 'order') {
        drawRankPanel(c, w - panelW + 8, 24, h - 50, n, entries)
        if (!done) drawName(c, `Prise ${Math.min(grab + 1, rounds)} / ${rounds}`, areaW / 2, 30, 17, '#94a3b8')
      }

      confetti.step(c, dt)

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
