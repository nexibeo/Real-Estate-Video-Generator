export function PipelineDiagram({ className = '' }: { className?: string }) {
  const steps = [
    { x: 10, label: 'Photos', sub: 'upload' },
    { x: 148, label: 'Rooms', sub: 'Jev decides' },
    { x: 286, label: 'Shots', sub: 'one per room' },
    { x: 424, label: 'Clips', sub: 'Replicate' },
    { x: 562, label: 'Voice', sub: 'OpenRouter' },
    { x: 700, label: 'Video', sub: 'your browser' },
  ];
  return (
    <svg viewBox="0 0 820 118" className={className} role="img" aria-label="Pipeline: photos, rooms, shots, clips, voice, video">
      <defs>
        <linearGradient id="pipe" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C8A24A" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#C8A24A" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#4ADE80" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <line x1="30" y1="40" x2="790" y2="40" stroke="url(#pipe)" strokeWidth="2" />
      {steps.map((s, i) => (
        <g key={s.label}>
          <rect x={s.x} y={22} width={108} height={36} rx={7}
                fill="#12151A" stroke={i === steps.length - 1 ? '#C8A24A' : '#262C35'} strokeWidth="1" />
          <text x={s.x + 54} y={45} textAnchor="middle" fontSize="13" fill="#E8EBEF"
                fontFamily="-apple-system, Segoe UI, sans-serif" fontWeight="500">{s.label}</text>
          <text x={s.x + 54} y={78} textAnchor="middle" fontSize="10.5" fill="#8A94A3"
                fontFamily="-apple-system, Segoe UI, sans-serif">{s.sub}</text>
          {i < steps.length - 1 && (
            <polygon points={`${s.x + 118},36 ${s.x + 128},40 ${s.x + 118},44`} fill="#C8A24A" opacity="0.7" />
          )}
        </g>
      ))}
    </svg>
  );
}
