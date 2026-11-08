import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { applyAction, createGame } from "../game/flow"
import { present } from "../game/present"
import { autoLines } from "./auto"

function solo() {
  return createGame({ code: "AUTO", scenarioId: "first-steps", hostId: "host", hostName: "Sam", faction: "innerSphere", solo: true })
}

const STORY = { story: true, steps: false }
const STEPS = { story: false, steps: true }
const BOTH = { story: true, steps: true }

describe("story audio and step reading", () => {
  it("plays the briefing only with story audio", () => {
    const screen = present(solo(), "host")
    assert.equal(screen.voice?.mission?.[0]?.who, "narrator")
    assert.deepEqual(autoLines(screen, STORY), screen.voice?.mission)
    assert.deepEqual(autoLines(screen, STEPS), [])
  })

  it("reads the coach's step only with step reading", () => {
    const state = applyAction(solo(), { type: "confirm", playerId: "host" })
    assert.equal(state.phase, "roster")
    const screen = present(state, "host")
    assert.deepEqual(autoLines(screen, STORY), [])
    const lines = autoLines(screen, STEPS)
    assert.equal(lines.length, 1)
    assert.equal(lines[0].who, "coach")
    assert.equal(lines[0].say, screen.say)
  })

  it("plays the ending as story and the summary as a step", () => {
    const state = solo()
    state.phase = "over"
    state.winnerId = "host"
    const screen = present(state, "host")
    const story = autoLines(screen, STORY)
    assert.ok(story.length > 0)
    assert.ok(story.every((line) => line.who !== "coach"))
    assert.match(story.map((line) => line.say).join(" "), /Warhammer is still standing/)
    const both = autoLines(screen, BOTH)
    assert.equal(both[0].who, "coach")
    assert.equal(both.length, story.length + 1)
  })
})
