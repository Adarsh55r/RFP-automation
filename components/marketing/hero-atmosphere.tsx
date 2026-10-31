/** Moving colour fields, a fading grid and a soft spotlight behind the hero. */
export function HeroAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="bg-grid absolute inset-0" />
      <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--glow)/0.22),transparent)] blur-2xl" />
      <div className="hero-glow absolute top-1/3 -right-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgb(56_189_248/0.16),transparent)] blur-2xl" />
      <div className="absolute bottom-0 -left-24 h-[360px] w-[360px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_22%,transparent),transparent)] blur-2xl" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-surface" />
    </div>
  );
}
