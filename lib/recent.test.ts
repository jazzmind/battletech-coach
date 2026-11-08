import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { remember } from "./recent"

describe("recent games", () => {
  it("keeps the newest copy of a code and the latest eight", () => {
    const first = { code: "AAAA", scenarioId: "first-steps", scenario: "First Steps", turn: "Setup" }
    const second = { code: "BBBB", scenarioId: "streets", scenario: "Streets and Trees", turn: "Turn 1" }
    const updated = { ...first, turn: "Turn 2" }
    const list = remember([second, first], updated)
    assert.deepEqual(list.map((game) => game.code), ["AAAA", "BBBB"])
    assert.equal(list[0].turn, "Turn 2")
    const many = Array.from({ length: 9 }, (_, index) => ({
      code: `C${index}`,
      scenarioId: "first-steps",
      scenario: "First Steps",
      turn: "Setup",
    }))
    assert.equal(remember(many, many[0]).length, 8)
  })
})
