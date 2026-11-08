import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { BOX_INVENTORY, PIECE_GAP, type Layout, type TerrainKind } from "../scenario-gen/layout"
import { applyAction, createGame } from "./flow"
import { MISSIONS } from "./missions"
import { planMove, prepareCoach } from "./opponent"
import { present } from "./present"
import { getScenario } from "./scenarios"

function solo(scenarioId: string, faction: "innerSphere" | "clan" = "innerSphere") {
  return createGame({ code: "MISN", scenarioId, hostId: "host", hostName: "Sam", faction, solo: true })
}

function inside(point: { x: number; y: number }, piece: { x: number; y: number; w: number; h: number }) {
  return point.x >= piece.x && point.x <= piece.x + piece.w && point.y >= piece.y && point.y <= piece.y + piece.h
}

function layoutOf(id: string): Layout {
  const layout = getScenario(id)?.layout
  assert.ok(layout, `${id} has a fixed layout`)
  return layout
}

describe("mission pack", () => {
  it("has one mission per objective type, all in the catalog", () => {
    assert.deepEqual(
      MISSIONS.map((mission) => mission.id),
      ["ridge-road", "listening-post", "supply-drop", "through-the-gash"],
    )
    for (const mission of MISSIONS) assert.equal(getScenario(mission.id), mission)
    assert.equal(layoutOf("ridge-road").objectives.length, 0)
    assert.equal(layoutOf("listening-post").objectives.length, 1)
    assert.equal(layoutOf("supply-drop").objectives.length, 2)
    assert.equal(layoutOf("through-the-gash").objectives[0]?.kind, "exit")
  })

  it("keeps every piece on the table, out of the home strips, and apart", () => {
    for (const mission of MISSIONS) {
      const layout = layoutOf(mission.id)
      for (const piece of layout.pieces) {
        assert.ok(piece.x >= PIECE_GAP && piece.x + piece.w <= layout.width - PIECE_GAP, `${mission.id} ${piece.id} x`)
        assert.ok(piece.y >= layout.zoneDepth && piece.y + piece.h <= layout.depth - layout.zoneDepth, `${mission.id} ${piece.id} y`)
      }
      layout.pieces.forEach((a, index) => {
        for (const b of layout.pieces.slice(index + 1)) {
          const apart =
            a.x >= b.x + b.w + PIECE_GAP || b.x >= a.x + a.w + PIECE_GAP || a.y >= b.y + b.h + PIECE_GAP || b.y >= a.y + a.h + PIECE_GAP
          assert.ok(apart, `${mission.id} ${a.id} and ${b.id} overlap`)
        }
      })
    }
  })

  it("uses only the terrain in the box and keeps beacons out of buildings", () => {
    for (const mission of MISSIONS) {
      const layout = layoutOf(mission.id)
      const counts = new Map<TerrainKind, number>()
      for (const piece of layout.pieces) counts.set(piece.kind, (counts.get(piece.kind) ?? 0) + 1)
      for (const [kind, count] of counts) assert.ok(count <= BOX_INVENTORY[kind], `${mission.id} uses ${count} ${kind}`)
      for (const objective of layout.objectives.filter((item) => item.kind === "hold")) {
        assert.ok(!layout.pieces.some((piece) => piece.blocksLos && inside(objective, piece)), `${mission.id} ${objective.id}`)
      }
      assert.equal(mission.terrain.length, layout.pieces.length + layout.objectives.length, `${mission.id} placement steps`)
      assert.deepEqual(mission.objectives?.map((item) => item.id), layout.objectives.map((item) => item.id))
    }
  })

  it("starts a solo game on the mission map with both lances deployed", () => {
    for (const mission of MISSIONS) {
      const state = solo(mission.id)
      assert.deepEqual(state.layout, mission.layout, mission.id)
      assert.notEqual(state.layout, mission.layout, `${mission.id} copies the layout`)
      const coach = state.mechs.filter((mech) => mech.ownerId === "coach")
      assert.equal(coach.length, mission.forces.clan.length, mission.id)
      assert.ok(coach.every((mech) => mech.x != null && mech.y != null), mission.id)
    }
  })

  it("starts a two-player game on the mission map too", () => {
    const state = createGame({ code: "PAIR", scenarioId: "supply-drop", hostId: "host", hostName: "Sam", faction: "clan" })
    assert.equal(state.layout?.pieces.length, layoutOf("supply-drop").pieces.length)
    assert.equal(state.solo, undefined)
  })
})

describe("the coach on a mission map", () => {
  it("never plans a walk into or through a building", () => {
    for (const mission of MISSIONS) {
      const state = solo(mission.id)
      const solids = state.layout?.pieces.filter((piece) => piece.blocksLos) ?? []
      for (const mech of state.mechs.filter((item) => item.ownerId === "coach")) {
        const plan = planMove(state, mech)
        assert.ok(!solids.some((piece) => inside(plan, piece)), `${mission.id} ${mech.name} ends inside a building`)
        if (plan.mode === "walk" || plan.mode === "sprint") {
          const from = { x: mech.x ?? 0, y: mech.y ?? 0 }
          for (let step = 1; step < 12; step += 1) {
            const t = step / 12
            const point = { x: from.x + (plan.x - from.x) * t, y: from.y + (plan.y - from.y) * t }
            assert.ok(!solids.some((piece) => inside(point, piece)), `${mission.id} ${mech.name} walks through a building`)
          }
        }
      }
    }
  })

  it("sends a second mech to the other crate", () => {
    const state = solo("supply-drop")
    const [first, second] = state.mechs.filter((mech) => mech.ownerId === "coach")
    const crates = state.layout?.objectives ?? []
    assert.ok(first && second && crates.length === 2)
    const [west, east] = crates
    assert.ok((second.x ?? 0) > 24, "the second mech starts on the east side")
    first.x = east.x
    first.y = east.y
    const before = Math.hypot((second.x ?? 0) - west.x, (second.y ?? 0) - west.y)
    const plan = planMove(state, second)
    const after = Math.hypot(plan.x - west.x, plan.y - west.y)
    assert.ok(after < before, "it heads for the west crate the first mech left open")
  })

  it("runs for the far edge and claims the exit when it gets there", () => {
    const state = solo("through-the-gash")
    const moth = state.mechs.find((mech) => mech.ownerId === "coach" && mech.name === "Fire Moth")
    assert.ok(moth?.y != null)
    const plan = planMove(state, moth)
    assert.ok(plan.y < moth.y, "the coach is the guest, so its far edge is y = 0")

    state.phase = "end"
    state.step = "beacon"
    state.beaconAnswers = {}
    assert.deepEqual(prepareCoach(state), { type: "beacon", playerId: "coach", alone: false })
    moth.y = 1
    assert.deepEqual(prepareCoach(state), { type: "beacon", playerId: "coach", alone: true })
  })

  it("scores each crate on its own at the end of the turn", () => {
    const state = solo("supply-drop")
    const coachMech = state.mechs.find((mech) => mech.ownerId === "coach")
    const crates = state.layout?.objectives ?? []
    assert.ok(coachMech && crates.length === 2)
    coachMech.x = crates[1].x
    coachMech.y = crates[1].y
    state.phase = "end"
    state.step = "beacon"
    state.beaconAnswers = {}
    state.objectiveIndex = 0
    assert.deepEqual(prepareCoach(state), { type: "beacon", playerId: "coach", alone: false })
    state.objectiveIndex = 1
    assert.deepEqual(prepareCoach(state), { type: "beacon", playerId: "coach", alone: true })
  })
})

describe("mission interludes", () => {
  it("shows the radio chatter when turn 2 starts and not on turn 1", () => {
    const mission = MISSIONS[0]
    const state = solo(mission.id)
    state.phase = "initiative"
    state.step = "roll"
    state.initiative = {}
    state.turn = 1
    assert.equal(present(state, "host").interlude, undefined)
    state.turn = 2
    const screen = present(state, "host")
    assert.equal(screen.interlude?.title, "Radio, turn 2")
    assert.match(screen.interlude?.text ?? "", /Garrison Command/)
    assert.ok((screen.voice?.interlude?.length ?? 0) >= 2)
    const rolled = applyAction(state, { type: "initiative", playerId: "host", roll: 7 })
    assert.notEqual(rolled.version, state.version)
  })
})
