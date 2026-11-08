"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { VISION_KEY } from "@/lib/vision-client"
import { AuthPanel } from "./account-panel"
import { AppFrame } from "./app-frame"
import { FactionPicker, usePlayer } from "./use-player"

const BACK: Record<string, string> = { "/learn": "Learn", "/join": "Join", "/create": "Create" }

export function PilotScreen() {
  const params = useSearchParams()
  const next = params.get("next") ?? ""
  const back = BACK[next]
  const { name, setName, faction, setFaction } = usePlayer()
  const [keyDraft, setKeyDraft] = useState("")
  const [savedKey, setSavedKey] = useState<string | null>(null)

  useEffect(() => {
    setSavedKey(localStorage.getItem(VISION_KEY))
  }, [])

  function saveKey() {
    const nextKey = keyDraft.trim()
    if (!nextKey) return
    localStorage.setItem(VISION_KEY, nextKey)
    setSavedKey(nextKey)
    setKeyDraft("")
  }

  function forgetKey() {
    localStorage.removeItem(VISION_KEY)
    setSavedKey(null)
  }

  const backLink = back && name.trim().length > 0 ? (
    <Link href={next} className="primary back-link">Back to {back}</Link>
  ) : null

  return (
    <AppFrame title="Pilot" lede="Your name, your faction, and your account. Saved on this device.">
      {backLink}
      <section className="panel">
        <h2>Pilot name</h2>
        <label>
          Pilot name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} autoComplete="given-name" />
        </label>
        <p className="kit">Other pilots see this name. Use the same name to retake your seat on another device.</p>
      </section>
      <section className="panel">
        <FactionPicker faction={faction} setFaction={setFaction} />
        <p className="kit">Your preferred side. In a two-pilot battle the host gets their pick, and the other pilot flies for the other side.</p>
      </section>
      <section className="panel">
        <h2>Account</h2>
        <AuthPanel />
      </section>
      <section className="panel">
        <h2>Advanced vision (optional)</h2>
        <label>
          xAI API key
          <input type="password" value={keyDraft} autoComplete="off" onChange={(event) => setKeyDraft(event.target.value)} />
        </label>
        <button type="button" disabled={keyDraft.trim().length === 0} onClick={saveKey}>Save key on this device</button>
        <button type="button" className="ghost" onClick={forgetKey}>Forget this key</button>
        {savedKey ? <p>Key saved on this device (ends in {savedKey.slice(-4)}).</p> : null}
        <p className="kit">
          With a key, camera looks use xAI's vision model, billed to your key. Without one, the standard vision runs with a daily limit per account.{" "}
          <a href="https://console.x.ai" target="_blank" rel="noreferrer">console.x.ai</a>
        </p>
      </section>
      {backLink}
    </AppFrame>
  )
}
