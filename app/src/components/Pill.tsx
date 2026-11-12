import type { PillColour, PillShape } from '../model/types'

/** A tablet drawn as it looks in the hand: shape, colour and score line. Decorative; the name is always in text beside it. */
export function Pill({ shape, colour, size = 26, tilt = 0 }: { shape: PillShape; colour: PillColour; size?: number; tilt?: number }) {
  const fill = `var(--pill-${colour})`
  if (shape === 'round') {
    return (
      <svg className="pill" width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" style={{ transform: `rotate(${tilt}deg)` }}>
        <circle cx="13" cy="13" r="11.25" fill={fill} stroke="var(--pill-edge)" strokeWidth="1" />
        <path d="M5.5 13h15" stroke="var(--pill-edge)" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
        <path d="M7.4 8.2a7.5 7.5 0 0 1 5.6-2.9" stroke="var(--pill-shine)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>
    )
  }
  if (shape === 'oval') {
    const w = size * 1.45
    return (
      <svg className="pill" width={w} height={size} viewBox="0 0 38 26" aria-hidden="true" style={{ transform: `rotate(${tilt}deg)` }}>
        <rect x="1.25" y="3.25" width="35.5" height="19.5" rx="9.75" fill={fill} stroke="var(--pill-edge)" strokeWidth="1" />
        <path d="M19 6.5v13" stroke="var(--pill-edge)" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
        <path d="M7 8.6c2-1.6 5-2.2 8-2.2" stroke="var(--pill-shine)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>
    )
  }
  const w = size * 1.7
  return (
    <svg className="pill" width={w} height={size} viewBox="0 0 44 26" aria-hidden="true" style={{ transform: `rotate(${tilt}deg)` }}>
      <path d="M13 4.25h9v17.5h-9a8.75 8.75 0 0 1 0-17.5Z" fill={fill} stroke="var(--pill-edge)" strokeWidth="1" />
      <path d="M22 4.25h9a8.75 8.75 0 0 1 0 17.5h-9Z" fill="var(--pill-white)" stroke="var(--pill-edge)" strokeWidth="1" />
      <path d="M8 9c1.4-1.5 3.3-2.3 5.5-2.3" stroke="var(--pill-shine)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  )
}
