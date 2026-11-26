let context: AudioContext | null = null;

/** Browsers require a user gesture before an audio context can play. */
export async function unlockNotificationSound(): Promise<boolean> {
  try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!context || context.state === 'closed') context = new AudioContextClass();
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  } catch {
    return false;
  }
}

/** Play only after the browser has allowed audio; a blocked sound must not block notifications. */
export function playNotificationSound(): boolean {
  if (!context || context.state !== 'running') return false;
  try {
    const start = context.currentTime;
    for (const [offset, frequency] of [[0, 660], [0.13, 880]]) {
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, start + offset);
      volume.gain.exponentialRampToValueAtTime(0.08, start + offset + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.2);
    }
    return true;
  } catch {
    return false;
  }
}
