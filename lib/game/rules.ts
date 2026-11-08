import type { Rules } from "./types"

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
