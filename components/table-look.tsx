"use client"

import { useEffect, useRef, useState } from "react"
import { lookPrompt } from "@/lib/game/look"
import type { Screen } from "@/lib/game/types"

const KEY = "mech-coach-xai-key"

export function TableLook({
  screen,
  playerName,
  onOpenChange,
}: {
  screen: Screen
  playerName: string
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)

  function setLookOpen(next: boolean) {
    setOpen(next)
    onOpenChange?.(next)
  }
  const [storedKey, setStoredKey] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [reply, setReply] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setStoredKey(localStorage.getItem(KEY))
    return () => stopCamera()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!cameraOn || !video || !stream) return
    video.srcObject = stream
    void video.play().catch(() => setError("This device did not open a camera. Take a picture instead."))
  }, [cameraOn])

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  function saveKey() {
    const next = draft.trim()
    if (!next) return
    localStorage.setItem(KEY, next)
    setStoredKey(next)
    setDraft("")
  }

  function forgetKey() {
    localStorage.removeItem(KEY)
    setStoredKey(null)
    setReply(null)
  }

  async function sendPhoto(blob: Blob) {
    const key = storedKey
    if (!key) return
    setBusy(true)
    setError(null)
    setReply(null)
    try {
      const image = await shrinkPhoto(blob)
      const response = await fetch("/api/look", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ image, prompt: lookPrompt(screen, playerName) }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "The look did not come back.")
        return
      }
      setReply(typeof data.text === "string" ? data.text : "The look came back empty.")
    } catch {
      setError("The picture did not go through.")
    } finally {
      setBusy(false)
    }
  }

  async function startCamera() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      streamRef.current = stream
      setCameraOn(true)
    } catch {
      setError("This device did not open a camera. Take a picture instead.")
    }
  }

  async function snap() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext("2d")
    if (!context) return
    context.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92))
    if (!blob) return
    stopCamera()
    await sendPhoto(blob)
  }

  return (
    <>
      <button
        className={`icon-btn${open ? " pressed" : ""}`}
        type="button"
        data-testid="look-open"
        aria-label="Look at my side"
        title="Look at my side"
        aria-pressed={open}
        onClick={() => setLookOpen(!open)}
      >
        <LookIcon />
      </button>
      {open ? (
    <section className="look" data-testid="look">
      <p className="kicker">A look, not a referee</p>
      <p>The cards, the dice, and the tape still decide.</p>
      {storedKey ? (
        <>
          <div className="look-actions">
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? "Looking…" : "Take a picture"}
            </button>
            {cameraOn ? (
              <button type="button" disabled={busy} onClick={() => void snap()}>
                Snap
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => void startCamera()}>
                Use this camera
              </button>
            )}
            <button className="ghost" type="button" onClick={forgetKey}>
              Forget this key
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            data-testid="look-file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void sendPhoto(file)
            }}
          />
          {cameraOn ? <video ref={videoRef} className="look-video" playsInline muted /> : null}
        </>
      ) : (
        <div className="look-key">
          <label>
            xAI key for this device
            <input
              type="password"
              value={draft}
              autoComplete="off"
              data-testid="look-key"
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <a href="https://console.x.ai" target="_blank" rel="noreferrer">
            Get a key at console.x.ai
          </a>
          <button type="button" disabled={draft.trim().length === 0} onClick={saveKey}>
            Save key on this device
          </button>
        </div>
      )}
      {error ? <p className="error">{error}</p> : null}
      {reply ? <p className="look-reply" data-testid="look-reply">{reply}</p> : null}
      <button className="ghost" type="button" onClick={() => { stopCamera(); setLookOpen(false) }}>
        Close
      </button>
    </section>
      ) : null}
    </>
  )
}

function LookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

async function shrinkPhoto(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  try {
    return await jpegDataUrl(bitmap, 1280, 0.7)
  } finally {
    bitmap.close()
  }
}

async function jpegDataUrl(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<string> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("The picture could not be prepared.")
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const next = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
  if (!next) throw new Error("The picture could not be prepared.")
  if (next.size > 1_200_000 && quality > 0.45) return jpegDataUrl(bitmap, Math.round(maxEdge * 0.75), quality - 0.15)
  return blobToDataUrl(next)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("The picture could not be prepared."))
    reader.readAsDataURL(blob)
  })
}
