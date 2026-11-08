import type { AttackKind, Mech, MoveMode, RangeBand, Rules } from "./types"

export type Line = { label: string; amount: number }

export function adjustedMove(mech: Mech, mode: MoveMode): number {
  let walk = mech.walkInches ?? 0
  let jump = mech.jumpInches ?? walk
  for (let i = 0; i < mech.mpHits; i++) {
    walk = Math.max(0, Math.min(Math.floor(walk / 2), walk - 2))
    jump = Math.max(0, Math.min(Math.floor(jump / 2), jump - 2))
  }
  if (mode === "jump" || mode === "dfa") return Math.max(0, jump)
  if (mech.heat > 0) walk = Math.max(0, walk - mech.heat * 2)
  if (mode === "sprint") return Math.max(0, Math.ceil(walk * 1.5))
  if (mode === "stand") return 0
  return Math.max(0, walk)
}

export function groundTmm(mech: Mech, rules: Rules): number {
  let tmm = mech.tmm ?? 0
  for (let i = 0; i < mech.mpHits; i++) {
    tmm = Math.max(0, Math.min(Math.floor(tmm / 2), tmm - 1))
  }
  if (rules.heatScale && mech.heat >= 2) tmm = Math.max(0, tmm - 1)
  return Math.max(0, tmm)
}

export function defenderTmm(mech: Mech, rules: Rules): number {
  if (mech.shutdown) return -4
  const jumping = mech.moveMode === "jump" || mech.moveMode === "dfa"
  if (!jumping && mech.mpHits > 0 && adjustedMove(mech, "walk") === 0) return -4
  if (!jumping && (mech.moveMode === "stand" || mech.moveMode == null)) return 0
  let tmm = mech.tmm ?? 0
  for (let i = 0; i < mech.mpHits; i++) {
    tmm = Math.max(0, Math.min(Math.floor(tmm / 2), tmm - 1))
  }
  if (!jumping && rules.heatScale && mech.heat >= 2) tmm = Math.max(0, tmm - 1)
  if (jumping && rules.realJump) tmm += 1
  return tmm
}

export function availableModes(
  mech: Mech,
  rules: Rules,
  enemiesAlreadyMoved: boolean,
): MoveMode[] {
  const modes: MoveMode[] = []
  const walk = adjustedMove(mech, "walk")
  const jump = adjustedMove(mech, "jump")
  if (rules.standstill || rules.tmm) modes.push("stand")
  if (walk > 0) modes.push("walk")
  if ((rules.teachingJump || rules.realJump) && mech.hasJump && jump > 0) modes.push("jump")
  if (rules.sprint && walk > 0) modes.push("sprint")
  if (rules.charge && enemiesAlreadyMoved && walk > 0) modes.push("charge")
  if (rules.charge && mech.hasJump && enemiesAlreadyMoved && jump > 0) modes.push("dfa")
  if (modes.length === 0) modes.push("stand")
  return modes
}

export function attackPreview(input: {
  attacker: Mech
  target: Mech
  rules: Rules
  kind: AttackKind
  range?: RangeBand
  partial: boolean
  woods: boolean
  tweak: number
}): { lines: Line[]; total: number } {
  const { attacker, target, rules, kind, range, partial, woods, tweak } = input
  const lines: Line[] = [{ label: "Skill", amount: attacker.skill ?? 4 }]
  if (kind === "weapon" && rules.realRange && range) {
    const amount = range === "short" ? 0 : range === "medium" ? 2 : 4
    const label = range === "short" ? "Short range" : range === "medium" ? "Medium range" : "Long range"
    lines.push({ label, amount })
  }
  if ((attacker.moveMode === "jump" || attacker.moveMode === "dfa") && rules.realJump) {
    lines.push({ label: "You jumped", amount: 2 })
  }
  if (attacker.moveMode === "stand" && rules.standstill) {
    lines.push({ label: "You stood still", amount: -1 })
  }
  if (kind === "charge") lines.push({ label: "Charge", amount: 1 })
  if (kind === "dfa") lines.push({ label: "Death from above", amount: 1 })
  if (rules.tmm) {
    lines.push({ label: "Target movement", amount: defenderTmm(target, rules) })
  }
  if (rules.teachingJump && target.moveMode === "jump") {
    lines.push({ label: "Target jumped", amount: 1 })
  }
  if (rules.teachingCover && target.touchingCover) {
    lines.push({ label: "Cover", amount: 1 })
  }
  if (rules.teachingHeat && attacker.hot && kind === "weapon") {
    lines.push({ label: "Hot", amount: 1 })
  }
  if (rules.partialCover && partial) lines.push({ label: "Partial cover", amount: 1 })
  if (rules.woods && woods) lines.push({ label: "Woods", amount: 1 })
  if (rules.heatScale && attacker.heat > 0 && kind === "weapon") {
    lines.push({ label: "Your heat", amount: attacker.heat })
  }
  if (attacker.fireControlHits > 0 && kind === "weapon") {
    lines.push({ label: "Fire control damage", amount: attacker.fireControlHits * 2 })
  }
  if (tweak !== 0) lines.push({ label: "Card special", amount: tweak })
  const total = lines.reduce((sum, line) => sum + line.amount, 0)
  return { lines, total }
}

export function boxedDamage(box: number, weaponHits: number): number {
  return Math.max(0, box - weaponHits)
}

export function starDamage(die: number, weaponHits: number): number {
  const pip = die >= 4 ? 1 : 0
  return Math.max(0, pip - weaponHits)
}

export function weaponBubbles(
  card: number,
  overheat: number,
  rear: boolean,
  range: RangeBand,
): number {
  const extra = range === "long" ? 0 : overheat
  return card + extra + (rear ? 1 : 0)
}

export function chargeTargetDamage(attacker: Mech, rules: Rules): number {
  return (attacker.size ?? 1) + Math.floor(groundTmm(attacker, rules) / 2)
}

export function chargeSelfDamage(attacker: Mech, target: Mech, rules: Rules): number {
  return Math.floor(groundTmm(attacker, rules) / 2) + ((target.size ?? 1) >= 3 ? 1 : 0)
}

export function needSentence(total: number): string {
  if (total <= 2) return "Any roll hits."
  return `You need ${total} or more.`
}
