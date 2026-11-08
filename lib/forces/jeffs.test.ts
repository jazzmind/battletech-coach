import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { importForce, tmmFromInches } from "./jeffs"

const jeffs = JSON.parse(readFileSync(new URL("./fixtures/jeffs-iic-liao.json", import.meta.url), "utf8"))
const terminal = JSON.parse(readFileSync(new URL("./fixtures/terminal-group.json", import.meta.url), "utf8"))

describe("force import", () => {
  it("reads a real Jeff's Tools save, including a 0* box, and skips vehicles", () => {
    const force = importForce(jeffs)
    const blackjack = force.cards.find((card) => card.name.startsWith("Blackjack"))
    const catapult = force.cards.find((card) => card.name.startsWith("Catapult"))
    assert.ok(blackjack)
    assert.equal(blackjack.long, "star")
    assert.equal(blackjack.short, 2)
    assert.ok(catapult)
    assert.equal(catapult.jump, 8)
    assert.equal(catapult.tmm, tmmFromInches(8))
    assert.ok(force.skipped.some((unit) => unit.type === "vehicle"))
    assert.ok(force.skipped.some((unit) => unit.type === "infantry"))
    assert.equal(force.cards.every((card) => card.unitType === "BM"), true)
  })

  it("reads a Terminal group export of the same units", () => {
    const force = importForce(terminal)
    assert.equal(force.cards.length, 2)
    assert.equal(force.skipped.length, 2)
    assert.equal(force.cards.find((card) => card.name.startsWith("Blackjack"))?.long, "star")
  })
})
