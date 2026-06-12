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

  /** Cran « mécanique » plus grave que tick — pour les derniers crans du ralenti. */
  ratchet(): void {
    this.tone(220, 0.05, { type: 'square', vol: 0.06 })
    this.noise(0.03, 0.05)
  }

  pop(): void {
    this.tone(420, 0.12, { type: 'triangle', vol: 0.25, glideTo: 880 })
  }

  /** Roulement de tambour bouclé, de durée variable. Retourne un handle pour l'arrêter. */
  drumroll(): { stop(): void } {
    const ac = this.ac()
    if (!ac) return { stop() {} }
    const t0 = ac.currentTime
    // bruit bouclé filtré façon roulement
    const len = Math.ceil(ac.sampleRate * 0.5)
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    src.buffer = buf
    src.loop = true
    const band = ac.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 180
    band.Q.value = 0.8
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(0.18, t0 + 0.12)
    src.connect(band).connect(g).connect(ac.destination)
    src.start(t0)
    let stopped = false
    return {
      stop: () => {
        if (stopped) return
        stopped = true
        const now = ac.currentTime
        g.gain.cancelScheduledValues(now)
        g.gain.setValueAtTime(g.gain.value, now)
        g.gain.linearRampToValueAtTime(0.0001, now + 0.08)
        src.stop(now + 0.1)
      },
    }
  }

  /** Montée de tension : glissando ascendant + crescendo. Build-up et faux-suspense. */
  riser(dur = 1.5): void {
    const ac = this.ac()
    if (!ac) return
    const t0 = ac.currentTime
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(180, t0)
    osc.frequency.exponentialRampToValueAtTime(900, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(0.16, t0 + dur * 0.85)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.1)
    osc.connect(g).connect(ac.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.15)
  }

  /** Jingle de victoire enrichi pour le verdict spectaculaire. */
  jackpot(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    notes.forEach((f, i) => {
      this.tone(f, 0.22, { type: 'triangle', vol: 0.22, when: i * 0.1 })
      this.tone(f / 2, 0.22, { type: 'sine', vol: 0.1, when: i * 0.1 })
    })
    this.tone(1318.5, 0.6, { type: 'triangle', vol: 0.24, when: notes.length * 0.1 })
    this.noise(0.5, 0.1, notes.length * 0.1)
  }

  beep(high: boolean): void {
    this.tone(high ? 880 : 440, high ? 0.35 : 0.15, { type: 'square', vol: 0.12 })
  }

  boom(): void {
    this.tone(160, 0.4, { vol: 0.45, glideTo: 40 })
    this.noise(0.3, 0.25)
  }

  timeUp(): void {
    this.tone(660, 0.15, { type: 'triangle', vol: 0.18 })
    this.tone(520, 0.3, { type: 'triangle', vol: 0.18, when: 0.18 })
  }

  fanfare(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.22, when: i * 0.13 }))
    this.tone(1046.5, 0.5, { type: 'triangle', vol: 0.22, when: notes.length * 0.13 })
    this.noise(0.4, 0.08, notes.length * 0.13)
  }
}
