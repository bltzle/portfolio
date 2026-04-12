let ctx = null

function getCtx() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noiseBuffer(c, duration, decayTau) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / decayTau)
  return buf
}

function envelope(c, gain, peak, attack, release) {
  const t = c.currentTime
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(peak, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release)
}

function play(nodes, src) {
  src.start()
  src.onended = () => nodes.forEach(n => n.disconnect())
}

// Arcade — narrow bandpass, bright blip.
function click() {
  const c = getCtx(); if (!c) return
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.007, 25)
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 4200
  filter.Q.value = 8
  const gain = c.createGain()
  envelope(c, gain, 0.22, 0.0005, 0.006)
  src.connect(filter); filter.connect(gain); gain.connect(c.destination)
  play([src, filter, gain], src)
}

// Sharper, more percussive. For primary buttons.
function tap() {
  const c = getCtx(); if (!c) return
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.01, 45)
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2600
  filter.Q.value = 4
  const gain = c.createGain()
  envelope(c, gain, 0.22, 0.001, 0.008)
  src.connect(filter); filter.connect(gain); gain.connect(c.destination)
  play([src, filter, gain], src)
}

// Barely there. For hover accents — use sparingly.
function hover() {
  const c = getCtx(); if (!c) return
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.008, 30)
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1600
  filter.Q.value = 6
  const gain = c.createGain()
  envelope(c, gain, 0.08, 0.001, 0.006)
  src.connect(filter); filter.connect(gain); gain.connect(c.destination)
  play([src, filter, gain], src)
}

// Short two-stage pitch lift. For toggles and state changes.
function toggle() {
  const c = getCtx(); if (!c) return
  const t = c.currentTime
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(520, t)
  osc.frequency.exponentialRampToValueAtTime(780, t + 0.06)
  const gain = c.createGain()
  envelope(c, gain, 0.12, 0.003, 0.07)
  osc.connect(gain); gain.connect(c.destination)
  osc.start(t)
  osc.stop(t + 0.08)
  osc.onended = () => { osc.disconnect(); gain.disconnect() }
}

// Slightly richer and longer. For successful actions.
function confirm() {
  const c = getCtx(); if (!c) return
  const t = c.currentTime
  const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.setValueAtTime(660, t)
  const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(990, t + 0.05)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.14, t + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
  o1.connect(gain); o2.connect(gain); gain.connect(c.destination)
  o1.start(t); o1.stop(t + 0.18)
  o2.start(t + 0.05); o2.stop(t + 0.18)
  o2.onended = () => { o1.disconnect(); o2.disconnect(); gain.disconnect() }
}

// Low thud with pitch fall. For something landing/dropping into place.
function drop() {
  const c = getCtx(); if (!c) return
  const t = c.currentTime
  const dur = 0.14

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(200, t)
  osc.frequency.exponentialRampToValueAtTime(55, t + dur)
  const oscGain = c.createGain()
  oscGain.gain.setValueAtTime(0, t)
  oscGain.gain.linearRampToValueAtTime(0.35, t + 0.004)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(oscGain); oscGain.connect(c.destination)
  osc.start(t); osc.stop(t + dur)

  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.012, 40)
  const f = c.createBiquadFilter()
  f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 1.5
  const nGain = c.createGain()
  envelope(c, nGain, 0.12, 0.001, 0.01)
  src.connect(f); f.connect(nGain); nGain.connect(c.destination)
  src.start(t)

  osc.onended = () => { osc.disconnect(); oscGain.disconnect() }
  src.onended = () => { src.disconnect(); f.disconnect(); nGain.disconnect() }
}

// Pitch rise. For something lifting/appearing — opposite of drop.
function rise() {
  const c = getCtx(); if (!c) return
  const t = c.currentTime
  const dur = 0.16

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(120, t)
  osc.frequency.exponentialRampToValueAtTime(520, t + dur)
  const oscGain = c.createGain()
  oscGain.gain.setValueAtTime(0.0001, t)
  oscGain.gain.exponentialRampToValueAtTime(0.28, t + dur * 0.6)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(oscGain); oscGain.connect(c.destination)
  osc.start(t); osc.stop(t + dur)
  osc.onended = () => { osc.disconnect(); oscGain.disconnect() }
}

export const sounds = { click, tap, hover, toggle, confirm, drop, rise }
