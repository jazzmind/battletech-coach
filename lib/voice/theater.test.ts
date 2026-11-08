import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { VoiceLine } from "../game/script"
import { buildSegments } from "./theater"

const lines: VoiceLine[] = [
  { who: "narrator", say: "The year is 3050.", key: "n1" },
  { who: "narrator", say: "Play two turns.", key: "n2" },
  { who: "garrison", say: "Answer the batchall.", key: "g1" },
  { who: "narrator", say: "Stay inside 24 inches.", key: "p1" },
  { who: "narrator", say: "Use the short box.", key: "p2" },
  { who: "garrison", say: "The garrison holds.", key: "g2" },
]

const portraits = { garrison: "/art/pilots/garrison.jpg", lyran: "/art/pilots/lyran.jpg" }

describe("story segments", () => {
  it("lets the orders clip absorb the plan lines", () => {
    const segments = buildSegments({ lines, clip: "first-steps.innerSphere", clipAt: 2, clipSpan: 3, portraits })
    assert.equal(segments.length, 4)
    assert.equal(segments[2]?.kind, "video")
    if (segments[2]?.kind === "video") {
      assert.equal(segments[2].id, "first-steps.innerSphere")
      assert.deepEqual(segments[2].lines.map((line) => line.key), ["g1", "p1", "p2"])
    }
  })

  it("lets a line clip win for its own line", () => {
    const segments = buildSegments({
      lines,
      clip: "first-steps.innerSphere",
      clipAt: 2,
      clipSpan: 3,
      lineClips: { g1: { url: "x" } },
      portraits,
    })
    const hit = segments.find((segment) => segment.kind === "video" && segment.lines[0]?.key === "g1")
    assert.equal(hit?.kind, "video")
    if (hit?.kind === "video") {
      assert.equal(hit.id, "line:g1")
      assert.equal(hit.lines.length, 1)
    }
  })

  it("uses the scene art for a narrator, or nothing", () => {
    const withScene = buildSegments({ lines: [lines[0]], scene: "/art/missions/ridge-road.jpg", portraits })
    assert.equal(withScene[0]?.kind, "still")
    if (withScene[0]?.kind === "still") assert.equal(withScene[0].image, "/art/missions/ridge-road.jpg")
    const bare = buildSegments({ lines: [lines[0]], portraits })
    if (bare[0]?.kind === "still") assert.equal(bare[0].image, null)
  })

  it("uses the garrison portrait for a garrison line", () => {
    const segments = buildSegments({ lines: [lines[5]], portraits })
    assert.equal(segments[0]?.kind, "still")
    if (segments[0]?.kind === "still") assert.equal(segments[0].image, "/art/pilots/garrison.jpg")
  })
})
