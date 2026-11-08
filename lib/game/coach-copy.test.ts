import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { applyAction, createGame, currentCard } from "./flow"
import { present } from "./present"
import type { Action, GameState } from "./types"

function act(state: GameState, action: Action): GameState {
  return applyAction(state, action)
}

function boot(scenarioId: string): GameState {
  let state = createGame({
    code: "TEST",
    scenarioId,
    hostId: "host",
    hostName: "Wes",
    faction: "innerSphere",
  })
  state = act(state, { type: "join", playerId: "kid", name: "Sam" })
  return state
}

function ready(state: GameState): GameState {
  state = act(state, { type: "ready", playerId: "host" })
  state = act(state, { type: "ready", playerId: "kid" })
  state = act(state, { type: "confirm", playerId: "host" })
  state = act(state, { type: "confirm", playerId: "kid" })
  while (state.phase === "place") {
    state = act(state, { type: "confirm", playerId: "host" })
    state = act(state, { type: "confirm", playerId: "kid" })
  }
  return state
}

function fillCards(state: GameState): GameState {
  let guard = 0
  while (state.phase === "cards") {
    const current = currentCard(state)
    assert.ok(current)
    const value = current.field === "skill" ? 4 : current.field === "tmm" ? 2 : 8
    state = act(state, { type: "card", playerId: current.mech.ownerId, field: current.field, value })
    guard += 1
    if (guard > 20) throw new Error("card loop")
  }
  return state
}

function toShot(state: GameState): GameState {
  state = act(state, { type: "initiative", playerId: "host", roll: 3 })
  state = act(state, { type: "initiative", playerId: "kid", roll: 9 })
  let guard = 0
  while (state.phase === "move") {
    const playerId = state.mechs.find((mech) => mech.id === state.activeMechId)?.ownerId
    assert.ok(playerId)
    if (state.step === "mode") state = act(state, { type: "moveMode", playerId, mode: "walk" })
    else if (state.step === "placed" || state.step === "pass") state = act(state, { type: "continue", playerId })
    else throw new Error(`unexpected move step ${state.step}`)
    guard += 1
    if (guard > 8) throw new Error("move loop")
  }
  return state
}

describe("coach copy", () => {
  it("names only the mechs in this scenario", () => {
    const screen = present(boot("first-steps"), "host")
    assert.match(screen.say, /Wes uses the Warhammer/)
    assert.match(screen.say, /Sam uses the Timber Wolf/)
    assert.match(screen.say, /Leave every other mech in the box/)
    assert.match(screen.say, /8R/)
    assert.match(screen.say, /Prime/)
    assert.doesNotMatch(screen.say, /Wasp|Atlas|Locust/)
    const pool = screen.roster?.flatMap((card) => card.options.map((option) => option.name)) ?? []
    assert.ok(pool.includes("Wasp"))
  })

  it("explains the first shot, the two dice, and whose card gets the bubbles", () => {
    let state = toShot(fillCards(ready(boot("first-steps"))))
    assert.equal(state.step, "kind")
    const choice = present(state, "host")
    assert.match(choice.say, /two dice/)
    assert.match(choice.say, /Do not add your skill/)
    assert.match(choice.say, /Within 6 inches/)
    assert.match(choice.say, /medium box/)
    assert.match(choice.say, /Past 24, hold fire/)

    state = act(state, { type: "kind", playerId: "host", kind: "weapon" })
    state = act(state, { type: "target", playerId: "host", targetId: "g0" })
    state = act(state, { type: "range", playerId: "host", range: "short" })
    const roll = present(state, "host")
    assert.equal(roll.pad?.label, "Sum of the two dice")
    assert.match(roll.say, /roll two dice and add them/)
    assert.match(roll.say, /Do not add the skill or any modifiers/)
    assert.match(roll.say, /Skill \+4/)
    assert.match(roll.say, /skill spot on the card is blank/)
    assert.match(roll.say, /Nothing else changes the skill/)
    assert.match(roll.say, /The two dice need 4 or more/)
    const watching = present(state, "kid")
    assert.match(watching.wait ?? "", /two dice/)
    assert.match(watching.wait ?? "", /already counted/)

    state = act(state, { type: "dice", playerId: "host", roll: 8 })
    state = act(state, { type: "band", playerId: "host", amount: 3 })
    const bubbles = present(state, "host")
    assert.match(bubbles.say, /Sam's Timber Wolf card/)
    assert.match(bubbles.say, /3 armor/)
    assert.match(bubbles.say, /5 armor and 8 structure left/)
    assert.match(bubbles.hud.rows.find((row) => row.name === "Timber Wolf")?.detail ?? "", /Armor 5/)
  })

  it("shows range modifiers as already counted", () => {
    let state = toShot(fillCards(ready(boot("how-far"))))
    state = act(state, { type: "kind", playerId: "host", kind: "weapon" })
    state = act(state, { type: "target", playerId: "host", targetId: "g0" })
    state = act(state, { type: "range", playerId: "host", range: "medium" })
    const roll = present(state, "host")
    assert.match(roll.say, /Skill \+4/)
    assert.match(roll.say, /Medium range \+2/)
    assert.match(roll.say, /A plus makes the shot harder/)
    assert.match(roll.say, /The two dice need 6 or more/)
    assert.match(roll.say, /Do not add the skill or any modifiers/)
  })
})
