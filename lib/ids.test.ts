import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { makeCode } from "./ids"

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function rank(code: string): number {
  return [...code].reduce((total, character) => total * ALPHABET.length + ALPHABET.indexOf(character), 0)
}

describe("game codes", () => {
  it("draws a fresh batch instead of one value or a counting walk", () => {
    const codes = Array.from({ length: 30 }, () => makeCode())
    assert.ok(new Set(codes).size > 1)
    const walk = codes.every((code, index) => index === 0 || rank(code) === rank(codes[index - 1]) + 1)
    assert.equal(walk, false)
    for (const code of codes) {
      assert.equal(code.length, 4)
      assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/)
    }
  })
})
