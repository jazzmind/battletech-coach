import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { decideSee, describeSeen } from "./see"

describe("camera allowance", () => {
  it("allows a normal day", () => {
    const decision = decideSee({ flag: null, dayCount: 12, sinceLastMs: 20_000 })
    assert.equal(decision.result, "allow")
    assert.equal(decision.flag, null)
  })

  it("sets watch at 80 and still allows the look", () => {
    const decision = decideSee({ flag: null, dayCount: 80, sinceLastMs: 20_000 })
    assert.equal(decision.result, "watch")
    assert.equal(decision.flag, "watch")
  })

  it("blocks at 200 and when the account is already blocked", () => {
    const capped = decideSee({ flag: "watch", dayCount: 200, sinceLastMs: 20_000 })
    assert.equal(capped.result, "block")
    assert.equal(capped.flag, "blocked")
    const banned = decideSee({ flag: "blocked", dayCount: 3, sinceLastMs: 20_000 })
    assert.equal(banned.result, "block")
    assert.equal(banned.flag, "blocked")
  })

  it("names the mechs it can see and the ones it cannot", () => {
    const text = describeSeen(["Warhammer", "Timber Wolf", "Wasp"], [0.9, 0.7, 0.2])
    assert.equal(text, "I can see the Warhammer and the Timber Wolf. I can't find the Wasp.")
  })

  it("refuses a photo that arrives inside 8 seconds", () => {
    const decision = decideSee({ flag: null, dayCount: 4, sinceLastMs: 3000 })
    assert.equal(decision.result, "block")
    assert.equal(decision.flag, null)
  })
})
