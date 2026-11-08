import type { VoiceLine } from "../game/script"
import type { Screen } from "../game/types"

export type AudioSettings = { story: boolean; steps: boolean }

// Story audio covers the scenario's own words: briefing, interludes, ending.
// Step reading is the assistive half: the coach's instruction for this tap.
export function autoLines(screen: Screen, audio: AudioSettings, view: "watch" | "read" = "read"): VoiceLine[] {
  const voice = screen.voice
  if (view === "watch") {
    return audio.steps && screen.say ? [{ who: "coach", say: screen.say, key: "" }] : []
  }
  if (voice?.mission) return audio.story ? voice.mission : []
  const step: VoiceLine[] = audio.steps && screen.say ? [{ who: "coach", say: screen.say, key: "" }] : []
  const before = audio.story ? (voice?.interlude ?? []) : []
  const after = audio.story ? (voice?.ending ?? []) : []
  return [...before, ...step, ...after]
}
