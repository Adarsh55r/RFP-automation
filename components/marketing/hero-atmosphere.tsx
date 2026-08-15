export function HeroAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute top-0 right-0 h-full w-full md:w-1/2">
        <div className="hero-glow absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-card bg-brand/15 blur-3xl" />
        <div className="absolute top-[18%] right-[12%] h-[240px] w-[240px] rounded-card bg-accent/10 blur-3xl" />
      </div>
      <svg
        className="absolute inset-0 h-full w-full text-brand"
        viewBox="0 0 1200 720"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="currentColor" strokeOpacity="0.16" strokeWidth="1">
          <line x1="80" y1="120" x2="220" y2="90" />
          <line x1="220" y1="90" x2="340" y2="180" />
          <line x1="340" y1="180" x2="180" y2="250" />
          <line x1="180" y1="250" x2="80" y2="120" />
          <line x1="340" y1="180" x2="480" y2="110" />
          <line x1="480" y1="110" x2="520" y2="260" />
          <line x1="180" y1="250" x2="300" y2="380" />
          <line x1="300" y1="380" x2="140" y2="460" />
          <line x1="300" y1="380" x2="460" y2="430" />
          <line x1="520" y1="260" x2="460" y2="430" />
          <line x1="900" y1="80" x2="1040" y2="140" />
          <line x1="1040" y1="140" x2="980" y2="280" />
          <line x1="980" y1="280" x2="1120" y2="360" />
          <line x1="1120" y1="360" x2="1000" y2="520" />
          <line x1="980" y1="280" x2="860" y2="420" />
        </g>
        <g fill="currentColor">
          {[
            [80, 120],
            [220, 90],
            [340, 180],
            [180, 250],
            [480, 110],
            [520, 260],
            [300, 380],
            [140, 460],
            [460, 430],
            [900, 80],
            [1040, 140],
            [980, 280],
            [1120, 360],
            [1000, 520],
            [860, 420],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" fillOpacity="0.28" />
          ))}
        </g>
      </svg>
    </div>
  );
}
