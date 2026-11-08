"use client"

import { useEffect, useRef, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { AccountPanel } from "./account-panel"

export function TableCheck({ mech }: { mech: string }) {
  const { data: session } = authClient.useSession()
  const [reply, setReply] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => () => stopCamera(), [])

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

  async function sendPhoto(blob: Blob) {
    setBusy(true)
    setError(null)
    setReply(null)
    try {
      const image = await shrinkPhoto(blob)
      const response = await fetch("/api/see", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, mech }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "I can't tell from here.")
        return
      }
      setReply(typeof data.text === "string" ? data.text : "I can't tell from here.")
    } catch {
      setError("The picture did not go through. The ring is still the spot.")
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
    <section className="account" data-testid="table-check">
      <p className="kicker">Camera check</p>
      {session?.user ? (
        <>
          <div className="look-actions">
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? "Looking…" : "Check with the camera"}
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
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void sendPhoto(file)
            }}
          />
          {cameraOn ? <video ref={videoRef} className="look-video" playsInline muted /> : null}
          {error ? <p className="error">{error}</p> : null}
          {reply ? <p>{reply}</p> : null}
        </>
      ) : (
        <AccountPanel compact />
      )}
    </section>
  )
}

async function shrinkPhoto(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("The picture could not be prepared.")
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const next = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7))
    if (!next) throw new Error("The picture could not be prepared.")
    return await blobToDataUrl(next)
  } finally {
    bitmap.close()
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("The picture could not be prepared."))
    reader.readAsDataURL(blob)
  })
}
