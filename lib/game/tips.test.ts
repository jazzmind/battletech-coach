import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { MINIS, mustFace } from "./cards"
import { applyAction, createGame, currentCard } from "./flow"
import { present } from "./present"
import { SCENARIOS } from "./scenarios"
import { MECH_LORE, tipFor } from "./tips"
import type { Action, GameState, Screen } from "./types"

function act(state: GameState, action: Action): GameState {
  return applyAction(state, action)
}

function seated(scenarioId: string): GameState {
  let state = createGame({
    code: "TEST",
    scenarioId,
    hostId: "host",
    hostName: "Wes",
    faction: "innerSphere",
  })
  return act(state, { type: "join", playerId: "kid", name: "Sam" })
}

function press(state: GameState): GameState {
  for (const playerId of ["host", "kid"]) {
    const screen = present(state, playerId)
    if (!screen.active) continue
    if (screen.choices[0]) return act(state, screen.choices[0].action)
    const pad = screen.pad
    if (!pad) continue
    if (pad.kind === "initiative") {
      return act(state, { type: "initiative", playerId, roll: playerId === "host" ? 3 : 9 })
    }
    if (pad.kind === "card") {
      const current = currentCard(state)
      assert.ok(current)
      const card = mustFace(current.mech.variant)
      const value =
        current.field === "walk"
          ? card.walk
          : current.field === "armor"
            ? card.armor
            : current.field === "structure"
              ? card.structure
              : current.field === "tmm"
                ? card.tmm
                : current.field === "ov"
                  ? card.ov
                  : current.field === "size"
                    ? card.size
                    : card.jump ?? 1
      return act(state, { type: "card", playerId, field: current.field, value })
    }
    if (pad.kind === "overheat") return act(state, { type: "overheat", playerId, amount: 0 })
    if (pad.kind === "dice") return act(state, { type: "dice", playerId, roll: 12 })
    if (pad.kind === "jump") return act(state, { type: "jumpInches", playerId, inches: pad.min })
    if (pad.kind === "band") return act(state, { type: "band", playerId, amount: 1 })
    if (pad.kind === "star") return act(state, { type: "star", playerId, roll: 4 })
  }
  throw new Error(`stuck at ${state.phase}/${state.step}`)
}

function until(state: GameState, done: (state: GameState) => boolean): GameState {
  let guard = 0
  while (!done(state)) {
    state = press(state)
    guard += 1
    if (guard > 80) throw new Error(`loop at ${state.phase}/${state.step}`)
  }
  return state
}

function tipText(screen: Screen | undefined): string {
  if (!screen?.tip) return ""
  return `${screen.tip.title}\n${screen.tip.text}`
}

describe("briefing", () => {
  it("shows each side its own orders and the same goal", () => {
    const state = seated("first-steps")
    assert.equal(state.phase, "briefing")
    const host = present(state, "host")
    const guest = present(state, "kid")
    assert.match(host.say, /Wes/)
    assert.match(host.say, /Sam/)
    assert.match(host.say, /batchall/)
    assert.equal(host.mission?.goal, guest.mission?.goal)
    assert.match(host.mission?.goal ?? "", /Nobody loses/)
    assert.match(host.mission?.orders ?? "", /Answer the batchall/)
    assert.match(guest.mission?.orders ?? "", /Issue the batchall/)
    assert.notEqual(host.mission?.orders, guest.mission?.orders)
    assert.equal(host.hud.goal, "Two turns, then both pull back. Nobody loses.")
    assert.match(host.lessonKicker ?? "", /New rule today/)
  })

  it("matches the goal to the way the scenario actually ends", () => {
    for (const scenario of SCENARIOS) {
      assert.match(scenario.chapter, /^Chapter \d+: /)
      assert.notEqual(scenario.sides.innerSphere.orders, scenario.sides.clan.orders)
      assert.ok(scenario.sides.innerSphere.plan.length >= 2)
      assert.ok(scenario.sides.clan.plan.length >= 2)
      assert.ok(scenario.ending.innerSphere.length > 0)
      assert.ok(scenario.ending.clan.length > 0)
      assert.ok(scenario.ending.draw.length > 0)
      if (scenario.rules.retreat) {
        assert.match(scenario.goal, /pull back/)
        assert.match(scenario.goal, /Nobody loses/)
      } else if (scenario.rules.beacon) {
        assert.match(scenario.goal, /beacon/)
        assert.match(scenario.goal, new RegExp(String(scenario.beaconGoal)))
        assert.match(scenario.goal, /Knocking out every enemy mech/)
        const state = seated(scenario.id)
        assert.match(present(state, "host").hud.goal, new RegExp(`First to ${scenario.beaconGoal}`))
        assert.match(present(state, "host").hud.goal, /Wes 0/)
        assert.match(present(state, "host").hud.goal, /Sam 0/)
      } else {
        assert.equal(scenario.goal, "Knock out every enemy mech.")
        assert.equal(present(seated(scenario.id), "host").hud.goal, "Knock out every enemy mech.")
      }
    }
  })
})

describe("mech tips", () => {
  it("has lore and both card sides for every mini", () => {
    for (const mini of MINIS) {
      const lore = MECH_LORE[mini.name]
      assert.ok(lore, mini.name)
      assert.ok(lore.lore.length > 20)
      assert.ok(lore.role.length > 5)
      for (const face of mini.faces) assert.ok(lore.variants[face.id], face.id)
    }
  })

  it("keeps TMM and jump modifiers off until those rules are on", () => {
    for (const scenario of SCENARIOS.filter((item) => item.group === "teaching")) {
      let state = seated(scenario.id)
      const lines: string[] = []
      const snap = () => {
        lines.push(tipText(present(state, "host")))
        lines.push(tipText(present(state, "kid")))
      }
      let guard = 0
      while (!(state.phase === "combat" && state.step === "range")) {
        snap()
        state = press(state)
        guard += 1
        if (guard > 80) throw new Error(`${scenario.id} stuck at ${state.phase}/${state.step}`)
      }
      snap()
      const blob = lines.join("\n")
      assert.doesNotMatch(blob, /\bTMM\b/, scenario.id)
      if (!scenario.rules.realJump) assert.doesNotMatch(blob, /2 harder/, scenario.id)
      if (!scenario.rules.teachingJump && !scenario.rules.realJump) assert.doesNotMatch(blob, /jump/i, scenario.id)
    }
  })

  it("gives a swapped mech its own tip", () => {
    let state = seated("they-moved")
    state = act(state, { type: "confirm", playerId: "host" })
    state = act(state, { type: "confirm", playerId: "kid" })
    state = act(state, { type: "swap", playerId: "host", mechId: "h0", name: "Atlas" })
    state = until(state, (current) => current.phase === "move" && current.step === "mode" && current.activeMechId === "h0")
    const tip = present(state, "host").tip
    assert.match(tip?.title ?? "", /Atlas/)
    assert.match(tip?.text ?? "", /Standing still makes your shot 1 easier/)
    assert.doesNotMatch(`${tip?.title} ${tip?.text}`, /Wasp/)

    let teaching = seated("first-steps")
    teaching = act(teaching, { type: "confirm", playerId: "host" })
    teaching = act(teaching, { type: "confirm", playerId: "kid" })
    teaching = act(teaching, { type: "swap", playerId: "host", mechId: "h0", name: "Atlas" })
    teaching = until(teaching, (current) => current.phase === "combat" && current.step === "kind")
    const quiet = tipText(present(teaching, "host"))
    assert.match(quiet, /Atlas/)
    assert.doesNotMatch(quiet, /Standing still|TMM|jump/i)
  })

  it("warns the Nova about overheat 4", () => {
    let state = seated("heat-scale")
    state = until(state, (current) => current.phase === "combat" && current.step === "kind")
    state = act(state, { type: "kind", playerId: "host", kind: "hold" })
    state = until(state, (current) => current.step === "overheat")
    const nova = state.mechs.find((mech) => mech.id === state.activeMechId)
    assert.equal(nova?.name, "Nova")
    const tip = present(state, "kid").tip
    assert.match(tip?.title ?? "", /Nova/)
    assert.match(tip?.text ?? "", /4/)
    assert.match(tip?.text ?? "", /shuts you down/)
  })

  it("points at a 0 or a dash in the range boxes", () => {
    let state = seated("they-moved")
    state = until(state, (current) => current.phase === "combat" && current.step === "range")
    const tip = tipFor(state, "host")
    assert.match(tip?.text ?? "", /medium box is 0/)
    assert.match(tip?.text ?? "", /dash/)
    assert.match(tip?.text ?? "", /6 inches/)
  })

  it("introduces the mechs on the gather screen and only on turn 1", () => {
    let state = seated("how-far")
    state = until(state, (current) => current.phase === "gather")
    const intro = present(state, "host").tip
    assert.match(intro?.title ?? "", /Atlas/)
    assert.match(intro?.text ?? "", /afraid/)
    state = until(state, (current) => current.phase === "initiative" && current.turn === 1)
    assert.match(present(state, "host").tip?.title ?? "", /Meet your Atlas/)
    state = until(state, (current) => current.phase === "initiative" && current.turn === 2)
    assert.doesNotMatch(present(state, "host").tip?.title ?? "", /Meet your/)
  })
})
