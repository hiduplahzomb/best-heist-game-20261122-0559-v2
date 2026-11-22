// Audio: tiny procedural WebAudio effects. No files, no network.
// Everything is a shaped oscillator blip; the context starts on first gesture.

let ctx = null;
let muted = false;

function ensureContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function blip(freq, duration, type, volume, slideTo) {
  if (muted) return;
  const ac = ensureContext();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
  gain.gain.setValueAtTime(volume || 0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export const sfx = {
  unlock() { ensureContext(); },
  toggleMute() { muted = !muted; return muted; },
  isMuted() { return muted; },
  click() { blip(660, 0.07, 'triangle', 0.08); },
  pickup() { blip(880, 0.12, 'sine', 0.14, 1320); },
  diamond() {
    blip(523, 0.16, 'sine', 0.14);
    setTimeout(() => blip(784, 0.16, 'sine', 0.14), 110);
    setTimeout(() => blip(1046, 0.28, 'sine', 0.16), 220);
  },
  coin() { blip(1568, 0.09, 'square', 0.05); },
  smoke() { blip(220, 0.3, 'sawtooth', 0.06, 90); },
  emp() { blip(1200, 0.35, 'sawtooth', 0.08, 120); },
  spotted() { blip(392, 0.18, 'square', 0.09, 311); },
  alarm() { blip(740, 0.22, 'square', 0.1, 620); },
  caught() {
    blip(330, 0.25, 'sawtooth', 0.12, 220);
    setTimeout(() => blip(220, 0.4, 'sawtooth', 0.12, 130), 200);
  },
  escape() {
    blip(659, 0.14, 'triangle', 0.13);
    setTimeout(() => blip(880, 0.14, 'triangle', 0.13), 130);
    setTimeout(() => blip(1175, 0.3, 'triangle', 0.15), 260);
  },
};
