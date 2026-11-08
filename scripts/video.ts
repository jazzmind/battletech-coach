// Render the commander briefing clips: HeyGen lip-syncs a pilot portrait to the
// commander's recorded orders, and the mp4 goes to Vercel Blob.
//   npm run video                    render every clip that is missing or out of date
//   npm run video -- --dry           list clips and estimated minutes, spend nothing
//   npm run video -- --only <id>     render one clip, for example first-steps.clan
//   npm run video -- --parallel 2    clips rendering at the same time (default 4)
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { put } from "@vercel/blob"
import { CATALOG, type Scenario } from "../lib/game/scenarios"
import { spokenText } from "../lib/game/script"
import type { Faction } from "../lib/game/types"
import { CAST } from "../lib/voice/cast"
import { clipId } from "../lib/voice/key"
import { ordersLines } from "../lib/voice/lines"
import type { Caption, Manifest } from "../lib/voice/manifest"
import { ROOT, download, heygen, loadEnv, sleep } from "./heygen"

const MANIFEST_FILE = path.join(ROOT, "lib/voice/manifest.json")
const FACTIONS: Faction[] = ["innerSphere", "clan"]
const PORTRAIT: Record<Faction, "garrison" | "galaxy"> = { innerSphere: "garrison", clan: "galaxy" }
// Speech runs about 2.6 words a second with these voices.
const WORDS_PER_SECOND = 2.6
const POLL_MS = 10000
const TIMEOUT_MS = 30 * 60 * 1000

const args = process.argv.slice(2)
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined
// HeyGen renders several videos at once; each clip still takes a few minutes.
const PARALLEL = args.includes("--parallel") ? Number(args[args.indexOf("--parallel") + 1]) : 4

type Word = { text: string; start_time: number; end_time: number }
type Job = { id: string; scenario: Scenario; faction: Faction; sentences: string[] }

function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_FILE, "utf8")) as Manifest
}

function saveClip(id: string, clip: Manifest["clips"][string]) {
  const manifest = readManifest()
  manifest.clips[id] = clip
  const clips = Object.fromEntries(Object.entries(manifest.clips).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(MANIFEST_FILE, `${JSON.stringify({ ...manifest, clips }, null, 2)}\n`)
}

function jobs(): Job[] {
  return CATALOG.flatMap((scenario) =>
    FACTIONS.map((faction) => ({
      id: clipId(scenario.id, faction),
      scenario,
      faction,
      sentences: ordersLines(scenario, faction).map(spokenText).filter(Boolean),
    })),
  )
}

function current(job: Job, manifest: Manifest): boolean {
  const clip = manifest.clips[job.id]
  return Boolean(clip) && clip.captions.map((item) => item.text).join(" ") === job.sentences.join(" ")
}

// Each sentence owns as many timed words as it has words.
function captionsFor(sentences: string[], words: Word[]): Caption[] {
  const captions: Caption[] = []
  let index = 0
  for (const text of sentences) {
    const count = text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length
    const first = words[Math.min(index, words.length - 1)]
    const last = words[Math.min(index + count - 1, words.length - 1)]
    captions.push({ text, start: round(first.start_time), end: round(last.end_time) })
    index += count
  }
  return captions
}

const round = (seconds: number) => Math.round(seconds * 100) / 100

async function blob(name: string, body: Buffer, contentType: string): Promise<string> {
  const result = await put(name, body, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: process.env.PUBLIC_BLOB_READ_WRITE_TOKEN,
  })
  return result.url
}

const portraits = new Map<string, string>()
async function portraitUrl(who: "garrison" | "galaxy"): Promise<string> {
  const cached = portraits.get(who)
  if (cached) return cached
  const url = await blob(`pilots/${who}.jpg`, readFileSync(path.join(ROOT, "public/art/pilots", `${who}.jpg`)), "image/jpeg")
  portraits.set(who, url)
  return url
}

async function render(job: Job) {
  const who = PORTRAIT[job.faction]
  const speech = await heygen<{ data: { audio_url: string; duration: number; original_words?: Word[] } }>("/v3/models/audio/tts", {
    method: "POST",
    body: JSON.stringify({
      model: "heygen-voice-1-turbo-free",
      voice_id: CAST[who].heygen,
      text: job.sentences.join(" "),
      language: "en",
      with_timestamps: true,
      output_format: { encoding: "mp3", sample_rate_hertz: 44100, bitrate_bps: 96000 },
    }),
  })
  const words = speech.data.original_words ?? []
  if (words.length === 0) throw new Error(`No word timings came back for ${job.id}`)

  const created = await heygen<{ data: { video_id: string } }>("/v3/videos", {
    method: "POST",
    body: JSON.stringify({
      type: "image",
      title: `Briefing ${job.id}`,
      image: { type: "url", url: await portraitUrl(who) },
      audio_url: speech.data.audio_url,
      aspect_ratio: "4:5",
      fit: "cover",
      resolution: "720p",
      expressiveness: "medium",
      motion_prompt: "A calm commander giving a radio briefing. Small nods, steady eyes, no hand gestures.",
    }),
  })
  const videoId = created.data.video_id
  console.log(`  ${job.id}: rendering ${videoId} (${Math.round(speech.data.duration)}s of speech)`)

  const started = Date.now()
  for (;;) {
    await sleep(POLL_MS)
    const status = await heygen<{
      data: { status: string; video_url?: string; thumbnail_url?: string; duration?: number; failure_message?: string }
    }>(`/v3/videos/${videoId}`)
    const video = status.data
    if (video.status === "failed") throw new Error(`${job.id} failed: ${video.failure_message ?? "no reason given"}`)
    if (video.status === "completed" && video.video_url) {
      const url = await blob(`briefings/${job.id}.mp4`, await download(video.video_url), "video/mp4")
      const poster = video.thumbnail_url
        ? await blob(`briefings/${job.id}.jpg`, await download(video.thumbnail_url), "image/jpeg")
        : undefined
      saveClip(job.id, {
        url,
        seconds: round(video.duration ?? speech.data.duration),
        ...(poster ? { poster } : {}),
        captions: captionsFor(job.sentences, words),
      })
      console.log(`  ${job.id}: saved ${url}`)
      return
    }
    if (Date.now() - started > TIMEOUT_MS) throw new Error(`${job.id} still ${video.status} after 30 minutes (video ${videoId})`)
  }
}

async function main() {
  loadEnv()
  const manifest = readManifest()
  const all = jobs().filter((job) => !only || job.id === only)
  if (only && all.length === 0) throw new Error(`No clip called ${only}. Ids look like first-steps.clan.`)
  const todo = all.filter((job) => only || !current(job, manifest))
  const seconds = todo.reduce((sum, job) => sum + job.sentences.join(" ").split(/\s+/).length / WORDS_PER_SECOND, 0)
  console.log(`${all.length} clips, ${todo.length} to render, about ${(seconds / 60).toFixed(1)} minutes of video.`)

  if (args.includes("--dry")) {
    for (const job of todo) console.log(`  ${job.id.padEnd(28)} ${job.sentences.join(" ").slice(0, 90)}`)
    return
  }
  // The app's main store is private; clips and portraits go to the public media store.
  if (todo.length > 0 && !process.env.PUBLIC_BLOB_READ_WRITE_TOKEN) throw new Error("PUBLIC_BLOB_READ_WRITE_TOKEN is not set in .env.local.")

  const queue = [...todo]
  const failures: string[] = []
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        await render(job)
      } catch (error) {
        failures.push(`${job.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, todo.length) }, worker))
  console.log(`Rendered ${todo.length - failures.length} of ${todo.length} clips.`)
  if (failures.length > 0) throw new Error(`Failed:\n${failures.join("\n")}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
