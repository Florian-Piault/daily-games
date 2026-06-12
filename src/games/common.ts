import type { Participant } from '../types'

export interface View {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  dispose(): void
}

/** Dimensionne le canvas sur son parent (HiDPI) et suit les redimensionnements. */
export function setupCanvas(canvas: HTMLCanvasElement): View {
  const ctx = canvas.getContext('2d')!
  const resize = () => {
    const parent = canvas.parentElement!
    const dpr = window.devicePixelRatio || 1
    view.w = parent.clientWidth
    view.h = parent.clientHeight
    canvas.width = Math.max(1, Math.round(view.w * dpr))
    canvas.height = Math.max(1, Math.round(view.h * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  const ro = new ResizeObserver(resize)
  const view: View = { ctx, w: 0, h: 0, dispose: () => ro.disconnect() }
  ro.observe(canvas.parentElement!)
  resize()
  return view
}

/** Boucle requestAnimationFrame ; retourne une fonction d'arrêt. dt en secondes, t = temps écoulé. */
export function loop(fn: (dt: number, t: number) => void): () => void {
  let raf = 0
  let last = performance.now()
  const start = last
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    fn(dt, (now - start) / 1000)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

/** Active une lueur (à réinitialiser avec clearShadow après usage). Coûteux : à réserver aux accents. */
export function glow(c: CanvasRenderingContext2D, color: string, blur: number): void {
  c.shadowColor = color
  c.shadowBlur = blur
  c.shadowOffsetX = 0
  c.shadowOffsetY = 0
}

export function clearShadow(c: CanvasRenderingContext2D): void {
  c.shadowColor = 'transparent'
  c.shadowBlur = 0
}

/** Dégradé radial prêt à servir de fillStyle (centre → bord). */
export function radialGradientFill(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  inner: string,
  outer: string,
): CanvasGradient {
  const g = c.createRadialGradient(cx, cy, Math.max(1, r * 0.08), cx, cy, Math.max(2, r))
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  return g
}

/**
 * Effets caméra cosmétiques (shake / zoom-pulse / flash) appliqués autour d'un point.
 * Compose par-dessus la transform DPR existante via save/restore — ne touche jamais
 * au résultat du jeu.
 *
 * Usage par frame : apply(c, cx, cy, dt) → dessin du monde → release(c) →
 * (UI hors-monde) → drawOverlay(c, w, h) en toute fin.
 */
export class Camera {
  /** Désactive secousses, flash et zoom-pulse (réglage « Secousses & flash »). */
  enabled = true
  private shakeT = 0
  private shakeDur = 0
  private shakeMag = 0
  private flashA = 0
  private zoom = 1
  private zoomTarget = 1

  shake(mag: number, dur = 0.4): void {
    if (!this.enabled) return
    this.shakeMag = mag
    this.shakeDur = dur
    this.shakeT = dur
  }

  flash(amount = 0.55): void {
    if (!this.enabled) return
    this.flashA = amount
  }

  /** Coup de zoom instantané qui revient à 1. */
  zoomPulse(scale: number): void {
    if (!this.enabled) return
    this.zoom = scale
    this.zoomTarget = 1
  }

  apply(c: CanvasRenderingContext2D, cx: number, cy: number, dt: number): void {
    this.shakeT = Math.max(0, this.shakeT - dt)
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 8)
    this.flashA = Math.max(0, this.flashA - dt * 2)
    let dx = 0
    let dy = 0
    if (this.shakeT > 0 && this.shakeDur > 0) {
      const m = this.shakeMag * (this.shakeT / this.shakeDur)
      dx = (Math.random() * 2 - 1) * m
      dy = (Math.random() * 2 - 1) * m
    }
    c.save()
    c.translate(cx + dx, cy + dy)
    c.scale(this.zoom, this.zoom)
    c.translate(-cx, -cy)
  }

  release(c: CanvasRenderingContext2D): void {
    c.restore()
  }

  /** Flash plein écran décroissant — à dessiner en dernier, hors transform monde. */
  drawOverlay(c: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.flashA <= 0.001) return
    c.save()
    c.fillStyle = `rgba(255,255,255,${this.flashA})`
    c.fillRect(0, 0, w, h)
    c.restore()
  }
}

export function drawAvatar(
  c: CanvasRenderingContext2D,
  p: Participant,
  x: number,
  y: number,
  r: number,
  ring = true,
): void {
  c.save()
  if (ring) {
    c.beginPath()
    c.arc(x, y, r + 3, 0, Math.PI * 2)
    c.fillStyle = p.color
    c.fill()
  }
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.clip()
  c.drawImage(p.img, x - r, y - r, r * 2, r * 2)
  c.restore()
}

export function drawName(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size = 14,
  color = '#e2e8f0',
  align: CanvasTextAlign = 'center',
): void {
  c.save()
  c.font = `600 ${size}px system-ui, sans-serif`
  c.textAlign = align
  c.textBaseline = 'middle'
  c.lineWidth = Math.max(3, size * 0.28)
  c.lineJoin = 'round'
  c.strokeStyle = 'rgba(2,6,23,.8)'
  c.strokeText(text, x, y)
  c.fillStyle = color
  c.fillText(text, x, y)
  c.restore()
}

export function rankColor(i: number): string {
  return i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : i === 2 ? '#e8833a' : '#64748b'
}

export function drawBadge(c: CanvasRenderingContext2D, rank: number, x: number, y: number, r = 13): void {
  c.save()
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fillStyle = rankColor(rank - 1)
  c.fill()
  c.strokeStyle = 'rgba(2,6,23,.6)'
  c.lineWidth = 2
  c.stroke()
  c.fillStyle = '#0f172a'
  c.font = `800 ${r}px system-ui, sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(String(rank), x, y + 0.5)
  c.restore()
}

/** Panneau latéral « Ordre de passage » qui se remplit au fil du jeu. */
export function drawRankPanel(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  hAvail: number,
  total: number,
  entries: (Participant | null)[],
  title = 'Ordre de passage',
): void {
  const rowH = Math.min(42, (hAvail - 40) / Math.max(total, 1))
  drawName(c, title, x + 95, y + 10, 14, '#94a3b8')
  for (let i = 0; i < total; i++) {
    const ry = y + 38 + i * rowH
    drawBadge(c, i + 1, x + 14, ry, 11)
    const p = entries[i]
    if (p) {
      drawAvatar(c, p, x + 44, ry, Math.min(14, rowH * 0.38))
      drawName(c, p.name, x + 64, ry, 13, '#e2e8f0', 'left')
    } else {
      c.save()
      c.fillStyle = 'rgba(148,163,184,.2)'
      c.fillRect(x + 34, ry - 3, 130, 6)
      c.restore()
    }
  }
}

export function roundRectPath(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

interface Bit {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  color: string
  life: number
  size: number
}

export class Confetti {
  private bits: Bit[] = []

  burst(x: number, y: number, count = 100): void {
    const colors = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#f87171', '#a78bfa']
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 120 + Math.random() * 380
      this.bits.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 150,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        color: colors[i % colors.length],
        life: 1.6 + Math.random() * 0.8,
        size: 5 + Math.random() * 5,
      })
    }
  }

  step(c: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i]
      b.life -= dt
      if (b.life <= 0) {
        this.bits.splice(i, 1)
        continue
      }
      b.vy += 500 * dt
      b.vx *= 0.99
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.rot += b.vr * dt
      c.save()
      c.translate(b.x, b.y)
      c.rotate(b.rot)
      c.globalAlpha = Math.min(1, b.life)
      c.fillStyle = b.color
      c.fillRect(-b.size / 2, -b.size / 2, b.size, b.size * 0.6)
      c.restore()
    }
  }
}
