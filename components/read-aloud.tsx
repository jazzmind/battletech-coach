"use client"

import { useEffect, useId, useState } from "react"
import { SPEAKER_LABEL, type Speaker, type VoiceLine } from "@/lib/game/script"
import { CAST } from "@/lib/voice/cast"
import { play, stop, subscribe, unlock } from "@/lib/voice/player"

export function ReadAloud({ lines, label, testId }: { lines?: VoiceLine[]; label: string; testId?: string }) {
  const id = useId()
  const [playing, setPlaying] = useState<string | null>(null)
  const [who, setWho] = useState<Speaker | null>(null)

  useEffect(
    () =>
      subscribe((state) => {
        setPlaying(state.playing)
        setWho(state.who)
      }),
    [],
  )

  if (!lines || lines.length === 0) return null
  const mine = playing === id
  return (
    <button
      type="button"
      className={`read-aloud${mine ? " on" : ""}`}
      data-testid={testId}
      aria-pressed={mine}
      onClick={() => {
        if (mine) return stop()
        unlock()
        void play(id, lines)
      }}
    >
      {mine && who && CAST[who].portrait ? <img className="speaker-face" src={CAST[who].portrait} alt="" /> : <SpeakerIcon />}
      <span>{mine ? (who ? `${SPEAKER_LABEL[who]} speaking. Stop` : "Stop") : label}</span>
    </button>
  )
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z" />
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  )
}
