import { rules, type Scenario, type TerrainStep } from "../game/scenarios"
import { generateLayout, type Layout, type ObjectiveType, type PickupInventory, type TableSize, type TerrainKind } from "./layout"

const KIND_NAME: Record<TerrainKind, string> = {
  largeBuilding: "large building",
  smallBuilding: "small building",
  tree: "tree",
  hill: "hill",
  water: "water",
  rough: "rough ground",
  woods: "woods",
  wall: "wall",
}

export function makeLayout(input: {
  table: TableSize
  inventory: PickupInventory
  objective: ObjectiveType
  seed: string
}): Layout {
  return generateLayout(input)
}

export function pickupScenario(layout: Layout, objective: ObjectiveType): Scenario {
  const holds = layout.objectives.filter((item) => item.kind === "hold")
  const exits = layout.objectives.some((item) => item.kind === "exit")
  const beacon = holds.length > 0 || exits
  const beaconGoal = objective === "center" ? 2 : objective === "breakthrough" ? 1 : Math.max(holds.length, 1)
  const title =
    objective === "fight"
      ? "Stand-up fight"
      : objective === "center"
        ? "Hold the center"
        : objective === "markers"
          ? "The beacons"
          : "Breakthrough"
  const goal =
    objective === "fight"
      ? "Knock out every enemy mech."
      : objective === "center"
        ? "Hold the center beacon. First to 2, or the last side standing."
        : objective === "markers"
          ? `Score the beacons. First to ${beaconGoal}, or the last side standing.`
          : "Get a mech off the far edge, or knock out the other side."
  return {
    id: "pickup",
    group: "graduation",
    pickup: true,
    title,
    summary: "Your mechs, a generated table, and the full quick-start turn.",
    chapter: "Pickup game",
    story:
      "{is} and {clan} brought their own lances. The map shows where the terrain goes. Read each special on the card out loud, then play the turn you already know.",
    goal,
    sides: {
      innerSphere: {
        unit: "Your lance",
        orders: goal,
        plan: [
          "Put each piece where the map numbers it.",
          "Deployment is the strip along your home edge.",
          "Formations, pilot cards, and battlefield support stay off.",
        ],
      },
      clan: {
        unit: "Your star",
        orders: goal,
        plan: [
          "Put each piece where the map numbers it.",
          "Deployment is the strip along your home edge.",
          "Formations, pilot cards, and battlefield support stay off.",
        ],
      },
    },
    ending: {
      innerSphere: "{is} holds the field.",
      clan: "{clan} holds the field.",
      draw: "Neither side holds the field.",
    },
    lesson:
      "This is the whole quick-start turn: initiative, move, the shot number, heat, rear, crits, punches, sprints, charges, and death from above. Read any special ability on the card out loud and use the card. Formations, pilot cards, and battlefield support stay off.",
    table: `Clear a space ${layout.width / 12} feet by ${layout.depth / 12} feet. Sit on the home edges shown on the map.`,
    rules: rules({
      realRange: true,
      tmm: true,
      standstill: true,
      realJump: true,
      partialCover: true,
      woods: true,
      terrainCost: true,
      heatScale: true,
      rear: true,
      crits: true,
      physical: true,
      charge: true,
      sprint: true,
      los: true,
      firingArc: true,
      beacon,
      specialsReminder: true,
    }),
    skill: 4,
    forces: { innerSphere: [], clan: [] },
    extraPieces: extraPieces(layout),
    terrain: stepsFor(layout),
    beaconGoal,
    objectives: layout.objectives.map((item) => ({ id: item.id, label: item.label, kind: item.kind })),
  }
}

export function stepsFor(layout: Layout): TerrainStep[] {
  const steps: TerrainStep[] = layout.pieces.map((piece) => {
    const who = piece.role === "guest" ? "guest" : "host"
    const x =
      who === "guest" ? Math.round(layout.width - (piece.x + piece.w)) : Math.round(piece.x)
    const y =
      who === "guest" ? Math.round(layout.depth - (piece.y + piece.h)) : Math.round(piece.y)
    return {
      who,
      piece: piece.number,
      say: `{name}, put the ${piece.label} (${piece.number}) ${x} inches in from your left edge and ${y} inches out from your home edge.`,
    }
  })
  for (const objective of layout.objectives) {
    if (objective.kind === "exit") {
      steps.push({
        who: "host",
        say: "{name}, a mech that leaves the table across the other home edge scores. The map marks both edges.",
      })
      continue
    }
    steps.push({
      who: "host",
      say: `{name}, put a token for ${objective.label} ${Math.round(objective.x)} inches from the left edge and ${Math.round(objective.y)} inches up from your home edge. Keep it out of the buildings.`,
    })
  }
  return steps
}

function extraPieces(layout: Layout): string[] {
  const counts = new Map<TerrainKind, number>()
  for (const piece of layout.pieces) counts.set(piece.kind, (counts.get(piece.kind) ?? 0) + 1)
  const lines: string[] = []
  for (const [kind, count] of counts) {
    const name = KIND_NAME[kind]
    lines.push(count === 1 ? `1 ${name}` : `${count} ${name}s`)
  }
  const tokens = layout.objectives.filter((item) => item.kind === "hold").length
  if (tokens === 1) lines.push("one punchboard token for the beacon")
  if (tokens > 1) lines.push(`${tokens} punchboard tokens for the beacons`)
  lines.push("both dice", "a tape measure", "the tables card from the box")
  return lines
}
