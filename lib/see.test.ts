import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { decideSee } from "./see"

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

  it("refuses a photo that arrives inside 8 seconds", () => {
    const decision = decideSee({ flag: null, dayCount: 4, sinceLastMs: 3000 })
    assert.equal(decision.result, "block")
    assert.equal(decision.flag, null)
  })
})
