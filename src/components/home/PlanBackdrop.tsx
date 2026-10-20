// Architectural plan behind the hero — the studio's real drawing, very subtle background.
// mix-blend-mode: multiply makes white areas invisible on the cream background.

export default function PlanBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Left instance */}
      <img
        src="/brand/plan-transparente.png"
        alt=""
        className="absolute"
        style={{
          left: '-8%',
          top: '2%',
          width: '72%',
          opacity: 0.14,
          filter: 'sepia(1) saturate(6) hue-rotate(215deg) brightness(0.45) contrast(1.4)',
          mixBlendMode: 'multiply',
          transform: 'rotate(-18deg)',
          objectFit: 'contain',
        }}
      />
      {/* Right instance — mirrored */}
      <img
        src="/brand/plan-transparente.png"
        alt=""
        className="absolute"
        style={{
          right: '-14%',
          bottom: '2%',
          width: '60%',
          opacity: 0.1,
          filter: 'sepia(1) saturate(6) hue-rotate(215deg) brightness(0.45) contrast(1.4)',
          mixBlendMode: 'multiply',
          transform: 'scaleX(-1) rotate(-18deg)',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}

