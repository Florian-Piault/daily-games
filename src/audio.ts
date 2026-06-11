/** Effets sonores générés en Web Audio API — aucun fichier à charger. */
export class Sfx {
  muted: boolean
  private ctx: AudioContext | null = null

  constructor(muted: boolean) {
    this.muted = muted
  }

  private ac(): AudioContext | null {
    if (this.muted) return null
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  tone(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; vol?: number; when?: number; glideTo?: number } = {},
  ): void {
    const ac = this.ac()
    if (!ac) return
    const { type = 'sine', vol = 0.2, when = 0, glideTo } = opts
    const t0 = ac.currentTime + when
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), t0 + dur)
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g).connect(ac.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  private noise(dur: number, vol = 0.2, when = 0): void {
    const ac = this.ac()
    if (!ac) return
    const t0 = ac.currentTime + when
    const len = Math.ceil(ac.sampleRate * dur)
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ac.createBufferSource()
    src.buffer = buf
    const g = ac.createGain()
    g.gain.value = vol
    src.connect(g).connect(ac.destination)
    src.start(t0)
  }

  tick(): void {
    this.tone(880, 0.035, { type: 'square', vol: 0.04 })
  }

  pop(): void {
    this.tone(420, 0.12, { type: 'triangle', vol: 0.25, glideTo: 880 })
  }

  beep(high: boolean): void {
    this.tone(high ? 880 : 440, high ? 0.35 : 0.15, { type: 'square', vol: 0.12 })
  }

  boom(): void {
    this.tone(160, 0.4, { vol: 0.45, glideTo: 40 })
    this.noise(0.3, 0.25)
  }

  fanfare(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.22, when: i * 0.13 }))
    this.tone(1046.5, 0.5, { type: 'triangle', vol: 0.22, when: notes.length * 0.13 })
    this.noise(0.4, 0.08, notes.length * 0.13)
  }
}
