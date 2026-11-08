"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GROUP_LABEL, SCENARIOS } from "@/lib/game/scenarios"
import type { Group } from "@/lib/game/types"
import { loadPlayerId, savePlayerId } from "@/lib/ids"
import { loadRecaps } from "@/lib/recaps"
import { AppFrame } from "./app-frame"
import { FactionPicker, usePlayer } from "./use-player"

const GROUPS: Group[] = ["teaching", "real", "graduation"]

export function LearnScreen() {
  const router = useRouter()
  const { name, setName, faction, setFaction } = usePlayer()
  const [badges, setBadges] = useState<Record<string, "Won" | "Played">>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const next: Record<string, "Won" | "Played"> = {}
    for (const recap of loadRecaps()) {
      if (next[recap.scenarioId] === "Won") continue
      next[recap.scenarioId] = recap.result === "won" ? "Won" : "Played"
    }
    setBadges(next)
  }, [])

  async function start(scenarioId: string) {
    setBusy(true)
    setError(null)
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId, name, faction, playerId: loadPlayerId() }),
    })
    const data = await response.json()
    setBusy(false)
    if (!response.ok) {
      setError(data.error ?? "Could not start.")
      return
    }
    if (typeof data.playerId === "string") savePlayerId(data.playerId)
    router.push(`/game/${data.state.code}`)
  }

  return (
    <AppFrame title="Learn" lede="The box campaign. Keep the cards, the dice, and the tape on the table.">
      <section className="panel">
        <label>
          Your name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} autoComplete="given-name" />
        </label>
        <FactionPicker faction={faction} setFaction={setFaction} />
      </section>
      {GROUPS.map((group) => (
        <section className="scenario-group" key={group}>
          <p className="group-title">{GROUP_LABEL[group]}</p>
          {SCENARIOS.filter((scenario) => scenario.group === group).map((scenario) => (
            <article key={scenario.id} className="chapter">
              <div>
                <strong>{scenario.title}</strong>
                {badges[scenario.id] ? <span className="badge">{badges[scenario.id]}</span> : null}
                <small>{scenario.chapter}. {scenario.summary}</small>
              </div>
              <button type="button" disabled={busy || name.trim().length === 0} onClick={() => void start(scenario.id)}>
                Start
              </button>
            </article>
          ))}
        </section>
      ))}
      {error ? <p className="error">{error}</p> : null}
    </AppFrame>
  )
}
