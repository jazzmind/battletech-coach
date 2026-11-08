import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createGame } from "./flow"
import { mustScenario } from "./scenarios"

const WITH_TERRAIN = ["streets", "beacon", "trees-and-walls", "the-whole-turn"]

describe("lesson tables", () => {
  for (const id of WITH_TERRAIN) {
    it(`${id} puts buildings and trees on the map`, () => {
      const scenario = mustScenario(id)
      const pieces = scenario.layout?.pieces ?? []
      assert.ok(pieces.some((piece) => piece.kind === "largeBuilding"))
      assert.ok(pieces.some((piece) => piece.kind === "tree"))
      const state = createGame({ code: "MAP1", scenarioId: id, hostId: "host", hostName: "Wes", faction: "innerSphere" })
      assert.equal(state.layout?.pieces.length, pieces.length)
      for (const piece of pieces) {
        assert.ok(piece.x >= 1 && piece.y >= 6, `${piece.id} is on the table`)
        assert.ok(piece.x + piece.w <= 47 && piece.y + piece.h <= 30, `${piece.id} stays off the home edge`)
      }
    })
  }

  it("keeps the beacon off the buildings", () => {
    const beacon = mustScenario("beacon").layout?.objectives.find((item) => item.kind === "hold")
    assert.ok(beacon)
    const covered = mustScenario("beacon").layout?.pieces.some(
      (piece) =>
        piece.blocksLos &&
        beacon.x >= piece.x &&
        beacon.x <= piece.x + piece.w &&
        beacon.y >= piece.y &&
        beacon.y <= piece.y + piece.h,
    )
    assert.equal(covered, false)
  })
})
