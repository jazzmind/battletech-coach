export type Faction = "innerSphere" | "clan"

export type MoveMode = "stand" | "walk" | "jump" | "sprint" | "charge" | "dfa"

export type RangeBand = "short" | "medium" | "long"

export type CritEffect =
  | "none"
  | "weapon"
  | "fireControl"
  | "mp"
  | "engine"
  | "ammo"
  | "destroyed"

export type Phase =
  | "lobby"
  | "roster"
  | "gather"
  | "place"
  | "cards"
  | "initiative"
  | "move"
  | "combat"
  | "end"
  | "over"

export type Group = "teaching" | "real" | "graduation"

export type CardField =
  | "walk"
  | "skill"
  | "armor"
  | "structure"
  | "tmm"
  | "ov"
  | "size"
  | "jump"
  | "jumpInches"

export type Rules = {
  teachingRange: boolean
  teachingCover: boolean
  teachingJump: boolean
  teachingHeat: boolean
  realRange: boolean
  tmm: boolean
  standstill: boolean
  realJump: boolean
  partialCover: boolean
  woods: boolean
  terrainCost: boolean
  heatScale: boolean
  rear: boolean
  crits: boolean
  physical: boolean
  charge: boolean
  sprint: boolean
  los: boolean
  firingArc: boolean
  beacon: boolean
  specialsReminder: boolean
  retreat: boolean
}

export type Player = {
  id: string
  name: string
  faction: Faction
  ready: boolean
  beaconPoints: number
}

export type Declaration = {
  kind: "charge" | "dfa"
  targetId: string
}

export type Mech = {
  id: string
  name: string
  ownerId: string
  knockedOut: boolean
  walkInches?: number
  skill?: number
  armor?: number
  structure?: number
  armorLeft?: number
  structureLeft?: number
  tmm?: number
  size?: number
  ov?: number
  hasJump?: boolean
  jumpInches?: number
  heat: number
  hot: boolean
  shutdown: boolean
  fireControlHits: number
  weaponHits: number
  engineHits: number
  mpHits: number
  moveMode?: MoveMode
  touchingCover: boolean
  inWater: boolean
  shotThisTurn: boolean
  overheatUsed: number
  woke?: boolean
  declaration?: Declaration
}

export type AttackKind = "weapon" | "physical" | "melee" | "charge" | "dfa"

export type CombatState = {
  attackerId: string
  kind?: AttackKind
  targetId?: string
  range?: RangeBand
  overheat: number
  dice?: number
  lines: { label: string; amount: number }[]
  targetNumber?: number
  rear: boolean
  cardDamage?: number
  totalDamage?: number
  armorMarked?: number
  structureMarked?: number
  selfDamage?: number
  selfDone?: boolean
  critDone: boolean
  critFor?: "target" | "self"
  forceCrit?: boolean
  partial: boolean
  woods: boolean
  askedPartial: boolean
  askedWoods: boolean
  tweak: number
}

export type GameState = {
  version: number
  code: string
  scenarioId: string
  players: Player[]
  mechs: Mech[]
  phase: Phase
  step: string
  confirmations: string[]
  placeIndex: number
  initiative: Record<string, number>
  lowPlayerId?: string
  highPlayerId?: string
  turn: number
  moveOrder: string[]
  activeMechId?: string
  combatIndex: number
  combat?: CombatState
  beaconAnswers: Record<string, boolean>
  notice?: string
  winnerId?: string
  winReason?: string
  past?: GameState
  lastActorId?: string
}

export type Action =
  | { type: "join"; playerId: string; name: string }
  | { type: "swap"; playerId: string; mechId: string; name: string }
  | { type: "ready"; playerId: string }
  | { type: "confirm"; playerId: string }
  | { type: "continue"; playerId: string }
  | { type: "undo"; playerId: string }
  | { type: "card"; playerId: string; field: CardField; value: number | boolean }
  | { type: "initiative"; playerId: string; roll: number }
  | { type: "pickMech"; playerId: string; mechId: string }
  | { type: "moveMode"; playerId: string; mode: MoveMode }
  | { type: "jumpInches"; playerId: string; inches: number }
  | { type: "chargeTarget"; playerId: string; targetId: string }
  | { type: "reach"; playerId: string; yes: boolean }
  | { type: "terrain"; playerId: string; ok: boolean }
  | { type: "water"; playerId: string; inWater: boolean }
  | { type: "cover"; playerId: string; touching: boolean }
  | { type: "kind"; playerId: string; kind: "weapon" | "physical" | "melee" | "hold" }
  | { type: "target"; playerId: string; targetId: string }
  | { type: "yesNo"; playerId: string; field: "los" | "arc" | "contact" | "partial" | "woods" | "rear"; yes: boolean }
  | { type: "range"; playerId: string; range: RangeBand | "tooFar" | "dash" }
  | { type: "overheat"; playerId: string; amount: number }
  | { type: "tweak"; playerId: string; delta: number }
  | { type: "dice"; playerId: string; roll: number }
  | { type: "band"; playerId: string; amount: number }
  | { type: "marked"; playerId: string; result: "armor" | "structure" | "out" }
  | { type: "crit"; playerId: string; effect: CritEffect }
  | { type: "ammo"; playerId: string; result: "destroyed" | "case" | "safe" }
  | { type: "beacon"; playerId: string; alone: boolean }

export type Choice = {
  id: string
  label: string
  hint?: string
  action: Action
}

export type Screen = {
  code: string
  version: number
  kicker: string
  title: string
  say: string
  note?: string
  lesson?: string
  active: boolean
  wait?: string
  choices: Choice[]
  pad?: {
    kind: "card" | "initiative" | "jump" | "dice" | "band" | "overheat"
    min: number
    max: number
    label: string
    field?: CardField
  }
  roster?: {
    mechId: string
    name: string
    owner: string
    options: { name: string; action: Action }[]
  }[]
  hud: {
    scenario: string
    turn: string
    rows: { name: string; detail: string; mine: boolean; out: boolean }[]
  }
  over?: { winner: string; reason: string }
  undo?: Action
}

export class RuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RuleError"
  }
}
