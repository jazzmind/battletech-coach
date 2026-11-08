import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mustFace } from "./cards"
import { attackPreview, adjustedMove, boxedDamage, defenderTmm, starDamage } from "./math"
import { applyAction, claimSeat, createGame, currentCard, rulesOf, setupSteps } from "./flow"
import { present } from "./present"
import type { Action, GameState, Mech } from "./types"
import { RuleError } from "./types"

function act(state: GameState, action: Action): GameState {
  return applyAction(state, action)
}

function boot(scenarioId: string, faction: "innerSphere" | "clan" = "innerSphere"): GameState {
  let state = createGame({
    code: "TEST",
    scenarioId,
    hostId: "host",
    hostName: "Wes",
    faction,
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
  return state
}

function fillCards(state: GameState): GameState {
  let guard = 0
  while (state.phase === "cards") {
    const current = currentCard(state)
    if (!current) {
      const pending = state.players.find((player) => !state.confirmations.includes(player.id))
      assert.ok(pending)
      state = act(state, { type: "confirm", playerId: pending.id })
    } else {
      const card = mustFace(current.mech.variant)
      const value = current.field === "walk" ? card.walk : current.field === "armor" ? card.armor : card.structure
      state = act(state, { type: "card", playerId: current.mech.ownerId, field: current.field, value })
    }
    guard += 1
    if (guard > 40) throw new Error("card loop")
  }
  return state
}

function rollInit(state: GameState, low: "host" | "kid", lowRoll = 4, highRoll = 9): GameState {
  const lowId = low
  const highId = low === "host" ? "kid" : "host"
  state = act(state, { type: "initiative", playerId: lowId, roll: lowRoll })
  state = act(state, { type: "initiative", playerId: highId, roll: highRoll })
  return state
}

function moveWalk(state: GameState, playerId: string): GameState {
  if (state.step === "pick") {
    const mine = state.mechs.find((mech) => mech.ownerId === playerId && !mech.knockedOut && !state.moveOrder.includes(mech.id))
    assert.ok(mine)
    state = act(state, { type: "pickMech", playerId, mechId: mine.id })
  }
  if (state.step === "mode") {
    state = act(state, { type: "moveMode", playerId, mode: "walk" })
  }
  assert.equal(state.step, "placed")
  state = act(state, { type: "continue", playerId })
  return state
}

describe("box cards", () => {
  it("lets the named player finish a setup step alone", () => {
    let state = createGame({
      code: "TEST",
      scenarioId: "first-steps",
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
    assert.equal(state.phase, "place")
    assert.throws(() => act(state, { type: "confirm", playerId: "kid" }), RuleError)
    const watching = present(state, "kid")
    assert.equal(watching.choices.length, 0)
    assert.match(watching.wait ?? "", /Wes/)
    state = act(state, { type: "confirm", playerId: "host" })
    assert.equal(state.placeIndex, 1)
    assert.equal(present(state, "host").choices.length, 0)
    assert.equal(present(state, "kid").choices.length, 1)
  })

  it("lowers stored damage for weapon hits and reads a 0* die", () => {
    assert.equal(boxedDamage(4, 1), 3)
    assert.equal(boxedDamage(0, 2), 0)
    assert.equal(starDamage(4, 0), 1)
    assert.equal(starDamage(3, 0), 0)
    assert.equal(starDamage(6, 1), 0)
  })
})

describe("initiative", () => {
  it("rerolls ties and lets the lower roll move first", () => {
    let state = fillCards(boot("first-steps"))
    assert.equal(state.phase, "initiative")
    state = act(state, { type: "initiative", playerId: "host", roll: 7 })
    state = act(state, { type: "initiative", playerId: "kid", roll: 7 })
    assert.equal(state.phase, "initiative")
    assert.equal(state.notice, "Tie. Roll again.")
    state = rollInit(state, "kid")
    assert.equal(state.phase, "move")
    assert.equal(state.lowPlayerId, "kid")
    assert.equal(state.activeMechId, "g0")
  })
})

describe("teaching target number", () => {
  it("uses skill, then cover, jump, and heat when those games allow them", () => {
    const attacker = mech({ skill: 4, hot: true, moveMode: "walk" })
    const target = mech({ skill: 4, touchingCover: true, moveMode: "jump" })
    const plain = attackPreview({
      attacker,
      target,
      rules: rulesOf(game("first-steps")),
      kind: "weapon",
      range: "medium",
      partial: false,
      woods: false,
      tweak: 0,
    })
    assert.equal(plain.total, 4)

    const streets = attackPreview({
      attacker,
      target,
      rules: rulesOf(game("streets")),
      kind: "weapon",
      range: "medium",
      partial: false,
      woods: false,
      tweak: 0,
    })
    assert.equal(streets.total, 6)

    const beacon = attackPreview({
      attacker,
      target,
      rules: rulesOf(game("beacon")),
      kind: "weapon",
      range: "short",
      partial: false,
      woods: false,
      tweak: 0,
    })
    assert.equal(beacon.total, 7)
  })
})

describe("first steps play", () => {
  it("counts bubbles for two turns and then both pull back", () => {
    let state = fillCards(boot("first-steps"))
    assert.equal(state.mechs.every((mech) => mech.skill === 4), true)
    state = rollInit(state, "host")
    assert.equal(state.mechs.find((mech) => mech.id === state.activeMechId)?.name, "Warhammer")
    state = moveWalk(state, "host")
    state = moveWalk(state, "kid")
    assert.equal(state.phase, "combat")
    state = act(state, { type: "kind", playerId: "host", kind: "weapon" })
    state = act(state, { type: "target", playerId: "host", targetId: "g0" })
    state = act(state, { type: "range", playerId: "host", range: "medium" })
    assert.equal(state.combat?.targetNumber, 4)
    state = act(state, { type: "dice", playerId: "host", roll: 8 })
    assert.equal(state.step, "bubbles")
    assert.equal(state.combat?.cardDamage, 4)
    assert.equal(present(state, "host").pad, undefined)
    assert.equal(state.mechs.find((mech) => mech.id === "g0")?.armorLeft, 4)
    state = act(state, { type: "marked", playerId: "host", result: "out" })
    assert.equal(state.mechs.find((mech) => mech.id === "g0")?.knockedOut, false)
    state = act(state, { type: "kind", playerId: "kid", kind: "hold" })
    assert.equal(state.phase, "end")
    state = act(state, { type: "confirm", playerId: "host" })
    state = act(state, { type: "confirm", playerId: "kid" })
    assert.equal(state.phase, "initiative")
    assert.equal(state.turn, 2)

    state = rollInit(state, "host")
    state = moveWalk(state, "host")
    state = moveWalk(state, "kid")
    state = act(state, { type: "kind", playerId: "host", kind: "weapon" })
    state = act(state, { type: "target", playerId: "host", targetId: "g0" })
    state = act(state, { type: "range", playerId: "host", range: "short" })
    state = act(state, { type: "dice", playerId: "host", roll: 6 })
    state = act(state, { type: "marked", playerId: "host", result: "armor" })
    state = act(state, { type: "kind", playerId: "kid", kind: "hold" })
    assert.equal(state.phase, "over")
    assert.equal(state.winnerId, undefined)
    const recap = present(state, "host")
    assert.equal(recap.kicker, "What happened")
    assert.match(recap.say, /lasted 2 turns/)
    assert.match(recap.say, /Nobody lost/)
    assert.match(recap.say, /0 armor and 4 structure/)
    assert.match(recap.lesson ?? "", /8R/)
    assert.match(recap.ending ?? "", /batchall is answered/)
  })

  it("rejects a wrong bubble count, then accepts the number on the card", () => {
    let state = boot("first-steps")
    assert.equal(currentCard(state)?.field, "walk")
    state = act(state, { type: "card", playerId: "host", field: "walk", value: 3 })
    assert.equal(state.phase, "cards")
    assert.match(state.notice ?? "", /does not match/)
    assert.doesNotMatch(state.notice ?? "", /8 inches/)
    state = act(state, { type: "card", playerId: "host", field: "walk", value: 3 })
    assert.match(state.notice ?? "", /8 inches/)
    state = act(state, { type: "card", playerId: "host", field: "walk", value: 8 })
    assert.equal(currentCard(state)?.field, "armor")
    assert.equal(state.notice, undefined)
  })

  it("refuses the other player's buttons", () => {
    let state = fillCards(boot("first-steps"))
    state = rollInit(state, "host")
    assert.throws(() => act(state, { type: "continue", playerId: "kid" }), RuleError)
  })
})

describe("beacon", () => {
  it("scores one side, ignores a double claim, and ends at 2", () => {
    let state = fillCards(boot("beacon"))
    state = finishQuietTurn(state, "host")
    assert.equal(state.phase, "end")
    assert.match(heatText(state), /Hot/)
    state = act(state, { type: "confirm", playerId: "host" })
    state = act(state, { type: "confirm", playerId: "kid" })
    assert.equal(state.step, "beacon")
    state = act(state, { type: "beacon", playerId: "host", alone: true })
    state = act(state, { type: "beacon", playerId: "kid", alone: true })
    assert.equal(state.players[0].beaconPoints, 0)
    assert.match(state.notice ?? "", /nobody is alone/)

    state = finishQuietTurn(state, "host")
    state = act(state, { type: "confirm", playerId: "host" })
    state = act(state, { type: "confirm", playerId: "kid" })
    state = act(state, { type: "beacon", playerId: "host", alone: true })
    state = act(state, { type: "beacon", playerId: "kid", alone: false })
    assert.equal(state.players[0].beaconPoints, 1)

    state = finishQuietTurn(state, "host")
    state = act(state, { type: "confirm", playerId: "host" })
    state = act(state, { type: "confirm", playerId: "kid" })
    state = act(state, { type: "beacon", playerId: "host", alone: true })
    state = act(state, { type: "beacon", playerId: "kid", alone: false })
    assert.equal(state.phase, "over")
    assert.equal(state.winnerId, "host")
  })
})

describe("real rules", () => {
  it("adds range, TMM, standstill, and jump modifiers", () => {
    const rules = rulesOf(game("jump-jets"))
    const walker = mech({ skill: 3, tmm: 2, moveMode: "walk" })
    const jumper = mech({ skill: 4, tmm: 2, moveMode: "jump" })
    const still = mech({ skill: 4, tmm: 3, moveMode: "stand" })
    const medium = attackPreview({
      attacker: walker,
      target: walker,
      rules,
      kind: "weapon",
      range: "medium",
      partial: false,
      woods: false,
      tweak: 0,
    })
    assert.equal(medium.total, 3 + 2 + 2)
    const jumped = attackPreview({
      attacker: jumper,
      target: jumper,
      rules,
      kind: "weapon",
      range: "long",
      partial: true,
      woods: true,
      tweak: 0,
    })
    assert.equal(jumped.lines.find((line) => line.label === "You jumped")?.amount, 2)
    assert.equal(jumped.lines.find((line) => line.label === "Target movement")?.amount, 3)
    assert.equal(defenderTmm(still, rules), 0)
    const stillShot = attackPreview({
      attacker: still,
      target: walker,
      rules,
      kind: "weapon",
      range: "short",
      partial: false,
      woods: false,
      tweak: 0,
    })
    assert.equal(stillShot.lines.find((line) => line.label === "You stood still")?.amount, -1)
  })

  it("tracks overheat, cooling, and shutdown", () => {
    let state = fillCards(boot("heat-scale"))
    state = rollInit(state, "host")
    state = moveWalk(state, "host")
    state = act(state, { type: "water", playerId: "host", inWater: false })
    state = moveWalk(state, "kid")
    state = act(state, { type: "water", playerId: "kid", inWater: false })
    state = act(state, { type: "kind", playerId: "host", kind: "weapon" })
    state = act(state, { type: "target", playerId: "host", targetId: "g0" })
    state = act(state, { type: "range", playerId: "host", range: "medium" })
    state = act(state, { type: "overheat", playerId: "host", amount: 1 })
    state = act(state, { type: "dice", playerId: "host", roll: 10 })
    assert.equal(state.combat?.totalDamage, 5)
    state = act(state, { type: "marked", playerId: "host", result: "armor" })
    state = act(state, { type: "kind", playerId: "kid", kind: "hold" })
    const hammer = state.mechs.find((mech) => mech.name === "Warhammer")
    assert.equal(hammer?.heat, 1)
    assert.equal(state.mechs.find((mech) => mech.name === "Nova")?.heat, 0)

    state = act(state, { type: "confirm", playerId: "host" })
    state = act(state, { type: "confirm", playerId: "kid" })
    state = rollInit(state, "host")
    state = moveWalk(state, "host")
    assert.equal(state.notice, undefined)
    state = act(state, { type: "water", playerId: "host", inWater: false })
    const hotMove = state.mechs.find((mech) => mech.name === "Warhammer")
    assert.ok(hotMove)
    assert.equal(adjustedMove(hotMove, "walk"), 6)
    state = moveWalk(state, "kid")
    state = act(state, { type: "water", playerId: "kid", inWater: false })
    state = act(state, { type: "kind", playerId: "host", kind: "hold" })
    state = act(state, { type: "kind", playerId: "kid", kind: "hold" })
    assert.equal(state.mechs.find((mech) => mech.name === "Warhammer")?.heat, 0)
  })

  it("adds rear damage and a fire-control crit to the next shot", () => {
    let state = fillCards(boot("breaks"))
    state = rollInit(state, "host")
    state = moveWalk(state, "host")
    state = moveWalk(state, "kid")
    state = act(state, { type: "kind", playerId: "host", kind: "weapon" })
    state = act(state, { type: "target", playerId: "host", targetId: "g0" })
    state = act(state, { type: "range", playerId: "host", range: "short" })
    state = act(state, { type: "dice", playerId: "host", roll: 9 })
    state = act(state, { type: "yesNo", playerId: "host", field: "rear", yes: true })
    assert.equal(state.combat?.totalDamage, 6)
    state = act(state, { type: "marked", playerId: "host", result: "structure" })
    assert.equal(state.step, "crit")
    state = act(state, { type: "crit", playerId: "host", effect: "fireControl" })
    state = act(state, { type: "kind", playerId: "kid", kind: "hold" })
    state = act(state, { type: "confirm", playerId: "host" })
    state = act(state, { type: "confirm", playerId: "kid" })
    state = rollInit(state, "kid")
    state = moveWalk(state, "kid")
    state = moveWalk(state, "host")
    state = act(state, { type: "kind", playerId: "kid", kind: "weapon" })
    state = act(state, { type: "target", playerId: "kid", targetId: "h0" })
    state = act(state, { type: "range", playerId: "kid", range: "short" })
    assert.equal(state.combat?.lines.find((line) => line.label === "Fire control damage")?.amount, 2)
  })

  it("punches for size and will not let a sprint shoot", () => {
    let state = fillCards(boot("the-whole-turn"))
    state = rollInit(state, "host")
    state = act(state, { type: "pickMech", playerId: "host", mechId: "h0" })
    state = act(state, { type: "moveMode", playerId: "host", mode: "sprint" })
    state = act(state, { type: "continue", playerId: "host" })
    state = act(state, { type: "terrain", playerId: "host", ok: true })
    state = act(state, { type: "water", playerId: "host", inWater: false })
    state = act(state, { type: "pickMech", playerId: "kid", mechId: "g0" })
    state = act(state, { type: "moveMode", playerId: "kid", mode: "walk" })
    state = act(state, { type: "continue", playerId: "kid" })
    state = act(state, { type: "terrain", playerId: "kid", ok: true })
    state = act(state, { type: "water", playerId: "kid", inWater: false })
    state = act(state, { type: "moveMode", playerId: "host", mode: "walk" })
    state = act(state, { type: "continue", playerId: "host" })
    state = act(state, { type: "terrain", playerId: "host", ok: true })
    state = act(state, { type: "water", playerId: "host", inWater: false })
    state = act(state, { type: "moveMode", playerId: "kid", mode: "walk" })
    state = act(state, { type: "continue", playerId: "kid" })
    state = act(state, { type: "terrain", playerId: "kid", ok: true })
    state = act(state, { type: "water", playerId: "kid", inWater: false })
    assert.equal(state.phase, "combat")
    assert.equal(state.step, "pass")
    state = act(state, { type: "continue", playerId: "host" })
    state = act(state, { type: "kind", playerId: "kid", kind: "physical" })
    state = act(state, { type: "target", playerId: "kid", targetId: "h1" })
    state = act(state, { type: "yesNo", playerId: "kid", field: "contact", yes: true })
    state = act(state, { type: "yesNo", playerId: "kid", field: "partial", yes: false })
    state = act(state, { type: "yesNo", playerId: "kid", field: "woods", yes: false })
    assert.equal(state.step, "roll")
    state = act(state, { type: "dice", playerId: "kid", roll: 10 })
    state = act(state, { type: "yesNo", playerId: "kid", field: "rear", yes: false })
    assert.equal(state.combat?.totalDamage, 3)
    state = act(state, { type: "marked", playerId: "kid", result: "armor" })
    assert.equal(state.mechs.find((mech) => mech.id === "h0")?.shotThisTurn, false)
  })
})

describe("movement math", () => {
  it("cuts move for heat and MP hits, and stretches a sprint", () => {
    const mech = {
      walkInches: 10,
      jumpInches: 8,
      heat: 2,
      mpHits: 1,
    } as Mech
    assert.equal(adjustedMove(mech, "walk"), 1)
    assert.equal(adjustedMove(mech, "sprint"), 2)
    assert.equal(adjustedMove(mech, "jump"), 4)
  })
})

function finishQuietTurn(state: GameState, low: "host" | "kid"): GameState {
  state = rollInit(state, low)
  const order = [state.lowPlayerId, state.highPlayerId, state.lowPlayerId, state.highPlayerId]
  for (const playerId of order) {
    if (state.phase !== "move" || !playerId) break
    if (state.step === "pick") {
      const nextId = state.mechs.find(
        (mech) => mech.ownerId === playerId && !mech.knockedOut && !state.moveOrder.includes(mech.id),
      )?.id
      assert.ok(nextId)
      state = act(state, { type: "pickMech", playerId, mechId: nextId })
    }
    if (state.step === "mode") state = act(state, { type: "moveMode", playerId, mode: "walk" })
    if (state.step === "placed") state = act(state, { type: "continue", playerId })
    if (state.step === "cover") state = act(state, { type: "cover", playerId, touching: false })
  }
  assert.equal(state.phase, "combat")
  while (state.phase === "combat") {
    const mech = state.mechs.find((item) => item.id === state.activeMechId)
    assert.ok(mech)
    if (state.step === "pass") {
      state = act(state, { type: "continue", playerId: mech.ownerId })
      continue
    }
    state = act(state, { type: "kind", playerId: mech.ownerId, kind: mech.ownerId === "host" ? "weapon" : "hold" })
    if (state.phase !== "combat") break
    if (state.step === "target") {
      const enemy = state.mechs.find((item) => item.ownerId !== mech.ownerId && !item.knockedOut)
      assert.ok(enemy)
      state = act(state, { type: "target", playerId: mech.ownerId, targetId: enemy.id })
      state = act(state, { type: "range", playerId: mech.ownerId, range: "medium" })
      state = act(state, { type: "dice", playerId: mech.ownerId, roll: 2 })
      if (state.step === "miss") state = act(state, { type: "continue", playerId: mech.ownerId })
    }
  }
  return state
}

function heatText(state: GameState): string {
  return state.mechs.map((mech) => `${mech.name}:${mech.hot ? "Hot" : "cool"}`).join(" ")
}

describe("handoff", () => {
  it("opens the named seat on a new device without adding a player", () => {
    const started = boot("first-steps")
    const version = started.version
    const claimed = claimSeat(started, { playerId: "ipad-device", name: "sam" })
    assert.equal(claimed.playerId, "kid")
    assert.equal(claimed.state, started)
    assert.equal(claimed.state.version, version)
    assert.equal(claimed.state.players.length, 2)
  })

  it("still sits a new name down when a seat is open", () => {
    const lobby = createGame({
      code: "TEST",
      scenarioId: "first-steps",
      hostId: "host",
      hostName: "Wes",
      faction: "innerSphere",
    })
    const claimed = claimSeat(lobby, { playerId: "ipad-device", name: "Sam" })
    assert.equal(claimed.playerId, "ipad-device")
    assert.equal(claimed.state.players.length, 2)
    assert.equal(claimed.state.players[1].name, "Sam")
  })

  it("refuses a new name once both seats are taken", () => {
    const started = boot("first-steps")
    assert.throws(
      () => claimSeat(started, { playerId: "ipad-device", name: "Alex" }),
      (error: unknown) => error instanceof RuleError && error.message === "This game has already started.",
    )
  })
})

function game(scenarioId: string): GameState {
  return createGame({
    code: "MATH",
    scenarioId,
    hostId: "host",
    hostName: "Wes",
    faction: "innerSphere",
  })
}

function mech(partial: Partial<Mech>): Mech {
  return {
    id: "m",
    name: "Test",
    variant: "WHM-8R",
    ownerId: "host",
    knockedOut: false,
    heat: 0,
    hot: false,
    shutdown: false,
    fireControlHits: 0,
    weaponHits: 0,
    engineHits: 0,
    mpHits: 0,
    touchingCover: false,
    inWater: false,
    shotThisTurn: false,
    overheatUsed: 0,
    ...partial,
  }
}
