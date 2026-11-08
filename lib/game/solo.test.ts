import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { applyAction, createGame } from "./flow"
import { adjustedMove } from "./math"
import { planMove } from "./opponent"
import { present } from "./present"

function solo(scenarioId: string) {
  return createGame({
    code: "SOLO",
    scenarioId,
    hostId: "host",
    hostName: "Wes",
    faction: "innerSphere",
    solo: true,
  })
}

describe("solo seat", () => {
  it("starts with the coach already seated and one screen to confirm", () => {
    const state = solo("first-steps")
    assert.equal(state.players.length, 2)
    assert.equal(state.coachId, "coach")
    assert.equal(state.phase, "briefing")
    const screen = present(state, "host")
    assert.equal(screen.wait, undefined)
    assert.equal(screen.choices[0]?.action.type, "confirm")
    assert.equal(screen.choices.some((choice) => choice.label === "I know the plan"), true)
  })

  it("leaves a two-player game waiting for the second screen", () => {
    const state = createGame({
      code: "PAIR",
      scenarioId: "first-steps",
      hostId: "host",
      hostName: "Wes",
      faction: "innerSphere",
    })
    assert.equal(state.players.length, 1)
    assert.equal(state.coachId, undefined)
    assert.equal(state.phase, "lobby")
  })

  it("rolls the coach's initiative when you roll yours", () => {
    const state = solo("first-steps")
    state.phase = "initiative"
    state.step = "roll"
    state.turn = 1
    state.initiative = {}
    const next = applyAction(state, { type: "initiative", playerId: "host", roll: 6 })
    if (next.phase === "initiative") {
      assert.ok((next.initiative.coach ?? 0) >= 2)
      assert.ok((next.initiative.coach ?? 0) <= 12)
    } else {
      assert.equal(next.phase, "move")
    }
  })
})

describe("coach moves", () => {
  it("keeps a Fire Moth moving, inside its walk", () => {
    const state = solo("they-moved")
    const moth = state.mechs.find((mech) => mech.name === "Fire Moth")
    assert.ok(moth?.x != null && moth.y != null && moth.walkInches != null)
    const plan = planMove(state, moth)
    assert.notEqual(plan.mode, "stand")
    const moved = Math.hypot(plan.x - moth.x, plan.y - moth.y)
    assert.ok(moved >= 1)
    assert.ok(moved <= adjustedMove(moth, plan.mode) + 0.01)
  })

  it("walks a beacon game toward the token", () => {
    const state = solo("beacon")
    const moth = state.mechs.find((mech) => mech.name === "Fire Moth")
    const beacon = state.layout?.objectives.find((item) => item.kind === "hold")
    assert.ok(moth?.x != null && moth.y != null && beacon)
    const before = Math.hypot(moth.x - beacon.x, moth.y - beacon.y)
    const plan = planMove(state, moth)
    const after = Math.hypot(plan.x - beacon.x, plan.y - beacon.y)
    assert.ok(after < before)
  })

  it("shows the Fire Moth's ring on the diagram", () => {
    const state = solo("they-moved")
    const moth = state.mechs.find((mech) => mech.name === "Fire Moth")
    assert.ok(moth)
    state.phase = "move"
    state.step = "placed"
    state.activeMechId = moth.id
    moth.moveMode = "walk"
    moth.order = { x: moth.x ?? 24, y: 14 }
    const screen = present(state, "host")
    assert.match(screen.say, /Fire Moth/)
    assert.match(screen.say, /ring/)
    assert.equal(screen.map?.where, "stage")
    assert.equal(screen.map?.order?.name, "Fire Moth")
    assert.equal(screen.choices[0]?.label, "It's on that spot")
    assert.equal(screen.wait, undefined)
  })
})
