// Record every scenario line with the cast HeyGen voices.
//   npm run voice              record lines that have no recording yet
//   npm run voice -- --dry     show what would be recorded
//   npm run voice -- --prune   also delete recordings no line uses any more
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"
import { SPEAKERS } from "../lib/game/script"
import { CAST } from "../lib/voice/cast"
import { everyLine, voicedScenarios } from "../lib/voice/lines"
import type { Manifest } from "../lib/voice/manifest"
import { ROOT, download, heygen, sleep } from "./heygen"

const MANIFEST_FILE = path.join(ROOT, "lib/voice/manifest.json")
const AUDIO_DIR = path.join(ROOT, "public/voice")
// Turbo Free allows 30 requests a minute per workspace member.
const SPACING_MS = 2100

const args = process.argv.slice(2)

function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_FILE, "utf8")) as Manifest
}

function saveManifest(manifest: Manifest) {
  const lines = Object.fromEntries(Object.entries(manifest.lines).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(MANIFEST_FILE, `${JSON.stringify({ lines, clips: readManifest().clips }, null, 2)}\n`)
}

async function main() {
  const manifest = readManifest()
  const lines = everyLine(voicedScenarios())
  const cast = lines.filter((item) => CAST[item.line.who].heygen)
  const uncast = SPEAKERS.filter((speaker) => !CAST[speaker].heygen && lines.some((item) => item.line.who === speaker))
  const todo = cast.filter((item) => !manifest.lines[item.key] || !existsSync(path.join(ROOT, "public", manifest.lines[item.key].file)))
  const words = todo.reduce((sum, item) => sum + item.spoken.split(/\s+/).length, 0)

  console.log(`${lines.length} lines. ${cast.length} have a cast voice, ${todo.length} still need recording (${words} words).`)
  if (uncast.length > 0) console.log(`No HeyGen voice yet for: ${uncast.join(", ")}. Those lines stay on the browser voice.`)

  if (args.includes("--prune")) {
    const live = new Set(lines.map((item) => item.key))
    for (const key of Object.keys(manifest.lines)) {
      if (live.has(key)) continue
      const file = path.join(ROOT, "public", manifest.lines[key].file)
      if (existsSync(file)) unlinkSync(file)
      delete manifest.lines[key]
    }
    if (existsSync(AUDIO_DIR)) {
      const used = new Set(Object.values(manifest.lines).map((item) => path.basename(item.file)))
      for (const name of readdirSync(AUDIO_DIR)) if (!used.has(name)) unlinkSync(path.join(AUDIO_DIR, name))
    }
    saveManifest(manifest)
    console.log("Pruned recordings no line uses.")
  }

  if (args.includes("--dry")) {
    for (const item of todo) console.log(`  ${item.line.who.padEnd(9)} ${item.spoken}`)
    return
  }

  mkdirSync(AUDIO_DIR, { recursive: true })
  let done = 0
  for (const item of todo) {
    const started = Date.now()
    const result = await heygen<{ data: { audio_url: string; duration: number } }>("/v3/models/audio/tts", {
      method: "POST",
      body: JSON.stringify({
        model: "heygen-voice-1-turbo-free",
        voice_id: CAST[item.line.who].heygen,
        text: item.spoken,
        language: "en",
        output_format: { encoding: "mp3", sample_rate_hertz: 44100, bitrate_bps: 96000 },
      }),
    })
    const name = `${item.key}.mp3`
    writeFileSync(path.join(AUDIO_DIR, name), await download(result.data.audio_url))
    manifest.lines[item.key] = { file: `/voice/${name}`, seconds: result.data.duration, text: item.spoken }
    saveManifest(manifest)
    done += 1
    console.log(`  ${done}/${todo.length} ${item.line.who}: ${item.spoken.slice(0, 70)}`)
    const left = SPACING_MS - (Date.now() - started)
    if (left > 0) await sleep(left)
  }
  console.log(`Recorded ${done} lines into public/voice.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
