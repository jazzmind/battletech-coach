import { boxAt, cardOf } from "./cards"
import { adjustedMove, attackPreview, availableModes } from "./math"
import { scenarioOf } from "./scenarios"
import type { Action, GameState, Mech, MoveMode, RangeBand } from "./types"
import type { Layout } from "../scenario-gen/layout"

type Point = { x: number; y: number }

export function rollTotal(faces = 6, count = 2): number {
  let total = 0
  for (let die = 0; die < count; die += 1) total += 1 + Math.floor(Math.random() * faces)
  return total
}

export function soloLayout(code: string, beacon: boolean): Layout {
  return {
    width: 48,
    depth: 36,
    zoneDepth: 6,
    seed: code,
    pieces: [],
    objectives: beacon ? [{ id: "beacon", label: "Beacon", kind: "hold", x: 24, y: 18 }] : [],
  }
}

export function planMove(state: GameState, mech: Mech, locked?: MoveMode): { mode: MoveMode; x: number; y: number } {
  const rules = scenarioOf(state).rules
  const origin = spot(mech)
  const enemiesMoved = state.mechs.some(
    (other) => other.ownerId !== mech.ownerId && !other.knockedOut && state.moveOrder.includes(other.id),
  )
  const opened = locked ? [locked] : availableModes(mech, rules, enemiesMoved)
  const modes = opened.filter((mode) => mode !== "charge" && mode !== "dfa")
  if (modes.length === 0) modes.push("walk")
  const thin = (mech.armor ?? 0) + (mech.structure ?? 0) <= 2
  let best = { mode: modes[0] ?? "walk", x: origin.x, y: origin.y, score: -Infinity }
  for (const mode of modes) {
    for (const point of pointsFor(state, mech, mode, origin)) {
      const score = scorePoint(state, mech, mode, origin, point, thin)
      if (score > best.score) best = { mode, x: point.x, y: point.y, score }
    }
  }
  return { mode: best.mode, x: roundInch(best.x), y: roundInch(best.y) }
}

export function prepareCoach(state: GameState): Action | "hold" | "idle" {
  if (!state.solo || !state.coachId) return "idle"
  const coachId = state.coachId
  if (state.phase === "over") return "hold"
  if (state.phase === "initiative") {
    if (state.initiative[coachId] == null) {
      return { type: "initiative", playerId: coachId, roll: rollTotal() }
    }
    return "hold"
  }
  if (state.phase === "end" && state.step === "beacon" && state.beaconAnswers[coachId] == null) {
    return { type: "beacon", playerId: coachId, alone: coachHolds(state) }
  }
  if (state.phase !== "move" && state.phase !== "combat") return "hold"

  const mech = state.mechs.find((item) => item.id === state.activeMechId)
  if (!mech || mech.ownerId !== coachId) return "hold"
  if (state.step === "placed") {
    if (!mech.order) {
      const plan = planMove(state, mech, mech.moveMode)
      mech.order = { x: plan.x, y: plan.y }
      mech.facing = facingBetween(spot(mech), mech.order)
    }
    return "hold"
  }
  if (isHumanMark(state.step)) return "hold"
  if (state.step === "pass") return { type: "continue", playerId: coachId }
  if (state.step === "pick") {
    const mechId = pickMech(state, coachId)
    if (!mechId) return "hold"
    return { type: "pickMech", playerId: coachId, mechId }
  }
  if (state.step === "mode") {
    const plan = planMove(state, mech)
    return { type: "moveMode", playerId: coachId, mode: plan.mode }
  }
  if (state.step === "jump") {
    return { type: "jumpInches", playerId: coachId, inches: mech.jumpInches ?? cardOf(state.cards, mech.variant).jump ?? 1 }
  }
  if (state.step === "charge" || state.step === "reach") return "hold"
  if (state.step === "terrain") return { type: "terrain", playerId: coachId, ok: true }
  if (state.step === "water") return { type: "water", playerId: coachId, inWater: inKind(state, aim(mech), "water") }
  if (state.step === "cover") return { type: "cover", playerId: coachId, touching: besideCover(state, aim(mech)) }
  if (state.phase === "combat") return combatAction(state, mech, coachId)
  return "hold"
}

function combatAction(state: GameState, mech: Mech, coachId: string): Action | "hold" {
  const shot = bestShot(state, mech)
  if (state.step === "kind") {
    return { type: "kind", playerId: coachId, kind: shot ? "weapon" : "hold" }
  }
  if (state.step === "target") {
    if (!shot) return { type: "kind", playerId: coachId, kind: "hold" }
    mech.facing = facingBetween(spot(mech), spot(shot))
    return { type: "target", playerId: coachId, targetId: shot.id }
  }
  if (
    state.step === "los" ||
    state.step === "arc" ||
    state.step === "contact" ||
    state.step === "partial" ||
    state.step === "woods" ||
    state.step === "rear"
  ) {
    return { type: "yesNo", playerId: coachId, field: state.step, yes: answerYes(state, mech, state.step) }
  }
  if (state.step === "range") {
    const target = targetOf(state)
    const range = target ? bandOf(distance(spot(mech), spot(target)), scenarioOf(state).rules.realRange) : "tooFar"
    return { type: "range", playerId: coachId, range }
  }
  if (state.step === "overheat") return { type: "overheat", playerId: coachId, amount: 0 }
  if (state.step === "roll") return { type: "dice", playerId: coachId, roll: rollTotal() }
  if (state.step === "star") return { type: "star", playerId: coachId, roll: rollTotal(6, 1) }
  if (state.step === "band") {
    const range = state.combat?.range ?? "short"
    const box = boxAt(cardOf(state.cards, mech.variant), range)
    return { type: "band", playerId: coachId, amount: box === "star" ? 0 : box }
  }
  return "hold"
}

function isHumanMark(step: string): boolean {
  return step === "miss" || step === "bubbles" || step === "crit" || step === "ammo" || step === "ammoMark" || step === "self"
}

function pickMech(state: GameState, coachId: string): string {
  const left = state.mechs.filter(
    (mech) => mech.ownerId === coachId && !mech.knockedOut && !state.moveOrder.includes(mech.id) && !mech.shutdown,
  )
  const beacon = state.layout?.objectives.find((item) => item.kind === "hold")
  const ranked = [...left].sort((a, b) => {
    if (!beacon) return 0
    return distance(spot(a), beacon) - distance(spot(b), beacon)
  })
  return ranked[0]?.id ?? left[0]?.id ?? ""
}

function bestShot(state: GameState, mech: Mech): Mech | null {
  const rules = scenarioOf(state).rules
  const card = cardOf(state.cards, mech.variant)
  let best: { mech: Mech; damage: number; need: number } | null = null
  for (const enemy of state.mechs) {
    if (enemy.ownerId === mech.ownerId || enemy.knockedOut || enemy.x == null || enemy.y == null) continue
    const gap = distance(spot(mech), spot(enemy))
    if (gap <= 2) continue
    if (lineBlocked(state, spot(mech), spot(enemy))) continue
    const range = bandOf(gap, rules.realRange)
    if (range === "tooFar") continue
    const box = boxAt(card, range)
    const damage = box === "star" ? 1 : box
    if (damage <= 0) continue
    const preview = attackPreview({
      attacker: mech,
      target: enemy,
      rules,
      kind: "weapon",
      range,
      partial: enemy.touchingCover,
      woods: inKind(state, spot(enemy), "woods"),
      tweak: 0,
    })
    if (!best || damage > best.damage || (damage === best.damage && preview.total < best.need)) {
      best = { mech: enemy, damage, need: preview.total }
    }
  }
  return best?.mech ?? null
}

function answerYes(state: GameState, mech: Mech, field: "los" | "arc" | "contact" | "partial" | "woods" | "rear"): boolean {
  const target = targetOf(state)
  if (!target) return false
  if (field === "los") return !lineBlocked(state, spot(mech), spot(target))
  if (field === "arc") return true
  if (field === "contact") return distance(spot(mech), spot(target)) <= 2
  if (field === "partial") return target.touchingCover || besideCover(state, spot(target))
  if (field === "woods") return inKind(state, spot(target), "woods") || inKind(state, spot(target), "tree")
  return false
}

function coachHolds(state: GameState): boolean {
  const coachId = state.coachId
  const beacon = state.layout?.objectives.find((item) => item.kind === "hold")
  if (!coachId || !beacon) return false
  const near = (owner: "coach" | "human") =>
    state.mechs.some((mech) => {
      const mine = owner === "coach" ? mech.ownerId === coachId : mech.ownerId !== coachId
      return mine && !mech.knockedOut && mech.x != null && distance(spot(mech), beacon) <= 2
    })
  return near("coach") && !near("human")
}

function pointsFor(state: GameState, mech: Mech, mode: MoveMode, origin: Point): Point[] {
  const layout = state.layout
  const budget = moveBudget(mech, mode)
  if (!layout || budget <= 0 || mode === "stand") return [origin]
  const jump = mode === "jump" || mode === "dfa"
  const points: Point[] = []
  for (let y = 1; y < layout.depth; y += 2) {
    for (let x = 1; x < layout.width; x += 2) {
      const point = { x, y }
      if (distance(origin, point) > budget + 0.01) continue
      if (!jump && lineBlocked(state, origin, point)) continue
      if (insideSolid(state, point)) continue
      points.push(point)
    }
  }
  const goal = goalPoint(state, mech)
  if (goal) {
    const gap = distance(origin, goal)
    const step = gap <= budget ? goal : along(origin, goal, budget)
    if (!jump && !lineBlocked(state, origin, step) && !insideSolid(state, step)) points.push(step)
    if (jump && !insideSolid(state, step)) points.push(step)
  }
  return points.length > 0 ? points : [origin]
}

function scorePoint(state: GameState, mech: Mech, mode: MoveMode, origin: Point, point: Point, thin: boolean): number {
  const rules = scenarioOf(state).rules
  const moved = distance(origin, point)
  let score = 0
  if (mode === "stand" || moved < 1) {
    if (thin) score -= 1000
  }
  const beacon = rules.beacon ? state.layout?.objectives.find((item) => item.kind === "hold") : undefined
  if (beacon) score += 80 - distance(point, beacon)
  const card = cardOf(state.cards, mech.variant)
  let bestDamage = 0
  for (const enemy of state.mechs) {
    if (enemy.ownerId === mech.ownerId || enemy.knockedOut || enemy.x == null) continue
    const range = bandOf(distance(point, spot(enemy)), rules.realRange)
    if (range === "tooFar") continue
    const box = boxAt(card, range)
    bestDamage = Math.max(bestDamage, box === "star" ? 1 : box)
    if (distance(point, spot(enemy)) < 2) score -= 8
  }
  score += bestDamage * 4
  if (besideCover(state, point)) score += 3
  if (mode === "sprint") score -= 2
  return score
}

function goalPoint(state: GameState, mech: Mech): Point | null {
  if (scenarioOf(state).rules.beacon) {
    const beacon = state.layout?.objectives.find((item) => item.kind === "hold")
    if (beacon) return beacon
  }
  const enemies = state.mechs.filter((other) => other.ownerId !== mech.ownerId && !other.knockedOut && other.x != null)
  if (enemies.length === 0) return null
  return enemies
    .map(spot)
    .sort((a, b) => distance(spot(mech), a) - distance(spot(mech), b))[0]
}

function moveBudget(mech: Mech, mode: MoveMode): number {
  if (mode === "charge") return adjustedMove(mech, "walk")
  if (mode === "dfa") return adjustedMove(mech, "jump")
  return adjustedMove(mech, mode)
}

function bandOf(gap: number, realRange: boolean): RangeBand | "tooFar" {
  if (gap <= 6) return "short"
  if (gap <= 24) return "medium"
  if (realRange && gap <= 42) return "long"
  return "tooFar"
}

function targetOf(state: GameState): Mech | undefined {
  const id = state.combat?.targetId
  return id ? state.mechs.find((mech) => mech.id === id) : undefined
}

function aim(mech: Mech): Point {
  return mech.order ?? spot(mech)
}

function spot(mech: Mech): Point {
  return { x: mech.x ?? 0, y: mech.y ?? 0 }
}

function besideCover(state: GameState, point: Point): boolean {
  return (state.layout?.pieces ?? []).some((piece) => piece.blocksLos && gapToRect(point, piece) <= 1)
}

function inKind(state: GameState, point: Point, kind: string): boolean {
  return (state.layout?.pieces ?? []).some(
    (piece) => piece.kind === kind && point.x >= piece.x && point.x <= piece.x + piece.w && point.y >= piece.y && point.y <= piece.y + piece.h,
  )
}

function insideSolid(state: GameState, point: Point): boolean {
  return (state.layout?.pieces ?? []).some(
    (piece) => piece.blocksLos && point.x >= piece.x && point.x <= piece.x + piece.w && point.y >= piece.y && point.y <= piece.y + piece.h,
  )
}

function lineBlocked(state: GameState, from: Point, to: Point): boolean {
  return (state.layout?.pieces ?? []).some((piece) => piece.blocksLos && segmentHits(from, to, piece))
}

function segmentHits(from: Point, to: Point, rect: { x: number; y: number; w: number; h: number }): boolean {
  const steps = 12
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps
    const x = from.x + (to.x - from.x) * t
    const y = from.y + (to.y - from.y) * t
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return true
  }
  return false
}

function gapToRect(point: Point, rect: { x: number; y: number; w: number; h: number }): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.w))
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.h))
  return Math.hypot(dx, dy)
}

function along(from: Point, to: Point, budget: number): Point {
  const gap = distance(from, to) || 1
  const scale = budget / gap
  return { x: from.x + (to.x - from.x) * scale, y: from.y + (to.y - from.y) * scale }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function facingBetween(from: Point, to: Point): number {
  return Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI)
}

function roundInch(value: number): number {
  return Math.round(value * 2) / 2
}
