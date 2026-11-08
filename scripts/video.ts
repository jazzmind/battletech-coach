// Render the commander briefing clips: HeyGen lip-syncs a pilot portrait to the
// commander's recorded orders, and the mp4 goes to Vercel Blob.
//
// Render through the HeyGen MCP server, which bills plan credits:
//   npm run video                          list clips that are missing or out of date (free)
//   npm run video -- --prepare             free TTS + captions per clip; prints the MCP
//                                          create_video_from_image inputs
//   npm run video -- --save <id> <url> [poster]   after the MCP render: upload and write the manifest
//
// Paid pay-as-you-go API path, only with Wes's go-ahead:
//   npm run video -- --api [--parallel 4]
//
// Any mode takes --only <id>, for example --only first-steps.clan.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { put } from "@vercel/blob"
import { CATALOG, type Scenario } from "../lib/game/scenarios"
import { spokenText } from "../lib/game/script"
import type { Faction } from "../lib/game/types"
import { CAST } from "../lib/voice/cast"
import { clipId, voiceKey } from "../lib/voice/key"
import { everyLine, ordersLines, voicedScenarios } from "../lib/voice/lines"
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
async function portraitUrl(who: LineSpeaker): Promise<string> {
  const cached = portraits.get(who)
  if (cached) return cached
  const url = await blob(`pilots/${who}.jpg`, readFileSync(path.join(ROOT, "public/art/pilots", `${who}.jpg`)), "image/jpeg")
  portraits.set(who, url)
  return url
}

const PENDING_DIR = path.join(ROOT, ".voices/pending")
const LOOK = {
  aspectRatio: "4:5",
  fit: "cover",
  resolution: "720p",
  expressiveness: "medium",
  motionPrompt: "A calm commander giving a radio briefing. Small nods, steady eyes, no hand gestures.",
} as const

type Pending = { id: string; title: string; image: { type: "url"; url: string }; audioUrl: string; seconds: number; captions: Caption[] }

async function speech(job: Job) {
  const who = PORTRAIT[job.faction]
  const result = await heygen<{ data: { audio_url: string; duration: number; original_words?: Word[] } }>("/v3/models/audio/tts", {
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
  const words = result.data.original_words ?? []
  if (words.length === 0) throw new Error(`No word timings came back for ${job.id}`)
  return { audioUrl: result.data.audio_url, seconds: result.data.duration, captions: captionsFor(job.sentences, words) }
}

async function prepare(job: Job): Promise<Pending> {
  const spoken = await speech(job)
  const pending: Pending = {
    id: job.id,
    title: `Briefing ${job.id}`,
    image: { type: "url", url: await portraitUrl(PORTRAIT[job.faction]) },
    ...spoken,
  }
  mkdirSync(PENDING_DIR, { recursive: true })
  writeFileSync(path.join(PENDING_DIR, `${job.id}.json`), `${JSON.stringify(pending, null, 2)}\n`)
  return pending
}

// HeyGen's own thumbnail is the portrait cropped to the 720p 4:5 frame; make the same one locally.
function cropPoster(who: string): Buffer {
  const jpg = path.join(PENDING_DIR, `${who}-poster.jpg`)
  const frame = "scale=720:900:force_original_aspect_ratio=increase,crop=720:900"
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(ROOT, "public/art/pilots", `${who}.jpg`), "-vf", frame, "-q:v", "3", jpg])
  return readFileSync(jpg)
}

function portraitPoster(id: string): Buffer {
  const who = PORTRAIT[id.split(".").pop() as Faction]
  const jpg = path.join(PENDING_DIR, `${id}.jpg`)
  const frame = "scale=720:900:force_original_aspect_ratio=increase,crop=720:900"
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(ROOT, "public/art/pilots", `${who}.jpg`), "-vf", frame, "-q:v", "3", jpg])
  return readFileSync(jpg)
}

async function save(id: string, videoUrl: string, posterUrl?: string) {
  const file = path.join(PENDING_DIR, `${id}.json`)
  if (!existsSync(file)) throw new Error(`No prepared speech for ${id}. Run npm run video -- --prepare --only ${id} first.`)
  const pending = JSON.parse(readFileSync(file, "utf8")) as Pending
  const url = await blob(`briefings/${id}.mp4`, await download(videoUrl), "video/mp4")
  // The MCP status call returns no thumbnail.
  const still = posterUrl ? await download(posterUrl) : portraitPoster(id)
  const poster = await blob(`briefings/${id}.jpg`, still, "image/jpeg")
  saveClip(id, { url, seconds: round(pending.seconds), poster, captions: pending.captions })
  console.log(`  ${id}: saved ${url}`)
}

async function render(job: Job) {
  const spoken = await speech(job)
  const created = await heygen<{ data: { video_id: string } }>("/v3/videos", {
    method: "POST",
    body: JSON.stringify({
      type: "image",
      title: `Briefing ${job.id}`,
      image: { type: "url", url: await portraitUrl(PORTRAIT[job.faction]) },
      audio_url: spoken.audioUrl,
      aspect_ratio: LOOK.aspectRatio,
      fit: LOOK.fit,
      resolution: LOOK.resolution,
      expressiveness: LOOK.expressiveness,
      motion_prompt: LOOK.motionPrompt,
    }),
  })
  const videoId = created.data.video_id
  console.log(`  ${job.id}: rendering ${videoId} (${Math.round(spoken.seconds)}s of speech)`)

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
        seconds: round(video.duration ?? spoken.seconds),
        ...(poster ? { poster } : {}),
        captions: spoken.captions,
      })
      console.log(`  ${job.id}: saved ${url}`)
      return
    }
    if (Date.now() - started > TIMEOUT_MS) throw new Error(`${job.id} still ${video.status} after 30 minutes (video ${videoId})`)
  }
}

const LINE_MOTION = {
  lyran: "A Lyran MechWarrior speaking on a cockpit radio. Focused, small head movement, no hand gestures.",
  falcon: "A proud Clan Jade Falcon warrior issuing a formal challenge over the radio. Chin up, steady gaze, no hand gestures.",
  garrison: "A Lyran garrison commander giving orders over the radio. Steady, serious, no hand gestures.",
  galaxy: "A Clan Jade Falcon officer giving orders over the radio. Formal, chin up, no hand gestures.",
} as const

type LineSpeaker = keyof typeof LINE_MOTION

type LineJob = { key: string; who: LineSpeaker; text: string; file: string; seconds: number }

function coveredByBriefing(key: string): boolean {
  for (const scenario of voicedScenarios()) {
    for (const faction of ["innerSphere", "clan"] as const) {
      const orders = ordersLines(scenario, faction)[0]
      if (orders && voiceKey(orders.who, spokenText(orders)) === key) return true
    }
  }
  return false
}

function lineJobs(manifest: Manifest): LineJob[] {
  const jobs: LineJob[] = []
  for (const item of everyLine(voicedScenarios())) {
    if (item.line.who !== "lyran" && item.line.who !== "falcon" && item.line.who !== "garrison" && item.line.who !== "galaxy") continue
    if (coveredByBriefing(item.key)) continue
    const recording = manifest.lines[item.key]
    if (!recording) continue
    jobs.push({ key: item.key, who: item.line.who, text: item.spoken, file: recording.file, seconds: recording.seconds })
  }
  return jobs
}

async function prepareLine(job: LineJob) {
  const audioUrl = await blob(`lines/${job.key}.mp3`, readFileSync(path.join(ROOT, "public", job.file.replace(/^\//, ""))), "audio/mpeg")
  const pending = {
    id: `line.${job.key}`,
    title: `Line ${job.who} ${job.key}`,
    image: { type: "url" as const, url: await portraitUrl(job.who) },
    audioUrl,
    seconds: job.seconds,
    captions: [{ text: job.text, start: 0, end: round(job.seconds) }],
    who: job.who,
  }
  mkdirSync(PENDING_DIR, { recursive: true })
  writeFileSync(path.join(PENDING_DIR, `${pending.id}.json`), `${JSON.stringify(pending, null, 2)}\n`)
  console.log(JSON.stringify({
    id: pending.id,
    title: pending.title,
    image: pending.image,
    audioUrl: pending.audioUrl,
    aspectRatio: LOOK.aspectRatio,
    fit: LOOK.fit,
    resolution: LOOK.resolution,
    expressiveness: LOOK.expressiveness,
    motionPrompt: LINE_MOTION[job.who],
  }))
}

async function saveLine(id: string, videoUrl: string, posterUrl?: string) {
  const key = id.startsWith("line.") ? id.slice(5) : id
  const file = path.join(PENDING_DIR, `line.${key}.json`)
  if (!existsSync(file)) throw new Error(`No prepared speech for ${id}. Run npm run video -- --lines --prepare --only ${key} first.`)
  const pending = JSON.parse(readFileSync(file, "utf8")) as Pending & { who?: "lyran" | "falcon" }
  const url = await blob(`lines/${key}.mp4`, await download(videoUrl), "video/mp4")
  const still = posterUrl ? await download(posterUrl) : cropPoster(pending.who ?? "lyran")
  const poster = await blob(`lines/${key}.jpg`, still, "image/jpeg")
  const manifest = readManifest()
  manifest.lineClips = manifest.lineClips ?? {}
  manifest.lineClips[key] = { url, seconds: round(pending.seconds), poster, captions: pending.captions }
  const lineClips = Object.fromEntries(Object.entries(manifest.lineClips).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(MANIFEST_FILE, `${JSON.stringify({ ...manifest, lineClips }, null, 2)}\n`)
  console.log(`  ${key}: saved ${url}`)
}

async function main() {
  loadEnv()
  if (args.includes("--lines")) {
    const manifest = readManifest()
    const jobs = lineJobs(manifest).filter((job) => !only || job.key === only || `line.${job.key}` === only)
    const todo = jobs.filter((job) => only || !manifest.lineClips?.[job.key])
    console.log(`${jobs.length} speaker lines, ${todo.length} clips to render.`)
    if (!args.includes("--prepare") && !args.includes("--save")) {
      for (const job of todo) console.log(`  ${job.key.padEnd(28)} ${job.text.slice(0, 90)}`)
      return
    }
    if (args.includes("--save")) {
      const [id, videoUrl, posterUrl] = args.slice(args.indexOf("--save") + 1)
      if (!id || !videoUrl) throw new Error("Usage: npm run video -- --lines --save <id> <videoUrl> [posterUrl]")
      return saveLine(id, videoUrl, posterUrl)
    }
    if (!process.env.PUBLIC_BLOB_READ_WRITE_TOKEN) throw new Error("PUBLIC_BLOB_READ_WRITE_TOKEN is not set in .env.local.")
    for (const job of todo) await prepareLine(job)
    return
  }
  if (args.includes("--save")) {
    const [id, videoUrl, posterUrl] = args.slice(args.indexOf("--save") + 1)
    if (!id || !videoUrl) throw new Error("Usage: npm run video -- --save <id> <videoUrl> [posterUrl]")
    return save(id, videoUrl, posterUrl)
  }
  const manifest = readManifest()
  const all = jobs().filter((job) => !only || job.id === only)
  if (only && all.length === 0) throw new Error(`No clip called ${only}. Ids look like first-steps.clan.`)
  const todo = all.filter((job) => only || !current(job, manifest))
  const seconds = todo.reduce((sum, job) => sum + job.sentences.join(" ").split(/\s+/).length / WORDS_PER_SECOND, 0)
  console.log(`${all.length} clips, ${todo.length} to render, about ${(seconds / 60).toFixed(1)} minutes of video.`)

  const prepareOnly = args.includes("--prepare")
  if (!prepareOnly && !args.includes("--api")) {
    for (const job of todo) console.log(`  ${job.id.padEnd(28)} ${job.sentences.join(" ").slice(0, 90)}`)
    return
  }
  // The app's main store is private; clips and portraits go to the public media store.
  if (todo.length > 0 && !process.env.PUBLIC_BLOB_READ_WRITE_TOKEN) throw new Error("PUBLIC_BLOB_READ_WRITE_TOKEN is not set in .env.local.")

  if (prepareOnly) {
    for (const job of todo) {
      const pending = await prepare(job)
      console.log(
        JSON.stringify({ id: pending.id, title: pending.title, image: pending.image, audioUrl: pending.audioUrl, ...LOOK }),
      )
    }
    return
  }

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
