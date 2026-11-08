export type Speaker = "narrator" | "lyran" | "falcon" | "garrison" | "galaxy" | "coach"

export const SPEAKERS: Speaker[] = ["narrator", "lyran", "falcon", "garrison", "galaxy", "coach"]

export const SPEAKER_LABEL: Record<Speaker, string> = {
  narrator: "Narrator",
  lyran: "Lyran lieutenant",
  falcon: "Falcon star commander",
  garrison: "Garrison Command",
  galaxy: "Galaxy Command",
  coach: "Coach",
}

// `voice` is what a recording says. An empty string means the line is shown but never spoken,
// which is how "Lieutenant {is}:" style labels stay on screen without being read out.
export type Line = { who: Speaker; text: string; voice?: string }

// What the browser gets: `say` has the real names for the browser voice, `key` finds the recording.
export type VoiceLine = { who: Speaker; say: string; key: string }

const make =
  (who: Speaker) =>
  (text: string, voice?: string): Line =>
    voice === undefined ? { who, text } : { who, text, voice }

export const narrator = make("narrator")
export const lyran = make("lyran")
export const falcon = make("falcon")
export const garrison = make("garrison")
export const galaxy = make("galaxy")
export const tag = (text: string, voice = ""): Line => ({ who: "narrator", text, voice })

// Games saved before scripts existed still carry the story as one string.
export function toText(lines: readonly Line[] | string): string {
  if (typeof lines === "string") return lines
  return lines.map((line) => line.text).join(" ")
}

export function toLines(lines: readonly Line[] | string): Line[] {
  if (typeof lines === "string") return [narrator(lines)]
  return [...lines]
}

const SLOTS: [RegExp, string][] = [
  [/Lieutenant \{is\}/g, "the Lieutenant"],
  [/Star Commander \{clan\}/g, "the Star Commander"],
  [/\{is\}/g, "the Lieutenant"],
  [/\{clan\}/g, "the Star Commander"],
]

export function unquote(text: string): string {
  return text.replaceAll('"', "").replace(/\s+/g, " ").trim()
}

export function spokenText(line: Line): string {
  if (line.voice !== undefined) return unquote(line.voice)
  let text = unquote(line.text)
  for (const [pattern, callsign] of SLOTS) text = text.replace(pattern, callsign)
  return text.replace(/(^|[.!?]\s+)the /g, (_match, lead: string) => `${lead}The `)
}
