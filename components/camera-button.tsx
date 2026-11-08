"use client"

import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"
import type { Screen } from "@/lib/game/types"
import { AuthPanel } from "./account-panel"
import { CameraSheet } from "./camera-sheet"
import { Modal } from "./modal"

export function CameraButton({ screen, playerName, cameraAsk = 0 }: { screen: Screen; playerName: string; cameraAsk?: number }) {
  const { data: session } = authClient.useSession()
  const signedIn = Boolean(session?.user)
  const checking = Boolean(screen.check)
  const stepKey = `${screen.kicker}|${screen.title}`
  const [open, setOpen] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const nudge = checking && !signedIn && dismissed !== stepKey

  useEffect(() => {
    if (cameraAsk > 0) setOpen(true)
  }, [cameraAsk])
  const title = checking
    ? signedIn
      ? "Check the table with the camera"
      : "Sign in so the camera can check the table"
    : "Camera"

  return (
    <>
      <button
        type="button"
        className={`toolbar-btn camera-btn${checking && signedIn ? " on" : ""}${nudge ? " nudge" : ""}`}
        data-testid="camera-open"
        aria-label="Camera check"
        title={title}
        onClick={() => {
          setDismissed(stepKey)
          setOpen(true)
        }}
      >
        <CameraIcon />
        <span>Camera</span>
        {checking && !signedIn ? <i className="camera-dot" /> : null}
      </button>
      <Modal open={open} title="Camera check" onClose={() => setOpen(false)}>
        {signedIn ? (
          <CameraSheet screen={screen} playerName={playerName} />
        ) : (
          <div className="camera-signin">
            <p>Sign in so the camera can check your table. It's free, with a daily limit per pilot.</p>
            {sentTo ? (
              <p>Check {sentTo}. Open the link on this device. It brings you back to this battle.</p>
            ) : (
              <AuthPanel onSent={setSentTo} />
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M4 8h3l2-2h6l2 2h3v11H4z" />
      <circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
