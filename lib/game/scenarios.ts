import type { Faction, Group, Rules } from "./types"

export const INNER_SPHERE = [
  "Wasp",
  "Wraith",
  "Locust",
  "Archer",
  "Blackjack",
  "Warhammer",
  "Phoenix Hawk",
  "Atlas",
] as const

export const CLAN = ["Fire Moth", "Timber Wolf", "Pouncer", "Warhawk", "Nova"] as const

export function rosterFor(faction: Faction): readonly string[] {
  return faction === "innerSphere" ? INNER_SPHERE : CLAN
}

export function factionLabel(faction: Faction): string {
  return faction === "innerSphere" ? "Inner Sphere" : "Clan"
}

const RULE_KEYS: (keyof Rules)[] = [
  "teachingRange",
  "teachingCover",
  "teachingJump",
  "teachingHeat",
  "realRange",
  "tmm",
  "standstill",
  "realJump",
  "partialCover",
  "woods",
  "terrainCost",
  "heatScale",
  "rear",
  "crits",
  "physical",
  "charge",
  "sprint",
  "los",
  "firingArc",
  "beacon",
  "specialsReminder",
  "retreat",
]

export function rules(partial: Partial<Rules>): Rules {
  const base = Object.fromEntries(RULE_KEYS.map((key) => [key, false])) as Rules
  return { ...base, ...partial }
}

export type TerrainStep = { who: "host" | "guest"; say: string }

export type Scenario = {
  id: string
  group: Group
  title: string
  summary: string
  lesson: string
  table: string
  rules: Rules
  forces: Record<Faction, string[]>
  extraPieces: string[]
  terrain: TerrainStep[]
  beaconGoal: number
}

const named = (who: "host" | "guest", say: string): TerrainStep => ({ who, say })

export const SCENARIOS: Scenario[] = [
  {
    id: "first-steps",
    group: "teaching",
    title: "First Steps",
    summary: "One mech each. Two turns, then both pull back.",
    lesson:
      "Use the Warhammer side labeled 8R and the Timber Wolf side labeled Prime. The other sides are not an even match. The skill spot is blank, so both pilots are regular and the dice need 4. Count the armor bubbles and the red structure bubbles once. The coach keeps that count. Mark the same bubbles on the card. After two turns, both pilots pull back. Nobody loses.",
    table: "Clear a square about 3 feet on each side. The edges you sit on are the home edges.",
    rules: rules({ teachingRange: true, retreat: true }),
    forces: { innerSphere: ["Warhammer"], clan: ["Timber Wolf"] },
    extraPieces: ["both dice", "a tape measure"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "streets",
    group: "teaching",
    title: "Streets and Trees",
    summary: "Two mechs each. Buildings, trees, jumps, and cover.",
    lesson:
      "New choices: if the card has a jump move, you may jump. A mech that jumped is one harder to hit. A mech touching a building or standing in trees is one harder to hit. This is the teaching version of cover, not the full table.",
    table: "Clear a space about 3 feet by 4 feet. Sit on the long edges.",
    rules: rules({ teachingRange: true, teachingCover: true, teachingJump: true }),
    forces: {
      innerSphere: ["Wasp", "Warhammer"],
      clan: ["Fire Moth", "Timber Wolf"],
    },
    extraPieces: [
      "2 large buildings",
      "4 small buildings",
      "6 trees",
      "both dice",
      "a tape measure",
    ],
    terrain: [
      named("host", "{name}, take one large building and put it in the middle of the table. Not on a home edge."),
      named("guest", "{name}, take the other large building and put it in the middle too, a hand's width from the first."),
      named("host", "{name}, take two small buildings and put them on your half of the table."),
      named("guest", "{name}, take two small buildings and put them on your half."),
      named("host", "{name}, take three trees and put them on your half. Do not pile them on the buildings."),
      named("guest", "{name}, take three trees and put them on your half."),
    ],
    beaconGoal: 2,
  },
  {
    id: "beacon",
    group: "teaching",
    title: "Grab the Beacon",
    summary: "Hold the center token. Shooting makes you hot.",
    lesson:
      "Teaching heat: a mech that shoots is Hot next turn, and its shot needs one more. If it does not shoot, it cools off. A mech alone on the beacon at the end of the turn scores 1. First to 2, or the last side standing.",
    table: "Clear a space about 3 feet by 4 feet. Sit on the long edges.",
    rules: rules({
      teachingRange: true,
      teachingCover: true,
      teachingJump: true,
      teachingHeat: true,
      beacon: true,
    }),
    forces: {
      innerSphere: ["Phoenix Hawk", "Wasp"],
      clan: ["Pouncer", "Fire Moth"],
    },
    extraPieces: [
      "2 large buildings",
      "2 small buildings",
      "4 trees",
      "one punchboard token for the beacon",
      "both dice",
      "a tape measure",
    ],
    terrain: [
      named("host", "{name}, take one large building and put it in the middle, not on a home edge."),
      named("guest", "{name}, take the other large building and put it in the middle, a hand's width from the first."),
      named("host", "{name}, take one small building and put it on your half."),
      named("guest", "{name}, take one small building and put it on your half."),
      named("host", "{name}, take two trees and put them on your half."),
      named("guest", "{name}, take two trees and put them on your half."),
      named("host", "{name}, put one punchboard token in the exact center. That is the beacon."),
    ],
    beaconGoal: 2,
  },
  {
    id: "how-far",
    group: "real",
    title: "How Far",
    summary: "The real range bands: short, medium, and long.",
    lesson:
      "From here on, the number to beat uses the real range bands. Short, up to 6 inches, adds nothing. Medium, past 6 and up to 24, adds 2. Long, past 24 and up to 42, adds 4. Past 42 is too far. Damage still comes from that box on the card.",
    table: "Clear a square about 4 feet on each side, so a long shot can exist. Sit on opposite edges.",
    rules: rules({ realRange: true }),
    forces: { innerSphere: ["Atlas"], clan: ["Warhawk"] },
    extraPieces: ["both dice", "a tape measure"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "they-moved",
    group: "real",
    title: "They Moved",
    summary: "Add the card's TMM. Standing still is easier.",
    lesson:
      "TMM is the target movement modifier on the card. A mech that walked or sprinted adds its TMM to the number you need. A mech that moved less than 1 inch stood still: its TMM is 0, and its own shot is one easier.",
    table: "Clear a space about 3 feet by 4 feet. Sit on the long edges.",
    rules: rules({ realRange: true, tmm: true, standstill: true }),
    forces: { innerSphere: ["Wasp"], clan: ["Fire Moth"] },
    extraPieces: ["both dice", "a tape measure"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "jump-jets",
    group: "real",
    title: "Jump Jets",
    summary: "Jumping ignores terrain and changes the shot.",
    lesson:
      "A jump move is the inches next to the j on the card. Jumping ignores trees and buildings. It cannot jump out of water. A mech that jumped adds 2 to its own shot, and 1 on top of its TMM when someone shoots it.",
    table: "Clear a space about 3 feet by 4 feet. Sit on the long edges.",
    rules: rules({ realRange: true, tmm: true, standstill: true, realJump: true }),
    forces: { innerSphere: ["Phoenix Hawk"], clan: ["Pouncer"] },
    extraPieces: ["both dice", "a tape measure"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "trees-and-walls",
    group: "real",
    title: "Trees and Walls",
    summary: "Movement cost, woods, and partial cover.",
    lesson:
      "Clear ground costs 1 inch of move per inch you travel. Trees cost 2. A climb costs extra, and a step up steeper than 2 inches is not allowed. Jumping skips those costs. If two-thirds of the target is hidden by a building, a hill, or water, the shot is one harder. Trees in the way, or a target standing in trees, are also one harder. Trees do not count as that hiding cover.",
    table: "Clear a space about 3 feet by 4 feet. Sit on the long edges.",
    rules: rules({
      realRange: true,
      tmm: true,
      standstill: true,
      realJump: true,
      partialCover: true,
      woods: true,
      terrainCost: true,
    }),
    forces: { innerSphere: ["Warhammer"], clan: ["Timber Wolf"] },
    extraPieces: ["2 large buildings", "4 trees", "both dice", "a tape measure"],
    terrain: [
      named("host", "{name}, take one large building and put it in the middle of the table."),
      named("guest", "{name}, take the other large building and put it in the middle, a hand's width from the first."),
      named("host", "{name}, take two trees and put them on your half."),
      named("guest", "{name}, take two trees and put them on your half."),
    ],
    beaconGoal: 2,
  },
  {
    id: "heat-scale",
    group: "real",
    title: "The Heat Scale",
    summary: "Overheat adds damage now and heat at the end.",
    lesson:
      "The OV on the card is how much extra damage you may add at short or medium range. You choose it before you roll. At the end of the turn, mark that much heat. Your heat is added to your next weapon shot. Twice your heat comes off your walk inches. At heat 2 or more, TMM drops by 1 unless you jump. Heat 4 shuts the mech down for a turn. If you do not shoot, erase the heat. Water cools one heat if you did shoot.",
    table: "Clear a square about 3 feet on each side. No buildings. Sit on opposite edges.",
    rules: rules({ realRange: true, tmm: true, standstill: true, heatScale: true }),
    forces: { innerSphere: ["Warhammer"], clan: ["Nova"] },
    extraPieces: ["both dice", "a tape measure"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "breaks",
    group: "real",
    title: "Bubbles and Breaks",
    summary: "Rear hits and the critical hit table.",
    lesson:
      "A hit in the back of the base marks one extra bubble. Armor bubbles go first, then red structure bubbles. If structure is marked and the mech is still standing, roll two dice and read the critical hit table on the tables card in the box. A roll of 12 does that even if only armor was marked. The mech comes off the table when the last structure bubble is marked.",
    table: "Clear a square about 3 feet on each side. Keep the tables card next to the dice.",
    rules: rules({ realRange: true, tmm: true, standstill: true, rear: true, crits: true }),
    forces: { innerSphere: ["Atlas"], clan: ["Warhawk"] },
    extraPieces: ["both dice", "a tape measure", "the tables card from the box"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "up-close",
    group: "real",
    title: "Up Close",
    summary: "You punch when the bases are touching. You do not shoot.",
    lesson:
      "If the bases are touching, you cannot shoot that mech. A punch reaches 1 inch, hits on the skill number plus the usual movement and cover modifiers, and marks bubbles equal to the mech's size. If the card says MEL, that melee reach is 2 inches and the damage is size plus 1. You cannot punch and shoot in the same turn.",
    table: "Clear a square about 3 feet on each side so the mechs can reach each other.",
    rules: rules({
      realRange: true,
      tmm: true,
      standstill: true,
      realJump: true,
      physical: true,
    }),
    forces: { innerSphere: ["Wraith"], clan: ["Nova"] },
    extraPieces: ["both dice", "a tape measure"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "the-whole-turn",
    group: "graduation",
    title: "The Whole Turn",
    summary: "Every quick-start step, plus a beacon.",
    lesson:
      "This is the whole quick-start turn from the box: initiative, move, the shot number, heat, rear, crits, punches, sprints, charges, and death from above. Sprint is one and a half times the walk inches, rounded up, and that mech cannot shoot. A charge is declared while moving, only at a mech that already moved, and you must end touching it. Read any special ability on the card out loud and use the card. The tables card still decides crits. Formations, pilot cards, and battlefield support stay in the box for another day.",
    table: "Clear a space about 3 feet by 4 feet. Sit on the long edges. Keep the tables card out.",
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
      beacon: true,
      specialsReminder: true,
    }),
    forces: {
      innerSphere: ["Warhammer", "Phoenix Hawk"],
      clan: ["Timber Wolf", "Pouncer"],
    },
    extraPieces: [
      "2 large buildings",
      "4 small buildings",
      "6 trees",
      "one punchboard token for the beacon",
      "both dice",
      "a tape measure",
      "the tables card from the box",
    ],
    terrain: [
      named("host", "{name}, take one large building and put it in the middle."),
      named("guest", "{name}, take the other large building and put it in the middle, a hand's width away."),
      named("host", "{name}, take two small buildings and put them on your half."),
      named("guest", "{name}, take two small buildings and put them on your half."),
      named("host", "{name}, take three trees and put them on your half."),
      named("guest", "{name}, take three trees and put them on your half."),
      named("host", "{name}, put one punchboard token in the exact center. That is the beacon."),
    ],
    beaconGoal: 2,
  },
]

const byId = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]))

export function getScenario(id: string): Scenario | undefined {
  return byId.get(id)
}

export function mustScenario(id: string): Scenario {
  const scenario = byId.get(id)
  if (!scenario) throw new Error(`Unknown scenario ${id}`)
  return scenario
}

export const GROUP_LABEL: Record<Group, string> = {
  teaching: "Start here",
  real: "Real rules, one at a time",
  graduation: "The whole turn",
}
