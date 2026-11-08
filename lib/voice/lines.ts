import { CATALOG, speak, type Scenario } from "../game/scenarios"
import { BOX_INVENTORY, type ObjectiveType } from "../scenario-gen/layout"
import { makeLayout, pickupScenario } from "../scenario-gen/scenario"
import { galaxy, garrison, narrator, spokenText, toLines, unquote, type Line, type VoiceLine } from "../game/script"
import type { Faction } from "../game/types"
import { voiceKey } from "./key"

export function briefingLines(scenario: Scenario, faction: Faction): Line[] {
  const side = scenario.sides[faction]
  const command = faction === "innerSphere" ? garrison : galaxy
  return [
    ...toLines(scenario.story),
    narrator(scenario.goal),
    command(side.orders),
    ...side.plan.map((item) => narrator(item)),
  ]
}

export function ordersLines(scenario: Scenario, faction: Faction): Line[] {
  const side = scenario.sides[faction]
  const command = faction === "innerSphere" ? garrison : galaxy
  return [command(side.orders), ...side.plan.map((item) => command(item))]
}

export function lessonLines(scenario: Scenario): Line[] {
  return [narrator(scenario.lesson)]
}

export function endingLines(scenario: Scenario, outcome: Faction | "draw"): Line[] {
  return toLines(scenario.ending[outcome])
}

export function interludeFor(scenario: Scenario, turn: number) {
  return scenario.interludes?.find((item) => item.turn === turn)
}

export function toVoice(lines: readonly Line[], names: { innerSphere: string; clan: string }): VoiceLine[] {
  return lines.flatMap((line) => {
    const spoken = spokenText(line)
    if (!spoken) return []
    return [{ who: line.who, say: unquote(speak(line.text, names.innerSphere, names.clan)), key: voiceKey(line.who, spoken) }]
  })
}

// The pickup story and endings never change, but its goal line depends on the objective.
export function voicedScenarios(): Scenario[] {
  const objectives: ObjectiveType[] = ["fight", "center", "markers", "breakthrough"]
  const pickups = objectives.map((objective) =>
    pickupScenario(makeLayout({ table: "3x4", inventory: BOX_INVENTORY, objective, seed: "voice" }), objective),
  )
  return [...CATALOG, ...pickups]
}

// Every line a recording can exist for, keyed the same way the browser looks them up.
export function everyLine(scenarios: readonly Scenario[]): { key: string; line: Line; spoken: string }[] {
  const seen = new Map<string, { key: string; line: Line; spoken: string }>()
  for (const scenario of scenarios) {
    const groups: Line[][] = [
      briefingLines(scenario, "innerSphere"),
      briefingLines(scenario, "clan"),
      lessonLines(scenario),
      endingLines(scenario, "innerSphere"),
      endingLines(scenario, "clan"),
      endingLines(scenario, "draw"),
      ...(scenario.interludes ?? []).map((item) => item.lines),
    ]
    for (const line of groups.flat()) {
      const spoken = spokenText(line)
      if (!spoken) continue
      const key = voiceKey(line.who, spoken)
      if (!seen.has(key)) seen.set(key, { key, line, spoken })
    }
  }
  return [...seen.values()]
}
