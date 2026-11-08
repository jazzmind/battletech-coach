import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { BOX_INVENTORY, generateLayout, type ObjectiveType, type PickupInventory } from "./layout"
import { pickupScenario } from "./scenario"

const empty: PickupInventory = {
  largeBuilding: 0,
  smallBuilding: 0,
  tree: 0,
  hill: 0,
  water: 0,
  rough: 0,
  woods: 0,
  wall: 0,
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

describe("scenario generator", () => {
  it("repeats a layout for the same seed", () => {
    const first = generateLayout({ table: "3x4", inventory: BOX_INVENTORY, objective: "center", seed: "table-7" })
    const second = generateLayout({ table: "3x4", inventory: BOX_INVENTORY, objective: "center", seed: "table-7" })
    assert.deepEqual(first, second)
  })

  it("uses only owned pieces, stays on the table, and mirrors", () => {
    const layout = generateLayout({ table: "4x6", inventory: BOX_INVENTORY, objective: "markers", seed: "owned" })
    assert.ok(layout.pieces.length > 0)
    assert.ok(layout.pieces.some((piece) => piece.blocksLos))
    const counts = new Map<string, number>()
    for (const piece of layout.pieces) {
      counts.set(piece.kind, (counts.get(piece.kind) ?? 0) + 1)
      assert.ok(piece.x >= 0 && piece.y >= layout.zoneDepth)
      assert.ok(piece.x + piece.w <= layout.width)
      assert.ok(piece.y + piece.h <= layout.depth - layout.zoneDepth)
      assert.ok(counts.get(piece.kind)! <= BOX_INVENTORY[piece.kind])
    }
    for (let i = 0; i < layout.pieces.length; i += 1) {
      for (let j = i + 1; j < layout.pieces.length; j += 1) {
        assert.equal(overlaps(layout.pieces[i], layout.pieces[j]), false)
      }
    }
    for (const piece of layout.pieces.filter((item) => item.role === "host")) {
      const mirror = layout.pieces.find(
        (item) =>
          item.role === "guest" &&
          item.kind === piece.kind &&
          item.x === layout.width - piece.x - piece.w &&
          item.y === layout.depth - piece.y - piece.h,
      )
      assert.ok(mirror)
    }
    for (const objective of layout.objectives) {
      const buried = layout.pieces.some(
        (piece) =>
          (piece.kind === "largeBuilding" || piece.kind === "smallBuilding") &&
          objective.x >= piece.x &&
          objective.x <= piece.x + piece.w &&
          objective.y >= piece.y &&
          objective.y <= piece.y + piece.h,
      )
      assert.equal(buried, false)
    }
  })

  it("can leave the table clear when nothing is owned", () => {
    const layout = generateLayout({ table: "3x3", inventory: empty, objective: "fight", seed: "bare" })
    assert.equal(layout.pieces.length, 0)
  })

  it("reaches every objective", () => {
    const kinds: ObjectiveType[] = ["fight", "center", "markers", "breakthrough"]
    for (const objective of kinds) {
      const layout = generateLayout({ table: "3x4", inventory: BOX_INVENTORY, objective, seed: objective })
      const scenario = pickupScenario(layout, objective)
      if (objective === "fight") assert.equal(scenario.rules.beacon, false)
      if (objective === "center") assert.equal(layout.objectives.filter((item) => item.kind === "hold").length, 1)
      if (objective === "markers") assert.ok(layout.objectives.filter((item) => item.kind === "hold").length >= 2)
      if (objective === "breakthrough") assert.equal(layout.objectives[0]?.kind, "exit")
      assert.ok(scenario.terrain.length >= layout.pieces.length)
    }
  })
})
