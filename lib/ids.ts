const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function makeCode(): string {
  const { randomInt } = require("node:crypto") as { randomInt: (max: number) => number }
  let code = ""
  for (let index = 0; index < 4; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)]
  }
  return code
}

export function savePlayerId(playerId: string): void {
  localStorage.setItem("mech-coach-player", playerId)
}

export function loadPlayerId(): string {
  const key = "mech-coach-player"
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const created = crypto.randomUUID()
  savePlayerId(created)
  return created
}
