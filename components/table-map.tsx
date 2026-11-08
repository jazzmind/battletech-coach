import type { Screen } from "@/lib/game/types"

export function TableMap({ map }: { map: NonNullable<Screen["map"]> }) {
  const { width, depth, zoneDepth } = map
  const lines: number[] = []
  for (let inch = 0; inch <= Math.max(width, depth); inch += 6) lines.push(inch)
  return (
    <figure className="table-map" data-testid="table-map">
      <svg viewBox={`-4 -6 ${width + 8} ${depth + 12}`} role="img" aria-label="Table layout in inches">
        <rect x={0} y={0} width={width} height={depth} className="mat" />
        <rect x={0} y={0} width={width} height={zoneDepth} className="zone" />
        <rect x={0} y={depth - zoneDepth} width={width} height={zoneDepth} className="zone" />
        {lines.filter((inch) => inch <= width).map((inch) => (
          <line key={`v${inch}`} x1={inch} y1={0} x2={inch} y2={depth} className="grid" />
        ))}
        {lines.filter((inch) => inch <= depth).map((inch) => (
          <line key={`h${inch}`} x1={0} y1={inch} x2={width} y2={inch} className="grid" />
        ))}
        {map.objectives.filter((item) => item.kind === "exit").map((item) => (
          <g key={item.label}>
            <rect x={0} y={0} width={width} height={2} className="exit" />
            <rect x={0} y={depth - 2} width={width} height={2} className="exit" />
          </g>
        ))}
        {map.pieces.map((piece) => (
          <g key={piece.number}>
            <rect
              x={piece.x}
              y={piece.y}
              width={piece.w}
              height={piece.h}
              className={`piece${piece.blocksLos ? " solid" : ""}${map.highlight === piece.number ? " hot" : ""}`}
            />
            <text x={piece.x + piece.w / 2} y={piece.y + piece.h / 2} textAnchor="middle" dominantBaseline="middle">
              {piece.number}
            </text>
          </g>
        ))}
        {map.objectives.filter((item) => item.kind === "hold").map((item) => (
          <g key={item.label}>
            <circle cx={item.x} cy={item.y} r={1.6} className="beacon" />
            <text x={item.x} y={item.y - 2.2} textAnchor="middle">
              {item.label}
            </text>
          </g>
        ))}
        <text x={width / 2} y={-2} textAnchor="middle" className="edge">
          {map.host}
        </text>
        <text x={width / 2} y={depth + 4} textAnchor="middle" className="edge">
          {map.guest}
        </text>
      </svg>
      <figcaption>Each square is 6 inches. Home edges are the shaded strips.</figcaption>
    </figure>
  )
}
