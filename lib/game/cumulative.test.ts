import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SCENARIOS } from "./scenarios"
import type { Rules } from "./types"

const REPLACED: Partial<Record<keyof Rules, keyof Rules>> = {
  teachingRange: "realRange",
  teachingCover: "partialCover",
  teachingJump: "realJump",
  teachingHeat: "heatScale",
}

const ONE_CHAPTER = new Set<keyof Rules>(["beacon", "retreat"])

describe("cumulative box chapters", () => {
  it("keeps a rule after it is taught, until its real replacement", () => {
    for (let index = 0; index < SCENARIOS.length; index += 1) {
      const rules = SCENARIOS[index].rules
      for (const key of Object.keys(rules) as (keyof Rules)[]) {
        if (!rules[key] || ONE_CHAPTER.has(key)) continue
        const replacement = REPLACED[key]
        for (const later of SCENARIOS.slice(index + 1)) {
          const still = later.rules[key]
          const replaced = replacement ? later.rules[replacement] : false
          assert.ok(still || replaced, `${later.id} dropped ${key} from ${SCENARIOS[index].id}`)
          if (replacement && replaced) assert.equal(still, false, `${later.id} has both ${key} and ${replacement}`)
        }
      }
    }
  })

  it("puts Jump Jets after Trees and Walls", () => {
    const ids = SCENARIOS.map((scenario) => scenario.id)
    assert.ok(ids.indexOf("trees-and-walls") < ids.indexOf("jump-jets"))
    assert.equal(SCENARIOS.find((scenario) => scenario.id === "jump-jets")?.layout?.pieces.some((piece) => piece.kind === "wall"), true)
  })
})
