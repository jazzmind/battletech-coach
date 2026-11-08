"use client"

import type { KeyboardEvent } from "react"

const VIEW_KEY = "mech-coach-story-view"

export type StoryView = "watch" | "read"

export function loadStoryView(): StoryView {
  if (typeof window === "undefined") return "watch"
  return localStorage.getItem(VIEW_KEY) === "read" ? "read" : "watch"
}

export function saveStoryView(view: StoryView) {
  localStorage.setItem(VIEW_KEY, view)
}

export function StoryViewToggle({ view, onChange }: { view: StoryView; onChange: (view: StoryView) => void }) {
  function move(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    onChange(view === "watch" ? "read" : "watch")
  }

  return (
    <div className="story-view" role="radiogroup" aria-label="Story view" onKeyDown={move}>
      <button type="button" role="radio" aria-checked={view === "watch"} tabIndex={view === "watch" ? 0 : -1} onClick={() => onChange("watch")}>
        <PlayIcon /> Watch
      </button>
      <button type="button" role="radio" aria-checked={view === "read"} tabIndex={view === "read" ? 0 : -1} onClick={() => onChange("read")}>
        <LinesIcon /> Read
      </button>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8 5v14l11-7z" />
    </svg>
  )
}

function LinesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z" />
    </svg>
  )
}
