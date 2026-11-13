import React, { useId } from 'react';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const SLEEP_MESSAGES = [
  'Make room to rest',
  'Find a comfortable position',
  'Settle into your pillow',
  'Let your shoulders relax',
  'Rest your arms',
  'Get cozy under the blanket',
  'Light on, take a quiet moment',
  'Let the lights grow soft',
  'Lights out, time to unwind',
  'Drift gently into sleep',
  'Sweet dreams',
  'Breathe easy, rest deeply',
  'Rest under the moonlight',
  'Dream beneath the stars',
  'Well rested',
];

export function getSleepSceneState(hours: number) {
  const duration = Math.max(0, hours);
  return {
    message: SLEEP_MESSAGES[Math.min(SLEEP_MESSAGES.length - 1, Math.floor(duration * 2))],
    comfort: clamp(duration / 0.5),
    pillow: clamp((duration - 0.5) / 0.5),
    shoulders: clamp((duration - 1) / 0.5),
    arms: clamp((duration - 1.5) / 0.5),
    relaxed: clamp((duration - 2) / 0.5),
    lamp: 1 - clamp((duration - 3) / 1),
    // Reaches its final position at 3.5h and stays identical for every later step.
    blanket: clamp((duration - 2) / 1.5),
    eyesClosed: clamp((duration - 4) / 0.5),
    dreaming: duration >= 5,
    breathing: duration >= 5.5,
    night: clamp((duration - 5.5) / 0.5),
    twinkling: duration >= 6.5,
  };
}

/** A duration-driven scene: CSS handles transitions; only the head breathes. */
export const SleepScene: React.FC<{ hours: number }> = ({ hours }) => {
  const id = useId().replace(/:/g, '');
  const scene = getSleepSceneState(hours);

  return (
    <div className="sleep-scene w-full max-w-[260px] overflow-hidden rounded-2xl border border-indigo-200/80 dark:border-indigo-800/70"
      role="img" aria-label={`${hours} hours of sleep. ${scene.message}.`}>
      <svg viewBox="0 0 260 154" className="block h-auto w-full" aria-hidden="true">
        <defs>
          <clipPath id={`${id}-bed`}>
            <path d="M57 83h171v39H57z" />
          </clipPath>
          <linearGradient id={`${id}-room`} x2="0" y2="1">
            <stop stopColor="#24204c" />
            <stop offset="1" stopColor="#16162f" />
          </linearGradient>
          <radialGradient id={`${id}-lamp`}>
            <stop stopColor="#fde68a" stopOpacity="0.45" />
            <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M0 0h260v154H0z" fill={`url(#${id}-room)`} />
        <path d="M0 132h260" stroke="#49416c" />

        {/* Window: peaceful moonlight stays through the rest of the night. */}
        <rect x="169" y="15" width="65" height="64" rx="15" fill="#161832" stroke="#655b9b" strokeWidth="2" />
        <g className="sleep-scene-transition" style={{ opacity: 0.22 + scene.night * 0.78 }}>
          <path d="M207 27a12 12 0 1 0 12 17 12 12 0 0 1-12-17" fill="#fde68a" />
          <g className={scene.twinkling ? 'sleep-scene-stars is-twinkling' : 'sleep-scene-stars'} fill="#ddd6fe">
            <path d="m184 28 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" />
            <circle cx="221" cy="59" r="1.5" />
            <circle cx="191" cy="62" r="1" />
          </g>
        </g>
        <path d="M201 16v62m-31-24h63" stroke="#655b9b" strokeWidth="2" />

        {/* Lamp and bedside table, with a separate fading pool of light. */}
        <ellipse className="sleep-scene-transition" cx="30" cy="88" rx="68" ry="65" fill={`url(#${id}-lamp)`} style={{ opacity: scene.lamp }} />
        <path d="M15 108h28v23m-24-23v23" fill="none" stroke="#8777b2" strokeWidth="3" strokeLinecap="round" />
        <path d="M29 88v16m-7 0h14" stroke="#a89bc9" strokeWidth="2.5" strokeLinecap="round" />
        <path className="sleep-scene-transition" d="m20 72-6 17h30l-6-17Z" style={{ fill: scene.lamp > 0 ? '#dec18c' : '#81749b' }} />
        <path className="sleep-scene-transition" d="M19 88h20" stroke="#fff0b3" strokeWidth="3" style={{ opacity: scene.lamp }} />

        <ellipse cx="146" cy="140" rx="94" ry="5" fill="#0c0b22" opacity="0.35" />
        <path d="M53 89v47m179-32v32M54 124h177" stroke="#8d7bbe" strokeWidth="7" strokeLinecap="round" />
        <rect x="57" y="107" width="171" height="15" rx="7" fill="#bcb1e4" />
        <rect x="61" y="96" width="47" height="15" rx="7" fill="#ede9fe" className="sleep-scene-transition" style={{ transform: `rotate(${-2 - scene.pillow * 3}deg)`, transformOrigin: '84px 103px' }} />
        <path className="sleep-scene-transition" d="M90 101q19-20 46-1l60 9H91Z" fill="#a394d6" style={{ transform: `translateY(${scene.shoulders * 2}px)` }} />

        {/* Pose transitions and breathing are scoped to the visible head only. */}
        <g className="sleep-scene-transition" style={{ transform: `translate(${scene.comfort * 2}px, ${scene.relaxed * 2}px) rotate(${scene.relaxed * -4}deg)`, transformOrigin: '83px 94px' }}>
          <g className={scene.breathing ? 'sleep-scene-head is-breathing' : 'sleep-scene-head'}>
            <circle cx="82" cy="90" r="14" fill="#e9b596" />
            <path d="M68 93q-6-22 14-21 16 1 15 15l-10-5-8 5-2 11Z" fill="#44313e" />
            <ellipse className="sleep-scene-transition" cx="90" cy="91" rx="2" ry="2.8" fill="#4b3440" style={{ opacity: 1 - scene.eyesClosed, transform: `scaleY(${1 - scene.eyesClosed})`, transformOrigin: '90px 91px' }} />
            <path className="sleep-scene-transition" d="M87 92q3 3 6 0" fill="none" stroke="#664551" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: scene.eyesClosed }} />
          </g>
        </g>

        {/* Never place the blanket inside a breathing or looping animation group.
            Only this duration-derived translation changes, and it clamps at 3.5h. */}
        <g clipPath={`url(#${id}-bed)`}>
          <g className="sleep-scene-blanket" style={{ transform: `translate(${-18 * scene.blanket}px, ${-8 * scene.blanket}px)` }}>
            <path d="M126 104q25-17 49-2l39 5q12 2 12 14v18H119Z" fill="#7960d6" />
            <path d="M126 105q25-13 48-1l39 6" fill="none" stroke="#b5a0f0" strokeWidth="3" strokeLinecap="round" />
            <path d="m159 108-3 9m28-7-2 7" stroke="#9077df" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
        <path className="sleep-scene-transition" d="M100 106q8 4 16 0" fill="none" stroke="#e9b596" strokeWidth="5" strokeLinecap="round" style={{ transform: `translate(${scene.arms * -3}px, ${scene.arms * 2}px)` }} />
        {/* The front rail conceals the bottom edge as the blanket is pulled up. */}
        <path d="M58 123h169" stroke="#8d7bbe" strokeWidth="6" strokeLinecap="round" />

        <g className="sleep-scene-transition" style={{ opacity: scene.dreaming ? 1 : 0 }} fill="#c4b5fd" fontFamily="system-ui, sans-serif" fontWeight="600">
          {[{ x: 105, y: 73, size: 10 }, { x: 120, y: 57, size: 13 }, { x: 139, y: 39, size: 16 }].map((z, index) => (
            <text key={index} x={z.x} y={z.y} fontSize={z.size} className={scene.dreaming ? 'sleep-scene-zzz is-floating' : 'sleep-scene-zzz'} style={{ animationDelay: `${index * 1.2}s` }}>{index === 2 ? 'Z' : 'z'}</text>
          ))}
        </g>
      </svg>
    </div>
  );
};
