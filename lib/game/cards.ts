import type { Faction, RangeBand } from "./types"

/** A printed damage box. "star" is the 0* minimum-damage die. */
export type DamageBox = number | "star"

export type CardFace = {
  id: string
  name: string
  side: string
  faction: Faction
  walk: number
  jump: number | null
  tmm: number
  size: number
  armor: number
  structure: number
  ov: number
  short: DamageBox
  medium: DamageBox
  long: DamageBox
  specials: string[]
  pv?: number
  skill?: number
  unitType?: string
  threshold?: number
}

export type MiniPhoto = {
  painter: string
  page: string
}

export type Mini = {
  name: string
  faction: Faction
  photo?: MiniPhoto
  faces: CardFace[]
}

const face = (card: CardFace): CardFace => card

export const MINIS: Mini[] = [
  {
    name: "Wasp",
    faction: "innerSphere",
    photo: {
      painter: "PapaChicken",
      page: "https://thebaselair.com/projects/189754-wasp-wsp-1a",
    },
    faces: [
      face({
        id: "WSP-3W",
        name: "Wasp",
        side: "WSP-3W",
        faction: "innerSphere",
        walk: 12,
        jump: 12,
        tmm: 2,
        size: 1,
        armor: 1,
        structure: 2,
        ov: 0,
        short: 2,
        medium: 0,
        long: 0,
        specials: ["ENE"],
      }),
      face({
        id: "WSP-5A",
        name: "Wasp",
        side: "WSP-5A",
        faction: "innerSphere",
        walk: 16,
        jump: 16,
        tmm: 3,
        size: 1,
        armor: 2,
        structure: 1,
        ov: 0,
        short: 1,
        medium: 1,
        long: 0,
        specials: ["CASEII"],
      }),
    ],
  },
  {
    name: "Locust",
    faction: "innerSphere",
    faces: [
      face({
        id: "LCT-3M",
        name: "Locust",
        side: "LCT-3M",
        faction: "innerSphere",
        walk: 16,
        jump: null,
        tmm: 3,
        size: 1,
        armor: 2,
        structure: 2,
        ov: 0,
        short: 2,
        medium: 1,
        long: 0,
        specials: ["AMS", "CASE"],
      }),
      face({
        id: "LCT-7V",
        name: "Locust",
        side: "LCT-7V",
        faction: "innerSphere",
        walk: 20,
        jump: null,
        tmm: 4,
        size: 1,
        armor: 2,
        structure: 1,
        ov: 0,
        short: 2,
        medium: 2,
        long: 0,
        specials: [],
      }),
    ],
  },
  {
    name: "Blackjack",
    faction: "innerSphere",
    faces: [
      face({
        id: "BJ-3",
        name: "Blackjack",
        side: "BJ-3",
        faction: "innerSphere",
        walk: 8,
        jump: 8,
        tmm: 1,
        size: 2,
        armor: 5,
        structure: 4,
        ov: 1,
        short: 3,
        medium: 3,
        long: 2,
        specials: ["ENE"],
      }),
      face({
        id: "BJ-5",
        name: "Blackjack",
        side: "BJ-5",
        faction: "innerSphere",
        walk: 8,
        jump: 8,
        tmm: 1,
        size: 2,
        armor: 5,
        structure: 2,
        ov: 0,
        short: 2,
        medium: 3,
        long: 3,
        specials: ["CASEII"],
      }),
    ],
  },
  {
    name: "Phoenix Hawk",
    faction: "innerSphere",
    faces: [
      face({
        id: "PXH-3K",
        name: "Phoenix Hawk",
        side: "PXH-3K",
        faction: "innerSphere",
        walk: 12,
        jump: 12,
        tmm: 2,
        size: 2,
        armor: 5,
        structure: 2,
        ov: 0,
        short: 3,
        medium: 3,
        long: 2,
        specials: ["ENE"],
      }),
      face({
        id: "PXH-4M",
        name: "Phoenix Hawk",
        side: "PXH-4M",
        faction: "innerSphere",
        walk: 12,
        jump: 12,
        tmm: 2,
        size: 2,
        armor: 5,
        structure: 2,
        ov: 0,
        short: 3,
        medium: 3,
        long: 1,
        specials: ["ENE"],
      }),
    ],
  },
  {
    name: "Wraith",
    faction: "innerSphere",
    faces: [
      face({
        id: "TR1",
        name: "Wraith",
        side: "TR1",
        faction: "innerSphere",
        walk: 14,
        jump: 14,
        tmm: 3,
        size: 2,
        armor: 5,
        structure: 3,
        ov: 0,
        short: 3,
        medium: 3,
        long: 0,
        specials: ["ENE"],
      }),
      face({
        id: "TR5",
        name: "Wraith",
        side: "TR5",
        faction: "innerSphere",
        walk: 16,
        jump: 14,
        tmm: 3,
        size: 2,
        armor: 5,
        structure: 3,
        ov: 0,
        short: 3,
        medium: 3,
        long: 0,
        specials: ["ENE"],
      }),
    ],
  },
  {
    name: "Archer",
    faction: "innerSphere",
    faces: [
      face({
        id: "ARC-5R",
        name: "Archer",
        side: "ARC-5R",
        faction: "innerSphere",
        walk: 8,
        jump: null,
        tmm: 1,
        size: 3,
        armor: 6,
        structure: 6,
        ov: 1,
        short: 3,
        medium: 3,
        long: 3,
        specials: ["CASE", "IF 1", "OVL"],
      }),
      face({
        id: "ARC-7C",
        name: "Archer",
        side: "ARC-7C",
        faction: "innerSphere",
        walk: 10,
        jump: null,
        tmm: 2,
        size: 3,
        armor: 7,
        structure: 3,
        ov: 0,
        short: 5,
        medium: 5,
        long: 4,
        specials: ["CASEII", "IF 2", "REAR 2/2/-"],
      }),
    ],
  },
  {
    name: "Warhammer",
    faction: "innerSphere",
    faces: [
      face({
        id: "WHM-6R",
        name: "Warhammer",
        side: "6R",
        faction: "innerSphere",
        walk: 8,
        jump: null,
        tmm: 1,
        size: 3,
        armor: 5,
        structure: 6,
        ov: 1,
        short: 3,
        medium: 3,
        long: 2,
        specials: [],
      }),
      face({
        id: "WHM-8R",
        name: "Warhammer",
        side: "8R",
        faction: "innerSphere",
        walk: 8,
        jump: null,
        tmm: 1,
        size: 3,
        armor: 7,
        structure: 6,
        ov: 1,
        short: 4,
        medium: 4,
        long: 2,
        specials: ["CASEII"],
      }),
    ],
  },
  {
    name: "Atlas",
    faction: "innerSphere",
    faces: [
      face({
        id: "AS7-S",
        name: "Atlas",
        side: "AS7-S",
        faction: "innerSphere",
        walk: 6,
        jump: null,
        tmm: 1,
        size: 4,
        armor: 10,
        structure: 8,
        ov: 0,
        short: 5,
        medium: 5,
        long: 2,
        specials: ["AC 2/2/-", "IF 1", "LRM 1/1/1", "REAR 2/2/-"],
      }),
      face({
        id: "AS7-S4",
        name: "Atlas",
        side: "AS7-S4",
        faction: "innerSphere",
        walk: 6,
        jump: null,
        tmm: 1,
        size: 4,
        armor: 10,
        structure: 8,
        ov: 1,
        short: 4,
        medium: 4,
        long: 4,
        specials: ["CASEII", "ECM", "STL"],
      }),
    ],
  },
  {
    name: "Fire Moth",
    faction: "clan",
    faces: [
      face({
        id: "FM-D",
        name: "Fire Moth",
        side: "D",
        faction: "clan",
        walk: 26,
        jump: null,
        tmm: 4,
        size: 1,
        armor: 1,
        structure: 1,
        ov: 1,
        short: 4,
        medium: 3,
        long: 0,
        specials: ["ENE", "OMNI"],
      }),
      face({
        id: "FM-G",
        name: "Fire Moth",
        side: "G",
        faction: "clan",
        walk: 30,
        jump: null,
        tmm: 4,
        size: 1,
        armor: 1,
        structure: 1,
        ov: 1,
        short: 4,
        medium: 4,
        long: 0,
        specials: ["CASE", "OMNI"],
      }),
    ],
  },
  {
    name: "Pouncer",
    faction: "clan",
    faces: [
      face({
        id: "POU-Prime",
        name: "Pouncer",
        side: "Prime",
        faction: "clan",
        walk: 12,
        jump: 10,
        tmm: 2,
        size: 2,
        armor: 4,
        structure: 2,
        ov: 1,
        short: 3,
        medium: 3,
        long: 3,
        specials: ["ENE", "OMNI", "OVL"],
      }),
      face({
        id: "POU-T",
        name: "Pouncer",
        side: "T",
        faction: "clan",
        walk: 12,
        jump: 10,
        tmm: 2,
        size: 2,
        armor: 4,
        structure: 2,
        ov: 0,
        short: 3,
        medium: 3,
        long: 0,
        specials: ["ENE", "HT 1/1/-", "OMNI"],
      }),
    ],
  },
  {
    name: "Nova",
    faction: "clan",
    faces: [
      face({
        id: "NOV-Prime",
        name: "Nova",
        side: "Prime",
        faction: "clan",
        walk: 10,
        jump: 10,
        tmm: 2,
        size: 2,
        armor: 5,
        structure: 3,
        ov: 4,
        short: 5,
        medium: 5,
        long: 0,
        specials: ["ENE", "OMNI"],
      }),
      face({
        id: "NOV-T",
        name: "Nova",
        side: "T",
        faction: "clan",
        walk: 10,
        jump: 10,
        tmm: 2,
        size: 2,
        armor: 5,
        structure: 3,
        ov: 0,
        short: 6,
        medium: 6,
        long: 0,
        specials: ["CASE", "OMNI"],
      }),
    ],
  },
  {
    name: "Timber Wolf",
    faction: "clan",
    photo: {
      painter: "SledgeLP",
      page: "https://thebaselair.com/projects/510976-ghost-bear-dominion-xi-galaxy-timberwolf-t-configuration",
    },
    faces: [
      face({
        id: "TW-Prime",
        name: "Timber Wolf",
        side: "Prime",
        faction: "clan",
        walk: 10,
        jump: null,
        tmm: 2,
        size: 3,
        armor: 8,
        structure: 4,
        ov: 1,
        short: 5,
        medium: 5,
        long: 4,
        specials: ["CASE", "IF 2", "LRM 1/1/2", "OMNI"],
      }),
      face({
        id: "TW-T",
        name: "Timber Wolf",
        side: "T",
        faction: "clan",
        walk: 10,
        jump: null,
        tmm: 2,
        size: 3,
        armor: 8,
        structure: 4,
        ov: 2,
        short: 7,
        medium: 7,
        long: 4,
        specials: ["CASE", "IF 2", "OMNI"],
      }),
    ],
  },
  {
    name: "Warhawk",
    faction: "clan",
    faces: [
      face({
        id: "WHK-C",
        name: "Warhawk",
        side: "C",
        faction: "clan",
        walk: 8,
        jump: null,
        tmm: 1,
        size: 4,
        armor: 9,
        structure: 5,
        ov: 0,
        short: 6,
        medium: 6,
        long: 6,
        specials: ["ENE", "OMNI"],
      }),
      face({
        id: "WHK-T",
        name: "Warhawk",
        side: "T",
        faction: "clan",
        walk: 8,
        jump: null,
        tmm: 1,
        size: 4,
        armor: 9,
        structure: 5,
        ov: 1,
        short: 5,
        medium: 5,
        long: 4,
        specials: ["ENE", "HT 1/1/-", "OMNI"],
      }),
    ],
  },
]

const byId = new Map(MINIS.flatMap((mini) => mini.faces.map((card) => [card.id, card])))
const byName = new Map(MINIS.map((mini) => [mini.name, mini]))

export function mustFace(id: string): CardFace {
  const card = byId.get(id)
  if (!card) throw new Error(`Unknown card ${id}`)
  return card
}

export function miniByName(name: string): Mini | undefined {
  return byName.get(name)
}

export function defaultFace(name: string): CardFace {
  const mini = byName.get(name)
  if (!mini) throw new Error(`Unknown mini ${name}`)
  return mini.faces[0]
}

export function boxAt(card: CardFace, range: RangeBand): DamageBox {
  if (range === "short") return card.short
  if (range === "medium") return card.medium
  return card.long
}

export function boxCards(): Record<string, CardFace> {
  const cards: Record<string, CardFace> = {}
  for (const mini of MINIS) {
    for (const card of mini.faces) cards[card.id] = card
  }
  return cards
}

export function cardOf(cards: Record<string, CardFace> | undefined, variant: string): CardFace {
  const stored = cards?.[variant]
  if (stored) return stored
  return mustFace(variant)
}
