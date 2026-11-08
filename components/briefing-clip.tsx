"use client"

import { useEffect, useRef, useState } from "react"
import { clipFor } from "@/lib/voice/manifest"
import { stop } from "@/lib/voice/player"

export function BriefingClip({ id, from }: { id?: string; from: string }) {
  const clip = id ? clipFor(id) : undefined
  const video = useRef<HTMLVideoElement>(null)
  const [open, setOpen] = useState(false)
  const [time, setTime] = useState(0)

  useEffect(() => {
    setOpen(false)
    setTime(0)
  }, [id])

  if (!clip) return null
  const caption = clip.captions.find((item) => time >= item.start && time <= item.end + 0.4)

  if (!open) {
    return (
      <button
        type="button"
        className="clip-start"
        data-testid="clip-start"
        onClick={() => {
          stop()
          setOpen(true)
        }}
      >
        {clip.poster ? <img src={clip.poster} alt="" /> : null}
        <span>Watch the orders from {from}</span>
      </button>
    )
  }

  return (
    <figure className="clip" data-testid="clip">
      <video
        ref={video}
        src={clip.url}
        poster={clip.poster}
        autoPlay
        playsInline
        controls
        onPlay={() => stop()}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onEnded={() => setOpen(false)}
      />
      <div className="clip-bar">
        <figcaption data-testid="clip-caption" aria-live="polite">
          {caption?.text ?? "\u00a0"}
        </figcaption>
        <button
          type="button"
          className="clip-skip"
          data-testid="clip-skip"
          onClick={() => {
            video.current?.pause()
            setOpen(false)
          }}
        >
          Skip
        </button>
      </div>
    </figure>
  )
}
