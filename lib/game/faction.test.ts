import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { applyAction, createGame } from "./flow"

describe("joining a battle", () => {
  it("gives the joiner the side the host did not take", () => {
    const state = createGame({
      code: "SIDE",
      scenarioId: "first-steps",
      hostId: "host",
      hostName: "Wes",
      faction: "innerSphere",
    })
    const joined = applyAction(state, { type: "join", playerId: "guest", name: "Sam" })
    assert.equal(joined.players[0]?.faction, "innerSphere")
    assert.equal(joined.players[1]?.faction, "clan")
  })
})
