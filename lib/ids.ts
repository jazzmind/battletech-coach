const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("")
}

export function loadPlayerId(): string {
  const key = "mech-coach-player"
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const created = crypto.randomUUID()
  localStorage.setItem(key, created)
  return created
}
