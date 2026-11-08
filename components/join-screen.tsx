"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CATALOG, factionLabel } from "@/lib/game/scenarios"
import type { Faction, GameState } from "@/lib/game/types"
import { loadPlayerId, savePlayerId } from "@/lib/ids"
import { AppFrame } from "./app-frame"
import { PilotBadge } from "./pilot-badge"
import { usePlayer } from "./use-player"

export function JoinScreen() {
  const router = useRouter()
  const { name, setName, faction, ready } = usePlayer()
  const [joinCode, setJoinCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) {
      setPreview(null)
      return
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/rooms/${code}`, { cache: "no-store" })
        .then(async (response) => {
          if (response.status === 404) {
            setPreview("No battle with that code.")
            return
          }
          const data = await response.json()
          setPreview(previewText(data.state as GameState, faction))
        })
        .catch(() => setPreview("No battle with that code."))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [joinCode, faction])

  async function joinGame() {
    setBusy(true)
    setError(null)
    const code = joinCode.trim().toUpperCase()
    const response = await fetch(`/api/rooms/${code}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, playerId: loadPlayerId() }),
    })
    const data = await response.json()
    setBusy(false)
    if (!response.ok) {
      setError(data.error ?? "No answer on that code. Check it with the other pilot.")
      return
    }
    if (typeof data.playerId === "string") savePlayerId(data.playerId)
    const seat = data.state?.players?.find((player: { id: string; name: string }) => player.id === data.playerId)
    if (seat?.name) setName(seat.name)
    router.push(`/game/${data.state.code}`)
  }

  return (
    <AppFrame
      title="Join"
      lede="Enter the code from the other pilot's screen. Switching devices mid-battle? Use the same pilot name to get your seat back."
    >
      <section className="panel">
        <PilotBadge next="/join" />
        <label>
          Battle code
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            maxLength={4}
            autoCapitalize="characters"
            data-testid="join-code"
          />
        </label>
        {preview ? <p className="join-preview" data-testid="join-preview">{preview}</p> : null}
        <button className="primary" type="button" disabled={busy || !ready || name.trim().length === 0 || joinCode.trim().length < 4} title={name.trim().length === 0 ? "Set up your pilot first" : undefined} onClick={() => void joinGame()}>
          Take my seat
        </button>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </AppFrame>
  )
}

function previewText(state: GameState | undefined, preferred: Faction): string {
  if (!state) return "No battle with that code."
  const host = state.players[0]
  if (!host) return "No battle with that code."
  const open = state.players.length < 2 && state.phase === "lobby"
  if (!open) return "Both seats are taken. If one is yours, use the same pilot name."
  const other: Faction = host.faction === "innerSphere" ? "clan" : "innerSphere"
  const title = state.customScenario?.title ?? CATALOG.find((item) => item.id === state.scenarioId)?.title ?? state.scenarioId
  const lines = [`${title}. ${host.name} flies ${factionLabel(host.faction)}. You will fly ${factionLabel(other)}.`]
  if (preferred === host.faction) lines.push(`Your preferred faction is ${factionLabel(preferred)}, but the host picked first.`)
  return lines.join(" ")
}
