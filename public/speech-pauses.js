// Watch the microphone level without playing it back or sending it anywhere.
const sampleMs = 50;
const pauseMs = 1200;
const minSplitIntervalMs = 3200;
const minLevel = 0.009;

export function watchSpeechPauses(stream, onPause) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  let context, analyser;
  try {
    context = new AudioContext();
    analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    context.createMediaStreamSource(stream).connect(analyser);
    void context.resume().catch(() => {});
  } catch {
    void context?.close().catch(() => {});
    return null;
  }

  const samples = new Float32Array(analyser.fftSize);
  let hasSound = false, quietMs = 0, lastSplit = -Infinity;
  const timer = window.setInterval(() => {
    if (context.state !== 'running') {
      quietMs = 0;
      return;
    }
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    if (Math.sqrt(sum / samples.length) >= minLevel) {
      hasSound = true;
      quietMs = 0;
      return;
    }

    if (!hasSound) return;
    quietMs += sampleMs;
    const now = performance.now();
    if (quietMs >= pauseMs && now - lastSplit >= minSplitIntervalMs && onPause()) {
      lastSplit = now;
      hasSound = false;
      quietMs = 0;
    }
  }, sampleMs);

  return {
    isQuiet: () => context.state === 'running' && !hasSound,
    stop() {
      window.clearInterval(timer);
      void context.close().catch(() => {});
    },
  };
}
