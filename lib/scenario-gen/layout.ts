export type TableSize = "3x3" | "3x4" | "4x6"

export type ObjectiveType = "fight" | "center" | "markers" | "breakthrough"

export type TerrainKind =
  | "largeBuilding"
  | "smallBuilding"
  | "tree"
  | "hill"
  | "water"
  | "rough"
  | "woods"
  | "wall"

export type PickupInventory = Record<TerrainKind, number>

export const BOX_INVENTORY: PickupInventory = {
  largeBuilding: 2,
  smallBuilding: 4,
  tree: 6,
  hill: 0,
  water: 0,
  rough: 0,
  woods: 0,
  wall: 0,
}

export const TERRAIN_LABEL: Record<TerrainKind, string> = {
  largeBuilding: "Large buildings",
  smallBuilding: "Small buildings",
  tree: "Trees",
  hill: "Hills",
  water: "Water",
  rough: "Rough ground",
  woods: "Woods",
  wall: "Walls",
}

type Spec = { w: number; h: number; label: string; blocksLos: boolean }

const SPECS: Record<TerrainKind, Spec> = {
  largeBuilding: { w: 6, h: 4, label: "large building", blocksLos: true },
  smallBuilding: { w: 3, h: 3, label: "small building", blocksLos: true },
  hill: { w: 6, h: 6, label: "hill", blocksLos: true },
  wall: { w: 6, h: 1, label: "wall", blocksLos: true },
  tree: { w: 2, h: 2, label: "tree", blocksLos: false },
  woods: { w: 4, h: 4, label: "woods", blocksLos: false },
  water: { w: 6, h: 4, label: "water", blocksLos: false },
  rough: { w: 4, h: 4, label: "rough ground", blocksLos: false },
}

const ORDER: TerrainKind[] = [
  "largeBuilding",
  "smallBuilding",
  "hill",
  "wall",
  "tree",
  "woods",
  "water",
  "rough",
]

const TABLES: Record<TableSize, { width: number; depth: number; cap: number }> = {
  "3x3": { width: 36, depth: 36, cap: 4 },
  "3x4": { width: 48, depth: 36, cap: 6 },
  "4x6": { width: 72, depth: 48, cap: 10 },
}

export type PieceRole = "center" | "host" | "guest"

export type LayoutPiece = {
  id: string
  kind: TerrainKind
  x: number
  y: number
  w: number
  h: number
  label: string
  number: number
  blocksLos: boolean
  role: PieceRole
}

export type MapObjective = {
  id: string
  label: string
  kind: "hold" | "exit"
  x: number
  y: number
}

export type Layout = {
  width: number
  depth: number
  zoneDepth: number
  seed: string
  pieces: LayoutPiece[]
  objectives: MapObjective[]
}

const ZONE = 6
const GAP = 1

export function generateLayout(input: {
  table: TableSize
  inventory: PickupInventory
  objective: ObjectiveType
  seed: string
}): Layout {
  const table = TABLES[input.table]
  const rand = mulberry32(hashSeed(input.seed))
  const pieces: LayoutPiece[] = []
  let centerUsed = false

  function overlaps(a: LayoutPiece, b: LayoutPiece): boolean {
    return a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x && a.y < b.y + b.h + GAP && a.y + a.h + GAP > b.y
  }

  function inside(piece: LayoutPiece): boolean {
    return (
      piece.x >= GAP &&
      piece.y >= ZONE &&
      piece.x + piece.w <= table.width - GAP &&
      piece.y + piece.h <= table.depth - ZONE
    )
  }

  function fits(piece: LayoutPiece): boolean {
    return inside(piece) && pieces.every((other) => !overlaps(piece, other))
  }

  function make(kind: TerrainKind, x: number, y: number, role: PieceRole): LayoutPiece {
    const spec = SPECS[kind]
    return {
      id: "",
      kind,
      x,
      y,
      w: spec.w,
      h: spec.h,
      label: spec.label,
      number: 0,
      blocksLos: spec.blocksLos,
      role,
    }
  }

  function placeCenter(kind: TerrainKind) {
    const spec = SPECS[kind]
    const piece = make(kind, Math.round((table.width - spec.w) / 2), Math.round((table.depth - spec.h) / 2), "center")
    if (!fits(piece)) return false
    pieces.push(piece)
    return true
  }

  function placePair(kind: TerrainKind): boolean {
    const spec = SPECS[kind]
    const minY = ZONE
    const maxY = Math.floor(table.depth / 2 - GAP - spec.h)
    const spanX = table.width - spec.w - GAP * 2
    if (maxY < minY || spanX < 0) return false
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const x = GAP + Math.floor(rand() * (spanX + 1))
      const y = minY + Math.floor(rand() * (maxY - minY + 1))
      const host = make(kind, x, y, "host")
      const guest = make(kind, table.width - x - spec.w, table.depth - y - spec.h, "guest")
      if (fits(host) && fits(guest) && !overlaps(host, guest)) {
        pieces.push(host, guest)
        return true
      }
    }
    return false
  }

  for (const kind of ORDER) {
    let count = Math.max(0, Math.floor(input.inventory[kind] ?? 0))
    if (!centerUsed && SPECS[kind].blocksLos && count % 2 === 1 && pieces.length < table.cap) {
      if (placeCenter(kind)) {
        count -= 1
        centerUsed = true
      }
    }
    while (count >= 2 && pieces.length + 2 <= table.cap) {
      if (!placePair(kind)) break
      count -= 2
    }
  }

  pieces.forEach((piece, index) => {
    piece.number = index + 1
    piece.id = `p${piece.number}`
  })

  return {
    width: table.width,
    depth: table.depth,
    zoneDepth: ZONE,
    seed: input.seed,
    pieces,
    objectives: placeObjectives(input.objective, pieces, table.width, table.depth),
  }
}

export type FixedPiece = { kind: TerrainKind; x: number; y: number; role: PieceRole }

// A hand-drawn 3 by 4 table. `pair` mirrors a host piece onto the guest half.
export function fixedLayout(seed: string, pieces: FixedPiece[], objectives: MapObjective[]): Layout {
  const table = TABLES["3x4"]
  return {
    width: table.width,
    depth: table.depth,
    zoneDepth: ZONE,
    seed,
    pieces: pieces.map((piece, index) => {
      const spec = SPECS[piece.kind]
      return {
        id: `p${index + 1}`,
        kind: piece.kind,
        x: piece.x,
        y: piece.y,
        w: spec.w,
        h: spec.h,
        label: spec.label,
        number: index + 1,
        blocksLos: spec.blocksLos,
        role: piece.role,
      }
    }),
    objectives,
  }
}

export function pair(kind: TerrainKind, x: number, y: number): FixedPiece[] {
  const table = TABLES["3x4"]
  const spec = SPECS[kind]
  return [
    { kind, x, y, role: "host" },
    { kind, x: table.width - x - spec.w, y: table.depth - y - spec.h, role: "guest" },
  ]
}

export const PIECE_GAP = GAP

function placeObjectives(
  objective: ObjectiveType,
  pieces: LayoutPiece[],
  width: number,
  depth: number,
): MapObjective[] {
  if (objective === "fight") return []
  if (objective === "breakthrough") {
    return [{ id: "exit", label: "the far edge", kind: "exit", x: width / 2, y: depth / 2 }]
  }
  const count = objective === "center" ? 1 : width >= 60 ? 3 : 2
  const spots = count === 1 ? [0.5] : count === 2 ? [1 / 3, 2 / 3] : [0.25, 0.5, 0.75]
  return spots.map((spot, index) => {
    let x = width * spot
    const y = depth / 2
    if (inBuilding(x, y, pieces)) {
      for (const shift of [4, -4, 8, -8, 12, -12]) {
        if (x + shift > ZONE && x + shift < width - ZONE && !inBuilding(x + shift, y, pieces)) {
          x += shift
          break
        }
      }
    }
    return {
      id: `hold-${index + 1}`,
      label: count === 1 ? "the center beacon" : `beacon ${index + 1}`,
      kind: "hold" as const,
      x,
      y,
    }
  })
}

function inBuilding(x: number, y: number, pieces: LayoutPiece[]): boolean {
  return pieces.some(
    (piece) =>
      (piece.kind === "largeBuilding" || piece.kind === "smallBuilding") &&
      x >= piece.x &&
      x <= piece.x + piece.w &&
      y >= piece.y &&
      y <= piece.y + piece.h,
  )
}

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
