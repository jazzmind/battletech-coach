"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { loadPlayerId, savePlayerId } from "@/lib/ids"
import { AppFrame } from "./app-frame"
import { usePlayer } from "./use-player"

export function JoinScreen() {
  const router = useRouter()
  const { name, setName } = usePlayer()
  const [joinCode, setJoinCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError(data.error ?? "Could not join.")
      return
    }
    if (typeof data.playerId === "string") savePlayerId(data.playerId)
    const seat = data.state?.players?.find((player: { id: string; name: string }) => player.id === data.playerId)
    if (seat?.name) setName(seat.name)
    router.push(`/game/${data.state.code}`)
  }

  return (
    <AppFrame title="Join" lede="Use the same name as the other screen. This device opens that seat.">
      <section className="panel">
        <label>
          Your name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} />
        </label>
        <label>
          Code
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            maxLength={4}
            autoCapitalize="characters"
            data-testid="join-code"
          />
        </label>
        <button className="primary" type="button" disabled={busy || name.trim().length === 0 || joinCode.trim().length < 4} onClick={() => void joinGame()}>
          Join game
        </button>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </AppFrame>
  )
}
