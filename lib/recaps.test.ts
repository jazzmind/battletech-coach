import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { applyAction, createGame, setupSteps } from "./game/flow"
import { present } from "./game/present"
import type { GameState } from "./game/types"
import { forgetRecap, recapOf, rememberRecap, type Recap } from "./recaps"

function act(state: GameState, action: Parameters<typeof applyAction>[1]): GameState {
  return applyAction(state, action)
}

function boot(): GameState {
  let state = createGame({
    code: "HOW1",
    scenarioId: "how-far",
    hostId: "host",
    hostName: "Wes",
    faction: "innerSphere",
  })
  state = act(state, { type: "join", playerId: "kid", name: "Sam" })
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
  while (state.phase === "cards") {
    const pending = state.players.find((player) => !state.confirmations.includes(player.id))
    if (!pending) break
    state = act(state, { type: "confirm", playerId: pending.id })
  }
  return state
}

function fight(state: GameState): GameState {
  let guard = 0
  while (state.phase !== "over") {
    const playerId = state.players.find((player) => present(state, player.id).active)?.id
    if (!playerId) throw new Error(`nobody active at ${state.phase} ${state.step}`)
    if (state.phase === "initiative") {
      const roll = playerId === "host" ? 4 : 9
      state = act(state, { type: "initiative", playerId, roll })
    } else if (state.phase === "move" && state.step === "pick") {
      const mine = state.mechs.find((mech) => mech.ownerId === playerId && !mech.knockedOut)
      if (!mine) throw new Error("no mech to move")
      state = act(state, { type: "pickMech", playerId, mechId: mine.id })
    } else if (state.step === "mode") {
      state = act(state, { type: "moveMode", playerId, mode: "walk" })
    } else if (state.step === "placed") {
      state = act(state, { type: "continue", playerId })
    } else if (state.phase === "combat" && state.step === "kind") {
      const mine = state.mechs.find((mech) => mech.id === state.activeMechId)
      const kind = mine?.ownerId === "host" ? "weapon" : "hold"
      state = act(state, { type: "kind", playerId, kind })
    } else if (state.step === "target") {
      const target = state.mechs.find((mech) => mech.ownerId !== playerId && !mech.knockedOut)
      if (!target) throw new Error("no target")
      state = act(state, { type: "target", playerId, targetId: target.id })
    } else if (state.step === "los" || state.step === "arc") {
      state = act(state, { type: "yesNo", playerId, field: state.step, yes: true })
    } else if (state.step === "range") {
      state = act(state, { type: "range", playerId, range: "short" })
    } else if (state.step === "roll") {
      state = act(state, { type: "dice", playerId, roll: 12 })
    } else if (state.step === "bubbles" || state.step === "self") {
      state = act(state, { type: "marked", playerId, result: "out" })
    } else if (state.phase === "end") {
      state = act(state, { type: "confirm", playerId })
    } else {
      throw new Error(`stuck ${state.phase} ${state.step}`)
    }
    guard += 1
    if (guard > 80) throw new Error(`too long at ${state.phase} ${state.step}`)
  }
  return state
}

function blank(code: string): Recap {
  return {
    code,
    scenarioId: "how-far",
    title: "How Far",
    chapter: "Chapter 4",
    finished: "2026-01-01T00:00:00.000Z",
    players: [],
    winner: "",
    reason: "",
    happened: "",
    ending: "",
    result: "played",
    mechs: [],
    log: [],
  }
}

describe("battle log and recaps", () => {
  it("records the turn, a hit, a knockout, and the win", () => {
    const state = fight(boot())
    const text = state.log.map((line) => line.text).join("\n")
    assert.match(text, /Turn 1/)
    assert.match(text, /hit the/)
    assert.match(text, /was knocked out/)
    assert.match(text, /wins/)
    assert.equal(state.phase, "over")
  })

  it("drops the last log line when that tap is undone", () => {
    let state = boot()
    state = act(state, { type: "initiative", playerId: "host", roll: 4 })
    state = act(state, { type: "initiative", playerId: "kid", roll: 9 })
    assert.match(state.log.map((line) => line.text).join("\n"), /moves first/)
    const before = state.log.length
    state = act(state, { type: "undo", playerId: "kid" })
    assert.equal(state.log.some((line) => line.text.includes("moves first")), false)
    assert.equal(state.log.some((line) => line.text.includes("Turn 1")), true)
    assert.equal(state.log.length, before - 1)
  })

  it("builds a recap whose summary matches what happened", () => {
    const state = fight(boot())
    const recap = recapOf(state, "host")
    assert.equal(recap.happened, present(state, "host").say)
    assert.equal(recap.result, "won")
    assert.equal(recapOf(state, "kid").result, "played")
    assert.equal(recap.code, "HOW1")
    assert.ok(recap.log.length > 0)
  })

  it("keeps the newest forty records and deletes by code", () => {
    const many = Array.from({ length: 41 }, (_, index) => blank(`C${index}`))
    let list = many.reduce((kept, next) => rememberRecap(kept, next), [] as Recap[])
    assert.equal(list.length, 40)
    assert.equal(list[0].code, "C40")
    assert.equal(list.some((item) => item.code === "C0"), false)
    list = rememberRecap(list, { ...blank("C40"), winner: "Wes" })
    assert.equal(list.filter((item) => item.code === "C40").length, 1)
    assert.equal(list[0].winner, "Wes")
    list = forgetRecap(list, "C40")
    assert.equal(list.some((item) => item.code === "C40"), false)
  })
})
