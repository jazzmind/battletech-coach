"use client"

import { useState } from "react"
import Link from "next/link"
import type { Action } from "@/lib/game/types"
import { Modal } from "./modal"

export function GameToolbar({
  code,
  busy,
  undo,
  hasMap,
  onUndo,
  onMap,
  onLook,
}: {
  code: string
  busy: boolean
  undo?: Action
  hasMap: boolean
  onUndo: () => void
  onMap: () => void
  onLook: () => void
}) {
  const [menu, setMenu] = useState(false)
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
        <button type="button" className="toolbar-btn" data-testid="look-open" aria-label="Look at my side" title="Look at my side" onClick={onLook}>
          <LookIcon />
        </button>
      </nav>
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
