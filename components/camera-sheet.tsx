"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { Screen } from "@/lib/game/types"
import { askVision, savedVisionKey } from "@/lib/vision-client"

export function CameraSheet({ screen, playerName }: { screen: Screen; playerName: string }) {
  const [reply, setReply] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setHasKey(Boolean(savedVisionKey()))
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

  async function sendPhoto(blob: Blob) {
    setBusy(true)
    setError(null)
    setReply(null)
    try {
      setReply(await askVision({ image: blob, screen, playerName }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The picture did not go through.")
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
    <section className="look" data-testid="look">
      <h3 className="camera-ask">{screen.check ? `Is the ${screen.check.mech} on its ring?` : "Look at the table"}</h3>
      <div className="look-actions">
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "Looking…" : "Take a picture"}
        </button>
        {cameraOn ? (
          <>
            <button type="button" className="primary" disabled={busy} onClick={() => void snap()}>Snap</button>
            <button type="button" className="ghost" disabled={busy} onClick={stopCamera}>Cancel</button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => void startCamera()}>Use this camera</button>
        )}
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
      {error ? <p className="error">{error}</p> : null}
      {reply ? <p className="look-reply" data-testid="look-reply">{reply}</p> : null}
      <p className="camera-foot">
        {hasKey ? "Vision: xAI, using your key." : (
          <>Vision: standard. Add an xAI key on the <Link href="/pilot">Pilot page</Link> for sharper looks.</>
        )}
      </p>
    </section>
  )
}
