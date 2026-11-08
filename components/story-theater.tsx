"use client"

import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react"
import { SPEAKER_LABEL, type Speaker, type VoiceLine } from "@/lib/game/script"
import { clipFor, lineClipFor, MANIFEST, recordingFor, type Clip } from "@/lib/voice/manifest"
import { play, stop } from "@/lib/voice/player"
import { Mark } from "./mark"
import { buildSegments, lineAt, lineCount, type Segment } from "@/lib/voice/theater"

type Status = "idle" | "playing" | "paused" | "ended"

export function StoryTheater({
  lines,
  clip,
  clipAt,
  clipSpan,
  scene,
  names,
  playLabel,
  autoplay,
  active,
  onRead,
}: {
  lines: VoiceLine[]
  clip?: string
  clipAt?: number
  clipSpan?: number
  scene?: string
  names: { innerSphere: string; clan: string }
  playLabel: string
  autoplay: boolean
  active: boolean
  onRead: () => void
}) {
  const segments = useMemo(
    () => buildSegments({ lines, clip, clipAt, clipSpan, lineClips: MANIFEST.lineClips ?? {}, scene }),
    [lines, clip, clipAt, clipSpan, scene],
  )
  const total = lineCount(segments)
  const seconds = useMemo(() => segments.reduce((sum, segment) => sum + segmentSeconds(segment), 0), [segments])
  const [lineIndex, setLineIndex] = useState(0)
  const [status, setStatus] = useState<Status>("idle")
  const videoRef = useRef<HTMLVideoElement>(null)
  const run = useRef(0)
  const spot = lineAt(segments, Math.min(lineIndex, Math.max(0, total - 1)))
  const line = currentLine(spot)
  const media = spot ? mediaFor(spot.segment) : undefined

  useEffect(() => {
    if (active) return
    run.current += 1
    stop()
    videoRef.current?.pause()
    setStatus((value) => (value === "playing" ? "paused" : value))
  }, [active])

  useEffect(() => {
    if (!autoplay || !active) return
    const timer = window.setTimeout(() => start(0), 0)
    return () => window.clearTimeout(timer)
    // Start once per story. The parent remounts this component when the story changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function start(index: number) {
    const next = lineAt(segments, index)
    run.current += 1
    const mine = run.current
    if (!next) {
      setStatus("ended")
      return
    }
    setLineIndex(index)
    setStatus("playing")
    if (next.segment.kind === "still") {
      videoRef.current?.pause()
      stop()
      void play(`theater-${mine}`, [next.segment.line]).then(() => {
        if (run.current !== mine) return
        start(index + 1)
      })
      return
    }
    stop()
    const video = videoRef.current
    if (!video) return
    const clipMedia = mediaFor(next.segment)
    const caption = clipMedia?.captions[next.local]
    const go = () => {
      video.currentTime = caption?.start ?? 0
      void video.play().catch(() => {
        if (run.current === mine) setStatus("idle")
      })
    }
    if (video.dataset.clip !== next.segment.id) {
      video.dataset.clip = next.segment.id
      video.src = clipMedia?.url ?? ""
      video.poster = clipMedia?.poster ?? ""
      video.onloadeddata = () => {
        if (run.current === mine) go()
      }
      return
    }
    go()
  }

  function pause() {
    run.current += 1
    stop()
    videoRef.current?.pause()
    setStatus("paused")
  }

  function resume() {
    if (status === "ended") return start(0)
    if (status === "paused" && spot?.segment.kind === "video") {
      setStatus("playing")
      void videoRef.current?.play().catch(() => setStatus("idle"))
      return
    }
    start(lineIndex)
  }

  function onTime(event: SyntheticEvent<HTMLVideoElement>) {
    if (!spot || spot.segment.kind !== "video" || status !== "playing") return
    const time = event.currentTarget.currentTime
    const captions = mediaFor(spot.segment)?.captions ?? []
    const local = captions.findIndex((item) => time >= item.start && time <= item.end + 0.4)
    if (local >= 0) setLineIndex(spot.start + local)
  }

  const caption = captionText(spot, media)
  const image = spot?.segment.kind === "still" ? spot.segment.image : media?.poster
  const showVideo = spot?.segment.kind === "video" && status !== "idle"
  const duration = spot?.segment.kind === "still" ? recordingFor(spot.segment.line.key)?.seconds ?? 4 : 4

  return (
    <div className="theater" data-testid="story-theater">
      <div className={`theater-frame${status === "playing" && spot?.segment.kind === "still" ? " speaking" : ""}`}>
        {showVideo ? (
          <video
            ref={videoRef}
            playsInline
            poster={media?.poster}
            onTimeUpdate={onTime}
            onEnded={() => start((spot?.start ?? 0) + (spot?.segment.kind === "video" ? spot.segment.lines.length : 1))}
          />
        ) : image ? (
          <img
            src={image}
            alt=""
            style={{ ["--dur" as string]: `${duration}s` }}
          />
        ) : (
          <div className="theater-radio">
            <Mark />
            <p>{line ? chipLabel(line.who, names) : "Narrator"}</p>
          </div>
        )}
        {status === "playing" && spot?.segment.kind === "still" ? <span className="equalizer" aria-hidden="true"><i /><i /><i /></span> : null}
        {status === "idle" ? (
          <div className="theater-idle">
            <button type="button" className="primary" onClick={() => start(0)}>
              {playLabel}
            </button>
            <p>{about(seconds)}</p>
          </div>
        ) : null}
        {status === "ended" ? (
          <div className="theater-idle">
            <button type="button" className="primary" onClick={() => start(0)}>Play again</button>
            <button type="button" className="ghost" onClick={onRead}>Read the text</button>
          </div>
        ) : null}
      </div>
      <p className="theater-caption">
        {line ? <span className={`chip chip-${line.who}`}>{chipLabel(line.who, names)}</span> : null}
        <span>{caption || "\u00a0"}</span>
      </p>
      <div className="theater-controls">
        <button type="button" aria-label="Previous line" disabled={lineIndex <= 0 || status === "idle"} onClick={() => start(lineIndex - 1)}>Back</button>
        {status === "playing" ? (
          <button type="button" className="primary" aria-label="Pause" onClick={pause}>Pause</button>
        ) : (
          <button type="button" className="primary" aria-label="Play" onClick={resume}>Play</button>
        )}
        <button type="button" aria-label="Next line" disabled={status === "idle" || lineIndex >= total - 1} onClick={() => start(lineIndex + 1)}>Next</button>
        <button type="button" aria-label="Restart" disabled={status === "idle"} onClick={() => start(0)}>Restart</button>
        <span className="theater-count">Line {Math.min(lineIndex + 1, total)} of {total}</span>
      </div>
      <div className="theater-progress" aria-hidden="true">
        {flatten(segments).map((item, index) => (
          <button
            key={`${item.key}-${index}`}
            type="button"
            className={`seg seg-${item.who}${index < lineIndex ? " done" : ""}${index === lineIndex ? " now" : ""}`}
            aria-label={`Line ${index + 1}`}
            onClick={() => start(index)}
          />
        ))}
      </div>
    </div>
  )
}

function flatten(segments: Segment[]): VoiceLine[] {
  return segments.flatMap((segment) => (segment.kind === "video" ? segment.lines : [segment.line]))
}

function currentLine(spot: ReturnType<typeof lineAt>): VoiceLine | undefined {
  if (!spot) return undefined
  return spot.segment.kind === "video" ? spot.segment.lines[spot.local] : spot.segment.line
}

function mediaFor(segment: Segment): Clip | undefined {
  if (segment.kind !== "video") return undefined
  if (segment.id.startsWith("line:")) return lineClipFor(segment.id.slice(5))
  return clipFor(segment.id)
}

function captionText(spot: ReturnType<typeof lineAt>, media: Clip | undefined): string {
  const line = currentLine(spot)
  if (!line) return ""
  return media?.captions[spot?.local ?? 0]?.text ?? line.say
}

function segmentSeconds(segment: Segment): number {
  if (segment.kind === "video") return mediaFor(segment)?.seconds ?? 0
  return recordingFor(segment.line.key)?.seconds ?? 3
}

function about(seconds: number): string {
  if (seconds < 60) return `about ${Math.max(1, Math.round(seconds))} sec`
  const minutes = Math.max(1, Math.round(seconds / 60))
  return `about ${minutes} min`
}

function chipLabel(who: Speaker, names: { innerSphere: string; clan: string }): string {
  if (who === "lyran") return `Lieutenant ${names.innerSphere}`
  if (who === "falcon") return `Star Commander ${names.clan}`
  return SPEAKER_LABEL[who]
}
