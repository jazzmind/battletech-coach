import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { importForce } from "../forces/jeffs"
import { BOX_INVENTORY } from "../scenario-gen/layout"
import { applyAction, createPickupGame, setupSteps } from "./flow"
import { present } from "./present"
import type { CardFace } from "./cards"
import type { Action, GameState } from "./types"

const jeffs = JSON.parse(readFileSync(new URL("../forces/fixtures/jeffs-iic-liao.json", import.meta.url), "utf8"))

function act(state: GameState, action: Action): GameState {
  return applyAction(state, action)
}

function seat(): GameState {
  let state = createPickupGame({
    code: "PICK",
    hostId: "host",
    hostName: "Wes",
    faction: "innerSphere",
    table: "3x4",
    objective: "markers",
    inventory: BOX_INVENTORY,
    seed: "pickup-test",
    pvBudget: 350,
  })
  state = act(state, { type: "join", playerId: "kid", name: "Sam" })
  const force = importForce(jeffs)
  const hostCards = [force.cards[0], force.cards[1], { ...force.cards[0], id: "second-host", name: "Blackjack Two" }]
  const guestCards = [force.cards[1], { ...force.cards[1], id: "second-guest", name: "Catapult Two" }]
  state = act(state, { type: "bring", playerId: "host", cards: hostCards, skipped: [], replace: true })
  state = act(state, { type: "bring", playerId: "kid", cards: guestCards, skipped: force.skipped.map((unit) => unit.name), replace: true })
  const hostIds = state.pools.host
  const guestIds = state.pools.kid
  state = act(state, { type: "field", playerId: "host", variantIds: hostIds })
  state = act(state, { type: "field", playerId: "kid", variantIds: guestIds })
  state = act(state, { type: "ready", playerId: "host" })
  state = act(state, { type: "ready", playerId: "kid" })
  return state
}

function throughSetup(state: GameState): GameState {
  state = act(state, { type: "confirm", playerId: "host" })
  state = act(state, { type: "confirm", playerId: "kid" })
  state = act(state, { type: "ready", playerId: "host" })
  state = act(state, { type: "ready", playerId: "kid" })
  state = act(state, { type: "confirm", playerId: "host" })
  state = act(state, { type: "confirm", playerId: "kid" })
  while (state.phase === "place") {
    const step = setupSteps(state)[state.placeIndex]
    state = act(state, { type: "confirm", playerId: step.who === "host" ? "host" : "kid" })
  }
  state = act(state, { type: "confirm", playerId: "host" })
  state = act(state, { type: "confirm", playerId: "kid" })
  return state
}

function playTurn(state: GameState): GameState {
  state = act(state, { type: "initiative", playerId: "host", roll: 4 })
  state = act(state, { type: "initiative", playerId: "kid", roll: 9 })
  let guard = 0
  while (state.phase === "move" && guard < 40) {
    const playerId = state.players.find((player) => present(state, player.id).active)?.id
    assert.ok(playerId)
    if (state.step === "pick") {
      const choice = present(state, playerId).choices[0]
      assert.ok(choice)
      state = act(state, choice.action)
    } else if (state.step === "mode") {
      state = act(state, { type: "moveMode", playerId, mode: "walk" })
    } else if (state.step === "placed") {
      state = act(state, { type: "continue", playerId })
    } else if (state.step === "terrain") {
      state = act(state, { type: "terrain", playerId, ok: true })
    } else if (state.step === "water") {
      state = act(state, { type: "water", playerId, inWater: false })
    } else {
      throw new Error(`stuck on move ${state.step}`)
    }
    guard += 1
  }
  guard = 0
  while (state.phase === "combat" && guard < 40) {
    const playerId = state.mechs.find((mech) => mech.id === state.activeMechId)?.ownerId
    assert.ok(playerId)
    if (state.step === "pass") state = act(state, { type: "continue", playerId })
    else if (state.step === "kind") state = act(state, { type: "kind", playerId, kind: "hold" })
    else throw new Error(`stuck on combat ${state.step}`)
    guard += 1
  }
  return state
}

describe("pickup game", () => {
  it("fields an uneven imported force and plays a turn", () => {
    let state = seat()
    assert.equal(state.phase, "briefing")
    assert.equal(state.mechs.filter((mech) => mech.ownerId === "host").length, 3)
    assert.equal(state.mechs.filter((mech) => mech.ownerId === "kid").length, 2)
    const roster = present(state, "host")
    assert.match(roster.say, /brought their own lances/)
    state = throughSetup(state)
    assert.equal(state.phase, "initiative")
    const map = present(state, "host").map
    assert.equal(map?.where, "look")
    state = playTurn(state)
    assert.equal(state.phase, "end")
    state = act(state, { type: "confirm", playerId: "host" })
    state = act(state, { type: "confirm", playerId: "kid" })
    assert.equal(state.step, "beacon")
    const markers = state.customScenario?.objectives?.length ?? 0
    assert.ok(markers >= 2)
    for (let index = 0; index < markers; index += 1) {
      state = act(state, { type: "beacon", playerId: "host", alone: false })
      state = act(state, { type: "beacon", playerId: "kid", alone: index === 0 })
    }
    assert.equal(state.phase, "initiative")
    assert.equal(state.players.find((player) => player.id === "kid")?.beaconPoints, 1)
  })

  it("scores a breakthrough for both sides", () => {
    let state = createPickupGame({
      code: "EXIT",
      hostId: "host",
      hostName: "Wes",
      faction: "innerSphere",
      table: "3x3",
      objective: "breakthrough",
      inventory: BOX_INVENTORY,
      seed: "exit",
      pvBudget: 150,
    })
    state = act(state, { type: "join", playerId: "kid", name: "Sam" })
    const card: CardFace = {
      id: "walker",
      name: "Walker",
      side: "card",
      faction: "innerSphere",
      walk: 8,
      jump: null,
      tmm: 1,
      size: 2,
      armor: 3,
      structure: 2,
      ov: 0,
      short: 2,
      medium: 2,
      long: 0,
      specials: [],
      pv: 20,
      skill: 4,
      unitType: "BM",
    }
    state = act(state, { type: "bring", playerId: "host", cards: [{ ...card, id: "h-walker" }], skipped: [], replace: true })
    state = act(state, { type: "bring", playerId: "kid", cards: [{ ...card, id: "g-walker", name: "Other" }], skipped: [], replace: true })
    state = act(state, { type: "field", playerId: "host", variantIds: state.pools.host })
    state = act(state, { type: "field", playerId: "kid", variantIds: state.pools.kid })
    state = act(state, { type: "ready", playerId: "host" })
    state = act(state, { type: "ready", playerId: "kid" })
    state = throughSetup(state)
    state = playTurn(state)
    state = act(state, { type: "confirm", playerId: "host" })
    state = act(state, { type: "confirm", playerId: "kid" })
    assert.match(present(state, "host").say, /home edge/)
    state = act(state, { type: "beacon", playerId: "host", alone: true })
    state = act(state, { type: "beacon", playerId: "kid", alone: true })
    assert.equal(state.phase, "over")
    assert.equal(state.players.every((player) => player.beaconPoints === 1), true)
  })
})
