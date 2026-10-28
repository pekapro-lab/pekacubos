// All sounds synthesised with WebAudio (filtered noise bursts + short tones).
const PROFILE = { grass: [900, 2.5], dirt: [500, 2], sand: [1600, 1.2], stone: [1800, 6], wood: [420, 8], glass: [4200, 12] }
export class Sfx {
  constructor() { this.ctx = null; this.vol = 0.7; this.buf = null }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); this.master.gain.value = this.vol
      const n = this.ctx.sampleRate * 0.5; this.buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate)
      const d = this.buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v }
  suspend() { this.ctx?.suspend?.() }
  burst(kind, dur, gain, pitch = 1) {
    if (!this.ctx || this.vol <= 0 || this.ctx.state !== 'running') return
    const [f, q] = PROFILE[kind] || PROFILE.dirt, t = this.ctx.currentTime
    const s = this.ctx.createBufferSource(); s.buffer = this.buf; s.playbackRate.value = pitch
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * pitch; bp.Q.value = q
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    s.connect(bp).connect(g).connect(this.master); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02)
  }
  dig(kind) { this.burst(kind, 0.09, 0.5, 0.9 + Math.random() * 0.2) }
  brk(kind) { this.burst(kind, 0.25, 0.9, 0.8); if (kind === 'glass') this.tone(1800, 0.15, 0.15) }
  place(kind) { this.burst(kind, 0.12, 0.8, 0.7) }
  step(kind) { this.burst(kind, 0.07, 0.25, 0.8 + Math.random() * 0.3) }
  tone(freq, dur, gain) {
    if (!this.ctx || this.vol <= 0 || this.ctx.state !== 'running') return
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain()
    o.frequency.value = freq; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02)
  }
}
