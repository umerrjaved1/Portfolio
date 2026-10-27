// Original ambient music and UI sounds, synthesised live with the Web Audio API
// (no audio files). Off until the visitor turns it on.

const CHORDS = [
  [48, 55, 64, 71], // Cmaj7
  [45, 52, 60, 67], // Am7
  [41, 48, 57, 64], // Fmaj7
  [43, 50, 59, 65], // G7
];
const BAR = 4; // seconds per chord
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function createAudio() {
  let ctx = null;
  let master, music, fx, delay;
  let on = false;
  let timer = 0;
  let nextBar = 0;
  let bar = 0;

  function setup() {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 1600;
    lowpass.connect(master);
    music = ctx.createGain();
    music.gain.value = 0.9;
    music.connect(lowpass);

    delay = ctx.createDelay(1);
    delay.delayTime.value = 0.375;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    delay.connect(feedback).connect(delay);
    delay.connect(lowpass);

    fx = ctx.createGain();
    fx.gain.value = 0.5;
    fx.connect(ctx.destination);
  }

  function pad(freq, start, length) {
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.028, start + 1.2);
      gain.gain.setValueAtTime(0.028, start + length - 1);
      gain.gain.linearRampToValueAtTime(0, start + length + 0.6);
      osc.connect(gain).connect(music);
      osc.start(start);
      osc.stop(start + length + 0.7);
    }
  }

  function pluck(freq, start) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.06, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
    osc.connect(gain);
    gain.connect(music);
    gain.connect(delay);
    osc.start(start);
    osc.stop(start + 1.2);
  }

  function scheduleBar(start) {
    const chord = CHORDS[bar % CHORDS.length];
    chord.forEach((note) => pad(midi(note), start, BAR));
    // A gentle, slightly random arpeggio an octave up
    for (let step = 0; step < 8; step++) {
      if (Math.random() < 0.55) {
        const note = chord[Math.floor(Math.random() * chord.length)] + 12 + (Math.random() < 0.25 ? 12 : 0);
        pluck(midi(note), start + step * (BAR / 8));
      }
    }
    bar++;
  }

  function scheduler() {
    while (nextBar < ctx.currentTime + 1.5) {
      scheduleBar(nextBar);
      nextBar += BAR;
    }
  }

  return {
    get on() {
      return on;
    },
    async set(value) {
      if (value === on) return on;
      if (!ctx) setup();
      on = value;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      if (on) {
        await ctx.resume();
        nextBar = Math.max(nextBar, ctx.currentTime + 0.05);
        scheduler();
        timer = setInterval(scheduler, 500);
        master.gain.linearRampToValueAtTime(0.8, now + 1.5);
      } else {
        clearInterval(timer);
        master.gain.linearRampToValueAtTime(0, now + 0.6);
      }
      return on;
    },
    // Short UI sounds: "pop" for clicks, "chirp" for the character waving.
    play(kind = "pop") {
      if (!on || !ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      if (kind === "chirp") {
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(990, now + 0.22);
      } else {
        osc.frequency.setValueAtTime(720, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "chirp" ? 0.28 : 0.12));
      osc.connect(gain).connect(fx);
      osc.start(now);
      osc.stop(now + 0.3);
    },
  };
}
