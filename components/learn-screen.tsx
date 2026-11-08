"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CATALOG, GROUP_LABEL } from "@/lib/game/scenarios"
import type { Group } from "@/lib/game/types"
import { loadPlayerId, savePlayerId } from "@/lib/ids"
import { loadRecaps } from "@/lib/recaps"
import { AccountPanel } from "./account-panel"
import { AppFrame } from "./app-frame"
import { FactionPicker, usePlayer } from "./use-player"

const GROUPS: Group[] = ["teaching", "real", "graduation", "missions"]

export function LearnScreen() {
  const router = useRouter()
  const { name, setName, faction, setFaction } = usePlayer()
  const [badges, setBadges] = useState<Record<string, "Victory" | "Fought">>({})
  const [busy, setBusy] = useState(false)
  const [alone, setAlone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const next: Record<string, "Victory" | "Fought"> = {}
    for (const recap of loadRecaps()) {
      if (next[recap.scenarioId] === "Victory") continue
      next[recap.scenarioId] = recap.result === "won" ? "Victory" : "Fought"
    }
    setBadges(next)
  }, [])

  async function start(scenarioId: string) {
    setBusy(true)
    setError(null)
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId, name, faction, playerId: loadPlayerId(), solo: alone }),
    })
    const data = await response.json()
    setBusy(false)
    if (!response.ok) {
      setError(data.error ?? "The mission did not launch. Try again.")
      return
    }
    if (typeof data.playerId === "string") savePlayerId(data.playerId)
    router.push(`/game/${data.state.code}`)
  }

  return (
    <AppFrame title="Learn" lede="The Twycross campaign. Eleven chapters from the box, one new rule each, then voiced missions on fixed maps.">
      <section className="panel">
        <label>
          Pilot name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} autoComplete="given-name" />
        </label>
        <FactionPicker faction={faction} setFaction={setFaction} />
        <button type="button" aria-pressed={alone} onClick={() => setAlone((value) => !value)}>
          {alone ? "Play alone, the coach takes the other side" : "Two players, one code"}
        </button>
        <p className="kit">Inner Sphere pilots hold Twycross for the Lyran Commonwealth. Clan pilots fight for the Jade Falcons.</p>
        <AccountPanel />
      </section>
      {GROUPS.map((group) => (
        <section className="scenario-group" key={group}>
          <p className="group-title">{GROUP_LABEL[group]}</p>
          {CATALOG.filter((scenario) => scenario.group === group).map((scenario) => (
            <article key={scenario.id} className={`chapter${scenario.art ? " has-art" : ""}`}>
              {scenario.art ? <img className="chapter-art" src={scenario.art.src} alt={scenario.art.alt} /> : null}
              <div>
                <strong>{scenario.title}</strong>
                {badges[scenario.id] ? <span className="badge">{badges[scenario.id]}</span> : null}
                <small>{scenario.chapter}. {scenario.summary}</small>
              </div>
              <button
                type="button"
                className="start"
                disabled={busy || name.trim().length === 0}
                title={name.trim().length === 0 ? "Enter a pilot name first" : undefined}
                onClick={() => void start(scenario.id)}
              >
                {alone ? "Play alone" : "Deploy"}
              </button>
            </article>
          ))}
        </section>
      ))}
      {error ? <p className="error">{error}</p> : null}
      <p>
        <Link className="credits-link" href="/credits">Credits for the voices, faces and art</Link>
      </p>
    </AppFrame>
  )
}
