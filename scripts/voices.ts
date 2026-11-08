// Pick a HeyGen voice for each speaker.
//   npm run voices                       list public English voices
//   npm run voices -- --previews         also save each preview clip to .voices/ to listen
//   npm run voices -- --set falcon=<id>  cast a voice (writes lib/voice/cast.ts)
//   npm run voices -- --sample falcon    say that speaker's first line in its cast voice
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { SPEAKERS, spokenText, type Speaker } from "../lib/game/script"
import { CAST } from "../lib/voice/cast"
import { everyLine, voicedScenarios } from "../lib/voice/lines"
import { ROOT, download, heygen } from "./heygen"

type Voice = { voice_id: string; name: string; language?: string | null; status: string; preview_audio_url?: string | null }

const args = process.argv.slice(2)
const OUT = path.join(ROOT, ".voices")

async function publicVoices(): Promise<Voice[]> {
  const voices: Voice[] = []
  let token: string | null | undefined
  do {
    const query = new URLSearchParams({ type: "public", limit: "100" })
    if (token) query.set("token", token)
    const page = await heygen<{ data: Voice[]; has_more: boolean; next_token?: string | null }>(`/v3/models/audio/voices?${query}`)
    voices.push(...page.data)
    token = page.has_more ? page.next_token : null
  } while (token)
  return voices.filter((voice) => voice.status === "ACTIVE" && (!voice.language || voice.language.startsWith("en")))
}

function setCast(speaker: Speaker, voiceId: string) {
  const file = path.join(ROOT, "lib/voice/cast.ts")
  const source = readFileSync(file, "utf8")
  const block = new RegExp(`(\\n  ${speaker}: \\{\\n    heygen: )"[^"]*"`)
  if (!block.test(source)) throw new Error(`Could not find ${speaker} in cast.ts`)
  writeFileSync(file, source.replace(block, `$1"${voiceId}"`))
  console.log(`${speaker} now speaks with ${voiceId}. Run npm run voice to record the lines.`)
}

async function sample(speaker: Speaker) {
  const voiceId = CAST[speaker].heygen
  if (!voiceId) throw new Error(`${speaker} has no voice yet. Use --set ${speaker}=<voice_id> first.`)
  const line = everyLine(voicedScenarios()).find((item) => item.line.who === speaker)
  const text = line ? spokenText(line.line) : "Garrison Command, all units. Stand by."
  const result = await heygen<{ data: { audio_url: string } }>("/v3/models/audio/tts", {
    method: "POST",
    body: JSON.stringify({
      model: "heygen-voice-1-turbo-free",
      voice_id: voiceId,
      text,
      language: "en",
      output_format: { encoding: "mp3", sample_rate_hertz: 44100, bitrate_bps: 128000 },
    }),
  })
  mkdirSync(OUT, { recursive: true })
  const file = path.join(OUT, `sample-${speaker}.mp3`)
  writeFileSync(file, await download(result.data.audio_url))
  console.log(`${speaker}: "${text}"\n  ${file}`)
}

async function main() {
  const set = args.indexOf("--set")
  if (set >= 0) {
    const [speaker, voiceId] = (args[set + 1] ?? "").split("=")
    if (!SPEAKERS.includes(speaker as Speaker) || !voiceId) throw new Error(`Use --set <${SPEAKERS.join("|")}>=<voice_id>`)
    return setCast(speaker as Speaker, voiceId)
  }
  const sampleAt = args.indexOf("--sample")
  if (sampleAt >= 0) return sample(args[sampleAt + 1] as Speaker)

  const voices = await publicVoices()
  const previews = args.includes("--previews")
  if (previews) mkdirSync(OUT, { recursive: true })
  for (const voice of voices) {
    console.log(`${voice.voice_id}  ${voice.name}${voice.language ? ` (${voice.language})` : ""}`)
    if (previews && voice.preview_audio_url) {
      const name = voice.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
      writeFileSync(path.join(OUT, `${name}-${voice.voice_id}.wav`), await download(voice.preview_audio_url))
    }
  }
  console.log(`\n${voices.length} voices.${previews ? ` Previews are in ${OUT}.` : ""}`)
  console.log("Current cast:")
  for (const speaker of SPEAKERS) console.log(`  ${speaker.padEnd(9)} ${CAST[speaker].heygen || "(browser voice only)"}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
