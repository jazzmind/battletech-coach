"use client"

import { useState } from "react"
import Link from "next/link"
import type { Action } from "@/lib/game/types"
import type { AudioSettings } from "@/lib/voice/auto"
import { Modal } from "./modal"

export function GameToolbar({
  code,
  busy,
  undo,
  hasMap,
  audio,
  onUndo,
  onMap,
  onLook,
  onAudio,
}: {
  code: string
  busy: boolean
  undo?: Action
  hasMap: boolean
  audio: AudioSettings
  onUndo: () => void
  onMap: () => void
  onLook: () => void
  onAudio: (next: AudioSettings) => void
}) {
  const [menu, setMenu] = useState(false)
  const [sound, setSound] = useState(false)
  const anyAudio = audio.story || audio.steps
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <nav className="toolbar" aria-label="Table">
        <button type="button" className="toolbar-btn" onClick={() => setMenu(true)}>
          Menu
        </button>
        {undo ? (
          <button type="button" className="toolbar-btn" aria-label="Undo last tap" title="Undo last tap" disabled={busy} onClick={onUndo}>
            Undo
          </button>
        ) : null}
        {hasMap ? (
          <button type="button" className="toolbar-btn" onClick={onMap}>
            Map
          </button>
        ) : null}
        <button
          type="button"
          className={`toolbar-btn${anyAudio ? " on" : ""}`}
          data-testid="audio-open"
          title="Story audio and step reading"
          onClick={() => setSound(true)}
        >
          Audio
        </button>
        <button type="button" className="toolbar-btn" data-testid="look-open" aria-label="Look at my side" title="Look at my side" onClick={onLook}>
          <LookIcon />
        </button>
      </nav>
      <Modal open={sound} title="Audio" onClose={() => setSound(false)}>
        <div className="menu-sheet audio-sheet">
          <button
            type="button"
            className={`switch${audio.story ? " on" : ""}`}
            data-testid="audio-story"
            aria-pressed={audio.story}
            onClick={() => onAudio({ ...audio, story: !audio.story })}
          >
            <strong>Story audio {audio.story ? "on" : "off"}</strong>
            <span>Plays the briefing, the radio between turns, and the ending, with a voice for each character.</span>
          </button>
          <button
            type="button"
            className={`switch${audio.steps ? " on" : ""}`}
            data-testid="audio-steps"
            aria-pressed={audio.steps}
            onClick={() => onAudio({ ...audio, steps: !audio.steps })}
          >
            <strong>Read each step {audio.steps ? "on" : "off"}</strong>
            <span>Reads the coach's instruction out loud every time it changes.</span>
          </button>
          <p className="note">The speaker buttons on the briefing, the rule, and the ending always work.</p>
        </div>
      </Modal>
      <Modal open={menu} title={`Battle ${code}`} onClose={() => setMenu(false)}>
        <div className="menu-sheet">
          <Link href="/" className="primary back-link" onClick={() => setMenu(false)}>
            Home
          </Link>
          <Link href="/history" className="ghost back-link" onClick={() => setMenu(false)}>
            History
          </Link>
          <button type="button" className="ghost" onClick={() => void copyCode()}>
            {copied ? "Code copied" : `Copy battle code ${code}`}
          </button>
          <Link href="/" className="ghost back-link" onClick={() => setMenu(false)}>
            Leave the battle
          </Link>
          <p className="note">Leaving does not end the battle. Rejoin it from Home or History.</p>
        </div>
      </Modal>
    </>
  )
}

function LookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
