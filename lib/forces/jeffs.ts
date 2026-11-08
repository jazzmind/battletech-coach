import type { CardFace, DamageBox } from "../game/cards"
import { RuleError } from "../game/types"

export type SkippedUnit = { name: string; type: string }

export type ForceImport = {
  cards: CardFace[]
  skipped: SkippedUnit[]
}

const TYPE_NAME: Record<string, string> = {
  BM: "BattleMech",
  CV: "vehicle",
  CI: "infantry",
  BA: "battle armor",
  PM: "ProtoMech",
  AF: "fighter",
  CF: "fighter",
  SV: "support vehicle",
}

type MoveRow = { move?: number; type?: string }

export function importForce(raw: unknown): ForceImport {
  const units = unitsFrom(raw)
  if (units.length === 0) throw new RuleError("That file has no units.")
  const cards: CardFace[] = []
  const skipped: SkippedUnit[] = []
  const seen = new Map<string, number>()
  units.forEach((unit, index) => {
    const type = text(unit.type).toUpperCase()
    const name = text(unit.name) || text(unit.variant) || `Unit ${index + 1}`
    if (type !== "BM") {
      skipped.push({ name, type: TYPE_NAME[type] ?? (type || "other") })
      return
    }
    const card = cardFrom(unit, name, index)
    const count = (seen.get(card.id) ?? 0) + 1
    seen.set(card.id, count)
    if (count > 1) card.id = `${card.id}-${count}`
    cards.push(card)
  })
  return { cards, skipped }
}

export function sanitizeCard(raw: unknown, fallbackId: string): CardFace {
  if (!raw || typeof raw !== "object") throw new RuleError("That card is missing.")
  const card = raw as Partial<CardFace>
  const name = clean(card.name, "Mech")
  const id = safeId(card.id ?? "") || safeId(fallbackId)
  const jump = card.jump == null ? null : integer(card.jump, 0, 30, "Jump inches")
  return {
    id,
    name,
    side: clean(card.side, "card"),
    faction: card.faction === "clan" ? "clan" : "innerSphere",
    walk: integer(card.walk, 1, 30, "Walk inches"),
    jump: jump && jump > 0 ? jump : null,
    tmm: integer(card.tmm, 0, 5, "TMM"),
    size: integer(card.size, 1, 4, "Size"),
    armor: integer(card.armor, 0, 16, "Armor"),
    structure: integer(card.structure, 0, 12, "Structure"),
    ov: integer(card.ov, 0, 6, "Overheat"),
    short: band(card.short),
    medium: band(card.medium),
    long: band(card.long),
    specials: Array.isArray(card.specials) ? card.specials.map((item) => String(item).trim()).filter(Boolean) : [],
    pv: card.pv == null ? undefined : integer(card.pv, 0, 200, "PV"),
    skill: card.skill == null ? undefined : integer(card.skill, 0, 8, "Skill"),
    unitType: "BM",
    threshold: card.threshold == null ? undefined : integer(card.threshold, 0, 20, "Threshold"),
  }
}

function unitsFrom(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== "object") throw new RuleError("That file is not a force export.")
  const obj = raw as Record<string, unknown>
  if (obj.currentASForce && typeof obj.currentASForce === "object") return unitsFrom(obj.currentASForce)
  if (Array.isArray(obj.groups)) {
    return obj.groups.flatMap((group) => membersOf(group))
  }
  if (Array.isArray(obj.members)) return obj.members.filter(isRecord)
  throw new RuleError("That file has no units. Export the Alpha Strike force from Jeff's Tools or Terminal.")
}

function membersOf(group: unknown): Record<string, unknown>[] {
  if (!isRecord(group)) return []
  if (Array.isArray(group.members) && group.members.length > 0) return group.members.filter(isRecord)
  if (Array.isArray(group.units)) return group.units.filter(isRecord)
  return []
}

function cardFrom(unit: Record<string, unknown>, name: string, index: number): CardFace {
  const move = Array.isArray(unit.move) ? (unit.move as MoveRow[]) : []
  const ground = move.find((row) => row.type === "" || row.type === "g" || row.type === "w")
  const jumped = move.find((row) => row.type === "j")
  const walk = number(ground?.move) || number(move.find((row) => row.type !== "j")?.move) || number(move[0]?.move)
  const jumpInches = number(jumped?.move) || number(unit.jumpMove)
  const damage = isRecord(unit.damage) ? unit.damage : {}
  const best = Math.max(walk, jumpInches)
  const printed = number(unit.tmm)
  const id = safeId(text(unit.uuid)) || safeId(`mul-${text(unit.mulID)}`) || safeId(`${slug(name)}-${index + 1}`)
  const skill = number(unit.currentSkill)
  return {
    id,
    name: name.trim(),
    side: text(unit.variant).trim() || "card",
    faction: /clan/i.test(text(unit.role) + text(unit.classification)) ? "clan" : "innerSphere",
    walk: walk > 0 ? walk : 1,
    jump: jumpInches > 0 ? jumpInches : null,
    tmm: printed > 0 ? printed : tmmFromInches(best),
    size: clamp(number(unit.size) || 1, 1, 4),
    armor: clamp(number(unit.armor), 0, 20),
    structure: clamp(number(unit.structure), 0, 20),
    ov: clamp(number(unit.overheat), 0, 6),
    short: damageBand(damage.short, damage.shortMinimal),
    medium: damageBand(damage.medium, damage.mediumMinimal),
    long: damageBand(damage.long, damage.longMinimal),
    specials: abilities(unit.abilities),
    pv: number(unit.basePoints) || undefined,
    skill: skill > 0 ? skill : undefined,
    unitType: "BM",
    threshold: number(unit.threshold) || undefined,
  }
}

export function tmmFromInches(inches: number): number {
  if (inches <= 4) return 0
  if (inches <= 8) return 1
  if (inches <= 12) return 2
  if (inches <= 18) return 3
  if (inches <= 34) return 4
  return 5
}

function damageBand(value: unknown, minimal: unknown): DamageBox {
  if (minimal === true) return "star"
  return clamp(number(value), 0, 20)
}

function abilities(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean)
  return []
}

function band(value: unknown): DamageBox {
  if (value === "star") return "star"
  return integer(value, 0, 20, "Damage")
}

function integer(value: unknown, min: number, max: number, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new RuleError(`${label} should be ${min} to ${max}.`)
  }
  return parsed
}

function number(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function text(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : ""
}

function clean(value: unknown, fallback: string): string {
  const trimmed = text(value).trim().replace(/\s+/g, " ")
  return trimmed.slice(0, 40) || fallback
}

function safeId(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === "mul-" || trimmed === "mul-undefined") return ""
  return trimmed.slice(0, 80)
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mech"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}
