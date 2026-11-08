"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { GROUP_LABEL, SCENARIOS } from "@/lib/game/scenarios"
import type { Faction, Group } from "@/lib/game/types"
import { loadPlayerId, savePlayerId } from "@/lib/ids"
import { loadRecent, saveRecent, type RecentGame } from "@/lib/recent"
import { Mark } from "./mark"

const GROUPS: Group[] = ["teaching", "real", "graduation"]

export function HomeScreen() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [faction, setFaction] = useState<Faction>("innerSphere")
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id)
  const [joinCode, setJoinCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("mech-coach-name")
    if (saved) setName(saved)
  }, [])

  async function createGame() {
    setBusy(true)
    setError(null)
    localStorage.setItem("mech-coach-name", name.trim())
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenarioId,
        name,
        faction,
        playerId: loadPlayerId(),
      }),
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

  async function joinGame() {
    setBusy(true)
    setError(null)
    localStorage.setItem("mech-coach-name", name.trim())
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
    if (seat?.name) localStorage.setItem("mech-coach-name", seat.name)
    router.push(`/game/${data.state.code}`)
  }

  return (
    <main className="wrap">
      <header className="top">
        <div className="brand">
          <Mark />
          <div>
            <h1>Table Coach</h1>
            <p>One choice at a time, on both screens.</p>
          </div>
        </div>
      </header>
      <p className="lede">
        The first three games teach move, shoot, and bubbles. The later games teach the real quick-start turn from the box: range, movement, heat, crits, and punches. Keep the cards, the dice, and the tape on the table. For crits, keep the tables card out too.
      </p>
      <ContinueGames />
      <div className="home-grid" style={{ marginTop: "1rem" }}>
        <section className="panel">
          <h2>Start a game</h2>
          <label>
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} autoComplete="given-name" />
          </label>
          <div className="sides" role="group" aria-label="Your side">
            <button type="button" aria-pressed={faction === "innerSphere"} onClick={() => setFaction("innerSphere")}>
              Inner Sphere
            </button>
            <button type="button" aria-pressed={faction === "clan"} onClick={() => setFaction("clan")}>
              Clan
            </button>
          </div>
          <div className="scenario-group">
            {GROUPS.map((group) => (
              <div className="scenario-group" key={group}>
                <p className="group-title">{GROUP_LABEL[group]}</p>
                {SCENARIOS.filter((scenario) => scenario.group === group).map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    className="scenario"
                    aria-pressed={scenarioId === scenario.id}
                    onClick={() => setScenarioId(scenario.id)}
                  >
                    <strong>{scenario.title}</strong>
                    <small>{scenario.summary}</small>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button className="primary" type="button" disabled={busy || name.trim().length === 0} onClick={createGame}>
            Create game
          </button>
        </section>
        <section className="panel">
          <h2>Join with a code</h2>
          <p className="lede">Use the same name as the other screen. This device opens that seat.</p>
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
          <button className="primary" type="button" disabled={busy || name.trim().length === 0 || joinCode.trim().length < 4} onClick={joinGame}>
            Join game
          </button>
          </section>
      </div>
      {error ? <p className="error" style={{ marginTop: "1rem" }}>{error}</p> : null}
    </main>
  )
}

function ContinueGames() {
  const [games, setGames] = useState<RecentGame[]>([])

  useEffect(() => {
    const saved = loadRecent()
    let stop = false
    async function refresh() {
      const live: RecentGame[] = []
      for (const game of saved) {
        const response = await fetch(`/api/rooms/${game.code}`, { cache: "no-store" })
        if (response.status === 404) continue
        if (!response.ok) {
          live.push(game)
          continue
        }
        const data = await response.json()
        const scenario = SCENARIOS.find((item) => item.id === data.state?.scenarioId)
        live.push({
          code: game.code,
          scenarioId: data.state?.scenarioId ?? game.scenarioId,
          scenario: scenario?.title ?? game.scenario,
          turn: data.state?.phase === "over" ? "Finished" : data.state?.turn > 0 ? `Turn ${data.state.turn}` : "Setup",
        })
      }
      if (stop) return
      saveRecent(live)
      setGames(live)
    }
    void refresh()
    return () => {
      stop = true
    }
  }, [])

  if (games.length === 0) return null
  return (
    <section className="panel continue" data-testid="continue">
      <h2>Continue</h2>
      <div className="scenario-group">
        {games.map((game) => (
          <Link key={game.code} href={`/game/${game.code}`} className="scenario">
            <strong>{game.scenario}</strong>
            <small>{game.turn} · {game.code}</small>
          </Link>
        ))}
      </div>
    </section>
  )
}
