import { checkPrompt, lookPrompt } from "./game/look"
import type { Screen } from "./game/types"
import { shrinkPhoto } from "./photo"

export const VISION_KEY = "mech-coach-xai-key"

export function savedVisionKey(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(VISION_KEY)
}

export async function askVision(input: { image: Blob; screen: Screen; playerName: string }): Promise<string> {
  const image = await shrinkPhoto(input.image)
  const key = savedVisionKey()
  if (key) return askXai(image, key, input.screen, input.playerName)
  return askServer(image, input.screen)
}

async function askXai(image: string, key: string, screen: Screen, playerName: string): Promise<string> {
  const prompt = screen.check ? checkPrompt(screen.check.mech) : lookPrompt(screen, playerName)
  const response = await fetch("/api/look", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ image, prompt }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? "The look did not come back.")
  return typeof data.text === "string" ? data.text : "The look came back empty."
}

async function askServer(image: string, screen: Screen): Promise<string> {
  const body = screen.check
    ? { image, mech: screen.check.mech }
    : {
        image,
        mechs: screen.hud.rows
          .filter((row) => !row.out)
          .sort((a, b) => Number(b.mine) - Number(a.mine))
          .map((row) => row.name)
          .slice(0, 8),
      }
  const response = await fetch("/api/see", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? "I can't tell from here.")
  return typeof data.text === "string" ? data.text : "I can't tell from here."
}
