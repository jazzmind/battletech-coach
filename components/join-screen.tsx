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
        <label>
          Pilot name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} />
        </label>
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
        <button className="primary" type="button" disabled={busy || name.trim().length === 0 || joinCode.trim().length < 4} onClick={() => void joinGame()}>
          Take my seat
        </button>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </AppFrame>
  )
}
