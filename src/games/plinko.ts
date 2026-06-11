import Matter from 'matter-js'
import type { GameDef, Participant } from '../types'
import { setupCanvas, loop, drawAvatar, drawName, drawBadge, Confetti, drawRankPanel } from './common'
import { shuffle } from '../draw'

const { Engine, Bodies, Composite, Events } = Matter

interface Jit {
  dropX: number
  vx: number
  delay: number
}

interface Sim {
  engine: Matter.Engine
  tokens: (Matter.Body | null)[]
  arrived: number[]
  pegs: Matter.Body[]
  step: number
  tick(): void
}

export const plinko: GameDef = {
  id: 'plinko',
  name: 'Plinko',
  emoji: '🪙',
  tagline: 'Que la gravité décide',
  family: 'rank',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode } = ctx
    const parts = ctx.participants
    const n = parts.length

    // géométrie du monde (coordonnées fixes, mises à l'échelle au rendu)
    const boardW = Math.max(520, n * 60 + 100)
    const boardH = 740
    const binsH = 100
    const tokenR = 17
    const finishY = boardH - binsH - tokenR
    const MAX_STEPS = 1500

    function makeJitters(): Jit[] {
      const lanes = shuffle(parts.map((_, i) => i))
      return parts.map((_, i) => ({
        dropX: 76 + ((lanes.indexOf(i) + 0.5) / n) * (boardW - 152) + (Math.random() - 0.5) * 24,
        vx: (Math.random() - 0.5) * 2,
        delay: 10 + lanes.indexOf(i) * 26 + Math.floor(Math.random() * 10),
      }))
    }

    function createSim(jits: Jit[]): Sim {
      const engine = Engine.create()
      const statics: Matter.Body[] = []
      const pegs: Matter.Body[] = []
      statics.push(Bodies.rectangle(20, boardH / 2 - 100, 40, boardH + 400, { isStatic: true }))
      statics.push(Bodies.rectangle(boardW - 20, boardH / 2 - 100, 40, boardH + 400, { isStatic: true }))
      statics.push(Bodies.rectangle(boardW / 2, boardH + 10, boardW, 40, { isStatic: true }))
      const pegSx = 56
      const pegSy = 60
      for (let row = 0; row < 8; row++) {
        const y = 130 + row * pegSy
        const off = row % 2 ? pegSx / 2 : 0
        for (let x = 70 + off; x <= boardW - 70; x += pegSx) {
          pegs.push(Bodies.circle(x, y, 5, { isStatic: true, restitution: 0.6 }))
        }
      }
      const innerW = boardW - 80
      for (let k = 0; k <= n; k++) {
        const x = 40 + (k / n) * innerW
        statics.push(Bodies.rectangle(x, boardH - binsH / 2, 6, binsH, { isStatic: true }))
      }
      Composite.add(engine.world, [...statics, ...pegs])

      const sim: Sim = {
        engine,
        tokens: parts.map(() => null),
        arrived: [],
        pegs,
        step: 0,
        tick() {
          sim.step++
          jits.forEach((j, i) => {
            if (sim.step === j.delay) {
              const b = Bodies.circle(j.dropX, -30, tokenR, {
                restitution: 0.5,
                friction: 0.02,
                frictionAir: 0.012,
              })
              Matter.Body.setVelocity(b, { x: j.vx, y: 0 })
              sim.tokens[i] = b
              Composite.add(engine.world, b)
            }
          })
          Engine.update(engine, 1000 / 60)
          sim.tokens.forEach((b, i) => {
            if (b && !sim.arrived.includes(i) && b.position.y > finishY) sim.arrived.push(i)
          })
        },
      }
      return sim
    }

    function fullOrder(sim: Sim): number[] {
      const order = [...sim.arrived]
      const rest = parts
        .map((_, i) => i)
        .filter((i) => !order.includes(i))
        .sort((a, b) => (sim.tokens[b]?.position.y ?? -1) - (sim.tokens[a]?.position.y ?? -1))
      return [...order, ...rest]
    }

    // pré-simulation invisible : on rejette les conditions initiales qui feraient
    // ressortir premier le premier d'hier (Matter est déterministe à pas fixe)
    const forbiddenIdx = ctx.forbiddenFirst ? parts.findIndex((p) => p.name === ctx.forbiddenFirst) : -1
    let jits = makeJitters()
    if (forbiddenIdx >= 0) {
      for (let tries = 0; tries < 25; tries++) {
        const pre = createSim(jits)
        while (pre.arrived.length < n && pre.step < MAX_STEPS) pre.tick()
        if (fullOrder(pre)[0] !== forbiddenIdx) break
        jits = makeJitters()
      }
    }

    const sim = createSim(jits)
    let lastTickAt = 0
    const onCollide = () => {
      const now = performance.now()
      if (now - lastTickAt > 70) {
        lastTickAt = now
        sfx.tick()
      }
    }
    Events.on(sim.engine, 'collisionStart', onCollide)

    const confetti = new Confetti()
    let acc = 0
    let calmFrames = 0
    let announced = 0
    let done = false
    let winnerLabel = ''
    let timer: number | undefined
    const lastDelay = Math.max(...jits.map((j) => j.delay))

    const stop = loop((dt) => {
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      if (sim.step < MAX_STEPS) {
        acc += dt
        while (acc >= 1 / 60 && sim.step < MAX_STEPS) {
          acc -= 1 / 60
          sim.tick()
        }
      }
      if (sim.arrived.length > announced) {
        announced = sim.arrived.length
        sfx.pop()
      }

      // détection d'enlisement : tout est immobile mais pas arrivé
      const unarrived = parts.map((_, i) => i).filter((i) => !sim.arrived.includes(i))
      if (sim.step > lastDelay && unarrived.length > 0) {
        const maxSpeed = Math.max(...unarrived.map((i) => sim.tokens[i]?.speed ?? 99))
        calmFrames = maxSpeed < 0.08 ? calmFrames + 1 : 0
      }
      const stuck = calmFrames > 90 || sim.step >= MAX_STEPS

      const panelW = mode === 'order' ? 220 : 0
      const scale = Math.max(0.1, Math.min((w - panelW - 24) / boardW, (h - 16) / boardH))
      const ox = (w - panelW - boardW * scale) / 2
      const oy = (h - boardH * scale) / 2

      c.save()
      c.translate(ox, oy)
      c.scale(scale, scale)

      // plateau
      c.fillStyle = 'rgba(15,23,42,.6)'
      c.fillRect(40, 0, boardW - 80, boardH)
      c.fillStyle = '#334155'
      c.fillRect(36, 0, 6, boardH)
      c.fillRect(boardW - 42, 0, 6, boardH)
      // clous
      c.fillStyle = '#94a3b8'
      for (const peg of sim.pegs) {
        c.beginPath()
        c.arc(peg.position.x, peg.position.y, 5, 0, Math.PI * 2)
        c.fill()
      }
      // séparateurs de cases
      c.fillStyle = '#475569'
      const innerW = boardW - 80
      for (let k = 0; k <= n; k++) {
        const x = 40 + (k / n) * innerW
        c.fillRect(x - 3, boardH - binsH, 6, binsH)
      }
      c.fillRect(40, boardH - 4, innerW, 4)

      // jetons
      sim.tokens.forEach((b, i) => {
        if (!b) return
        c.save()
        c.translate(b.position.x, b.position.y)
        c.rotate(b.angle)
        drawAvatar(c, parts[i], 0, 0, tokenR)
        c.restore()
        const ai = sim.arrived.indexOf(i)
        if (ai >= 0) drawBadge(c, ai + 1, b.position.x, b.position.y - tokenR - 14, 12)
        else drawName(c, parts[i].name, b.position.x, b.position.y + tokenR + 13, 12)
      })
      c.restore()

      if (mode === 'order') {
        const entries: (Participant | null)[] = parts.map((_, i) =>
          sim.arrived[i] !== undefined ? parts[sim.arrived[i]] : null,
        )
        drawRankPanel(c, w - panelW + 8, 24, h - 50, n, entries)
      }

      confetti.step(c, dt)

      const finished = mode === 'single' ? sim.arrived.length >= 1 : sim.arrived.length >= n || stuck
      if (finished && !done) {
        done = true
        sfx.fanfare()
        const final = fullOrder(sim).map((i) => parts[i])
        winnerLabel = final[0].name
        confetti.burst((w - panelW) / 2, h / 3, 120)
        timer = window.setTimeout(() => ctx.onFinish(final), 1700)
      }
      if (done) {
        const msg = mode === 'single' ? `🏆 ${winnerLabel} !` : '🏁 Ordre déterminé !'
        drawName(c, msg, (w - panelW) / 2, 28, 24, '#fbbf24')
      }
    })

    return () => {
      stop()
      Events.off(sim.engine, 'collisionStart', onCollide)
      view.dispose()
      window.clearTimeout(timer)
    }
  },
}
