import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { lookPrompt } from "./look"
import type { Screen } from "./types"

function screen(): Screen {
  return {
    code: "TEST",
    version: 1,
    kicker: "Move",
    title: "Warhammer",
    say: "Wes, move the Warhammer up to 8 inches.",
    active: true,
    choices: [],
    hud: {
      scenario: "First Steps",
      turn: "Turn 1",
      rows: [
        { name: "Warhammer", detail: "On the table", mine: true, out: false },
        { name: "Timber Wolf", detail: "On the table", mine: false, out: false },
      ],
    },
  }
}

describe("look prompt", () => {
  it("uses the sentence on screen and this player's mechs", () => {
    const prompt = lookPrompt(screen(), "Wes")
    assert.match(prompt, /Wes, move the Warhammer up to 8 inches/)
    assert.match(prompt, /Wes's mechs are Warhammer/)
    assert.equal(prompt.includes("Timber Wolf"), false)
    assert.match(prompt, /too dark/)
    assert.equal(prompt.includes("sk-"), false)
    assert.equal(prompt.includes("Bearer"), false)
  })
})
