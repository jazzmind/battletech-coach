"use client"

import { useState } from "react"
import Link from "next/link"
import type { Action, Screen } from "@/lib/game/types"
import type { AudioSettings } from "@/lib/voice/auto"
import { CameraButton } from "./camera-button"
import { Modal } from "./modal"

export function GameToolbar({
  code,
  busy,
  undo,
  hasMap,
  audio,
  screen,
  playerName,
  cameraAsk,
  onUndo,
  onMap,
  onAudio,
}: {
  code: string
  busy: boolean
  undo?: Action
  hasMap: boolean
  audio: AudioSettings
  screen: Screen
  playerName: string
  cameraAsk: number
  onUndo: () => void
  onMap: () => void
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
          <MenuIcon />
          <span>Menu</span>
        </button>
        {undo ? (
          <button type="button" className="toolbar-btn" aria-label="Undo last tap" title="Undo last tap" disabled={busy} onClick={onUndo}>
            <UndoIcon />
            <span>Undo</span>
          </button>
        ) : null}
        {hasMap ? (
          <button type="button" className="toolbar-btn toolbar-map" onClick={onMap}>
            <MapIcon />
            <span>Map</span>
          </button>
        ) : null}
        <button
          type="button"
          className={`toolbar-btn${anyAudio ? " on" : ""}`}
          data-testid="audio-open"
          title="Story audio and step reading"
          onClick={() => setSound(true)}
        >
          <AudioIcon />
          <span>Audio</span>
        </button>
        <CameraButton screen={screen} playerName={playerName} cameraAsk={cameraAsk} />
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M8 8H4v-4M4.5 13a8 8 0 1 0 2-6.5L4 8" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2zM9 4v14M15 6v14" />
    </svg>
  )
}

function AudioIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z" />
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M16 9a4 4 0 0 1 0 6" />
    </svg>
  )
}
