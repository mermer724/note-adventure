import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private speakTimer = 0;
  private oscillators: OscillatorNode[] = [];

  constructor() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      window.speechSynthesis.getVoices();
    });
  }

  unlock(): void {
    const ctx = this.context();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }

  cheer(frequency: number): void {
    this.stopTune();
    const now = this.context().currentTime;
    const note = this.audible(frequency);

    this.tone(note, now, 0.36, 'triangle', 0.11);
    this.tone(note * 2, now, 0.24, 'sine', 0.03);

    const melody: Array<[number, number, number]> = [
      [523.25, 0.08, 0.18],
      [659.25, 0.28, 0.18],
      [783.99, 0.48, 0.2],
      [1046.5, 0.7, 0.32],
      [783.99, 1.1, 0.16],
      [880, 1.28, 0.16],
      [1046.5, 1.48, 0.55],
    ];
    for (const [freq, at, duration] of melody) {
      this.tone(freq, now + at, duration, 'triangle', 0.09);
      this.tone(freq * 2, now + at, duration * 0.55, 'sine', 0.022);
    }

    const chords: Array<[number, number[]]> = [
      [0.08, [261.63, 329.63, 392]],
      [0.7, [349.23, 440, 523.25]],
      [1.28, [392, 493.88, 587.33]],
      [1.62, [261.63, 329.63, 392, 523.25]],
    ];
    for (const [at, notes] of chords) {
      for (const freq of notes) this.tone(freq, now + at, 0.5, 'sine', 0.035);
    }

    const bass: Array<[number, number]> = [
      [0.08, 130.81],
      [0.4, 196],
      [0.72, 174.61],
      [1.04, 130.81],
      [1.36, 196],
      [1.68, 130.81],
    ];
    for (const [at, freq] of bass) this.tone(freq, now + at, 0.22, 'triangle', 0.055);

    this.speakLater('太棒了', 90);
  }

  tryAgain(): void {
    this.stopTune();
    const now = this.context().currentTime;
    this.tone(392, now, 0.16, 'sine', 0.08);
    this.tone(311.13, now + 0.14, 0.3, 'sine', 0.07);
    this.speakLater('再试一次', 40);
  }

  private audible(frequency: number): number {
    let freq = frequency;
    while (freq < 220) freq *= 2;
    return freq;
  }

  private context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private tone(
    frequency: number,
    when: number,
    duration: number,
    type: OscillatorType,
    peak: number,
  ): void {
    const ctx = this.context();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(this.master ?? ctx.destination);
    osc.start(when);
    osc.stop(when + duration + 0.05);
    this.oscillators.push(osc);
  }

  stop(): void {
    this.stopTune();
  }

  private stopTune(): void {
    window.clearTimeout(this.speakTimer);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const now = this.ctx?.currentTime ?? 0;
    for (const osc of this.oscillators) {
      try {
        osc.stop(now);
      } catch {
        // This note has already finished.
      }
    }
    this.oscillators = [];
  }

  private speakLater(text: string, delay: number): void {
    window.clearTimeout(this.speakTimer);
    this.speakTimer = window.setTimeout(() => this.speak(text), delay);
  }

  private childVoice(): SpeechSynthesisVoice | undefined {
    if (!('speechSynthesis' in window)) return undefined;
    const voices = window.speechSynthesis.getVoices().filter((voice) => /zh/i.test(voice.lang));
    const rank = (voice: SpeechSynthesisVoice): number => {
      const name = voice.name.toLowerCase();
      let score = /zh-cn|zh_cn/.test(voice.lang.toLowerCase()) ? 2 : 0;
      if (/ting|mei|sin|tian|lili|google|female/.test(name)) score += 5;
      if (/male|yu-shu|eddy/.test(name)) score -= 4;
      return score;
    };
    return voices.sort((a, b) => rank(b) - rank(a))[0];
  }

  private speak(text: string): void {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.childVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? 'zh-CN';
    utterance.pitch = 1.85;
    utterance.rate = 1.05;
    utterance.volume = 1;
    synth.speak(utterance);
  }
}
