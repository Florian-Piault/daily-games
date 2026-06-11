import type { GameDef, Participant } from '../types'
import { setupCanvas, loop, drawAvatar, drawName, drawBadge, drawRankPanel, Confetti, clamp01 } from './common'

/** Point du chemin en coordonnées abstraites : colonne + hauteur en « unités de rangée ». */
interface Pt {
  col: number
  ry: number
}

/** Barreaux aléatoires : rungs[r][i] = barreau entre les colonnes i et i+1 à la rangée r. */
function buildRungs(n: number, rows: number): boolean[][] {
  const rungs: boolean[][] = []
  for (let r = 0; r < rows; r++) {
    const row: boolean[] = new Array<boolean>(n - 1).fill(false)
    for (let i = 0; i < n - 1; i++) {
      if (!row[i - 1] && Math.random() < 0.45) row[i] = true
    }
    rungs.push(row)
  }
  return rungs
}

/** Chemin complet depuis la colonne du haut jusqu'en bas. */
function buildPath(rungs: boolean[][], start: number): Pt[] {
  let col = start
  const pts: Pt[] = [{ col, ry: 0 }]
  rungs.forEach((row, r) => {
    const ry = r + 1
    if (row[col]) {
      pts.push({ col, ry }, { col: col + 1, ry })
      col++
    } else if (col > 0 && row[col - 1]) {
      pts.push({ col, ry }, { col: col - 1, ry })
      col--
    }
  })
  pts.push({ col, ry: rungs.length + 1 })
  return pts
}

export const ladder: GameDef = {
  id: 'ladder',
  name: 'Échelles japonaises',
  emoji: '🪜',
  tagline: 'Chaque chemin mène à un rang',
  family: 'rank',
  run(ctx) {
    const view = setupCanvas(ctx.canvas)
    const { sfx, mode, pace } = ctx
    const n = ctx.order.length
    const confetti = new Confetti()

    const rows = Math.max(10, Math.min(16, n * 3))
    const rungs = buildRungs(n, rows)
    // truquage : l'avatar de rang k est placé en haut de la colonne qui aboutit à la case k
    const paths = Array.from({ length: n }, (_, tc) => buildPath(rungs, tc))
    const topAvatar: Participant[] = []
    paths.forEach((path, tc) => {
      topAvatar[tc] = ctx.order[path[path.length - 1].col]
    })

    // en mode une-personne, on remonte depuis la case 🎤 ; sinon on descend colonne par colonne
    const traceCols = mode === 'single' ? [paths.findIndex((p) => p[p.length - 1].col === 0)] : paths.map((_, i) => i)

    const entries: (Participant | null)[] = ctx.order.map(() => null)
    let traceIdx = 0
    let traceT = 0
    let pause = 0
    let lastSeg = -1
    let done = false
    let timer: number | undefined

    const traceDur = (i: number) => (mode === 'single' ? 4.5 : Math.max(1.1, 2.6 * Math.pow(0.88, i))) * pace.round

    const stop = loop((dt) => {
      const { ctx: c, w, h } = view
      c.clearRect(0, 0, w, h)

      const panelW = mode === 'order' ? 220 : 0
      const areaW = w - panelW
      const colW = Math.min(130, (areaW - 150) / Math.max(1, n - 1))
      const x0 = (areaW - colW * (n - 1)) / 2
      const yTop = 96
      const yBot = h - 76
      const unitH = (yBot - yTop) / (rows + 1)
      const X = (col: number) => x0 + col * colW
      const Y = (ry: number) => yTop + ry * unitH
      const ar = Math.min(20, Math.max(13, colW * 0.26))

      // rails + barreaux
      c.save()
      c.strokeStyle = 'rgba(148,163,184,.35)'
      c.lineWidth = 2.5
      for (let i = 0; i < n; i++) {
        c.beginPath()
        c.moveTo(X(i), yTop)
        c.lineTo(X(i), yBot)
        c.stroke()
      }
      rungs.forEach((row, r) => {
        row.forEach((has, i) => {
          if (!has) return
          c.beginPath()
          c.moveTo(X(i), Y(r + 1))
          c.lineTo(X(i + 1), Y(r + 1))
          c.stroke()
        })
      })
      c.restore()

      // chemins déjà tracés + chemin en cours
      const pixPath = (tc: number) => paths[tc].map((p) => ({ x: X(p.col), y: Y(p.ry) }))
      const strokePath = (pts: { x: number; y: number }[], color: string, upto = Infinity) => {
        c.save()
        c.strokeStyle = color
        c.lineWidth = 4
        c.lineJoin = 'round'
        c.lineCap = 'round'
        c.globalAlpha = 0.9
        c.beginPath()
        let dist = 0
        c.moveTo(pts[0].x, pts[0].y)
        let tip = pts[0]
        for (let i = 1; i < pts.length; i++) {
          const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
          if (dist + seg <= upto) {
            c.lineTo(pts[i].x, pts[i].y)
            tip = pts[i]
            dist += seg
          } else {
            const u = (upto - dist) / seg
            tip = {
              x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u,
              y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u,
            }
            c.lineTo(tip.x, tip.y)
            dist = upto
            break
          }
        }
        c.stroke()
        c.restore()
        return tip
      }

      for (let i = 0; i < traceIdx; i++) {
        const tc = traceCols[i]
        const pts = mode === 'single' ? pixPath(tc).reverse() : pixPath(tc)
        strokePath(pts, topAvatar[tc].color)
      }

      // avatars du haut
      topAvatar.forEach((p, tc) => {
        drawAvatar(c, p, X(tc), yTop - ar - 14, ar)
        drawName(c, p.name, X(tc), yTop - ar * 2 - 26, Math.min(12, Math.max(10, colW * 0.16)))
      })

      // cases du bas
      for (let s = 0; s < n; s++) {
        if (mode === 'single') {
          if (s === 0) drawName(c, '🎤', X(s), yBot + 24, 22)
        } else {
          drawBadge(c, s + 1, X(s), yBot + 22, 12)
        }
      }

      // tracé en cours
      if (!done && traceIdx < traceCols.length) {
        if (pause > 0) {
          pause -= dt
        } else {
          const tc = traceCols[traceIdx]
          const pts = mode === 'single' ? pixPath(tc).reverse() : pixPath(tc)
          let total = 0
          for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
          traceT += dt
          const u = clamp01(traceT / traceDur(traceIdx))
          // en mode une-personne, tracé neutre + point doré : ne pas révéler le gagnant avant l'arrivée
          const tip = strokePath(pts, mode === 'single' ? '#fbbf24' : topAvatar[tc].color, u * total)
          if (mode === 'single') {
            c.save()
            c.beginPath()
            c.arc(tip.x, tip.y, 8, 0, Math.PI * 2)
            c.fillStyle = '#fbbf24'
            c.shadowColor = '#fbbf24'
            c.shadowBlur = 14
            c.fill()
            c.restore()
          } else {
            drawAvatar(c, topAvatar[tc], tip.x, tip.y, ar * 0.8)
          }

          // tick aux barreaux : on suit l'index du segment horizontal franchi
          let dist = 0
          let seg = 0
          for (let i = 1; i < pts.length; i++) {
            const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
            if (dist + len < u * total) {
              dist += len
              seg = i
            } else break
          }
          if (seg !== lastSeg) {
            lastSeg = seg
            if (seg > 0 && Math.abs(pts[seg].y - pts[Math.max(0, seg - 1)].y) < 0.5) sfx.tick()
          }

          if (u >= 1) {
            const rank = paths[tc][paths[tc].length - 1].col
            entries[rank] = topAvatar[tc]
            sfx.pop()
            if (rank === 0) confetti.burst(mode === 'single' ? X(tc) : X(0), mode === 'single' ? yTop - ar : yBot, 110)
            traceIdx++
            traceT = 0
            pause = 0.35 * pace.round
            lastSeg = -1
            if (traceIdx >= traceCols.length) {
              done = true
              sfx.fanfare()
              timer = window.setTimeout(() => ctx.onFinish(ctx.order), 1800 * pace.result)
            }
          }
        }
      }

      if (mode === 'order') {
        drawRankPanel(c, w - panelW + 8, 24, h - 50, n, entries)
      }

      confetti.step(c, dt)

      if (done) {
        const msg = mode === 'single' ? `🎉 ${ctx.order[0].name} est tiré·e au sort !` : '🏁 Ordre déterminé !'
        drawName(c, msg, areaW / 2, h - 28, 24, '#fbbf24')
      }
    })

    return () => {
      stop()
      view.dispose()
      window.clearTimeout(timer)
    }
  },
}
