"use client"

import { useEffect, useState } from "react"
import { present } from "@/lib/game/present"
import type { Action, GameState, Screen } from "@/lib/game/types"
import { loadPlayerId, savePlayerId } from "@/lib/ids"
import { Mark } from "./mark"

export function CoachScreen({ code }: { code: string }) {
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState("")

  useEffect(() => {
    setPlayerId(loadPlayerId())
    const saved = localStorage.getItem("mech-coach-name")
    if (saved) setName(saved)
  }, [])

  useEffect(() => {
    if (!playerId) return
    let stop = false
    async function pull() {
      const response = await fetch(`/api/rooms/${code}`, { cache: "no-store" })
      if (stop) return
      if (response.status === 404) {
        setMissing(true)
        return
      }
      const data = await response.json()
      setState((previous) => {
        if (!data.state) return previous
        if (!previous || data.state.version >= previous.version) return data.state
        return previous
      })
    }
    void pull()
    const timer = setInterval(() => void pull(), 1000)
    return () => {
      stop = true
      clearInterval(timer)
    }
  }, [code, playerId])

  async function send(action: Action, version = state?.version) {
    if (!playerId || version == null) return
    setBusy(true)
    setError(null)
    const response = await fetch(`/api/rooms/${code}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, expectedVersion: version, action }),
    })
    const data = await response.json()
    if (data.state) setState(data.state)
    if (!response.ok && response.status !== 409) setError(data.error ?? "Try that again.")
    setBusy(false)
  }

  async function join() {
    setBusy(true)
    setError(null)
    localStorage.setItem("mech-coach-name", name.trim())
    const response = await fetch(`/api/rooms/${code}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, playerId }),
    })
    const data = await response.json()
    if (typeof data.playerId === "string") {
      savePlayerId(data.playerId)
      setPlayerId(data.playerId)
    }
    if (data.state) setState(data.state)
    const seat = data.state?.players?.find((player: { id: string; name: string }) => player.id === data.playerId)
    if (seat?.name) {
      localStorage.setItem("mech-coach-name", seat.name)
      setName(seat.name)
    }
    if (!response.ok) setError(data.error ?? "Could not join.")
    setBusy(false)
  }

  if (!playerId) return <main className="wrap"><p>Opening the table…</p></main>
  if (missing) {
    return (
      <main className="wrap">
        <h1>No game {code}</h1>
        <p>Check the code and try again.</p>
      </main>
    )
  }
  if (!state) return <main className="wrap"><p>Looking for the table…</p></main>

  const seated = state.players.some((player) => player.id === playerId)
  if (!seated) {
    return (
      <main className="wrap">
        <header className="brand">
          <Mark />
          <div>
            <h1>Join {code}</h1>
            <p>Type the name you used on the other screen. This device shows that seat.</p>
            <p>Already at the table: {state.players.map((player) => player.name).join(" and ")}.</p>
          </div>
        </header>
        <section className="panel" style={{ marginTop: "1rem" }}>
          <label>
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} />
          </label>
          <button className="primary" type="button" disabled={busy || name.trim().length === 0} onClick={() => void join()}>
            Sit down
          </button>
          {error ? <p className="error">{error}</p> : null}
        </section>
      </main>
    )
  }

  const screen = present(state, playerId)
  return (
    <main className="wrap">
      <header className="top">
        <div className="brand">
          <Mark />
          <div>
            <h1>Table Coach</h1>
            <p>{screen.hud.scenario}</p>
          </div>
        </div>
        <div className="code-pill" data-testid="room-code">{screen.code}</div>
      </header>
      <div className="play">
        <aside className="hud">
          <h2>{screen.hud.turn}</h2>
          <p className="meta">{screen.hud.scenario}</p>
          {screen.hud.rows.map((row) => (
            <div key={row.name} className={`row${row.mine ? " mine" : ""}${row.out ? " out" : ""}`}>
              <span className="who">{row.name}</span>
              <span className="detail">{row.detail}</span>
            </div>
          ))}
        </aside>
        <section className="stage">
          <article className="say">
            <p className="kicker">{screen.kicker}</p>
            <h2 data-testid="title">{screen.title}</h2>
            <p className="aloud" data-testid="say">{screen.say}</p>
          </article>
          {screen.lesson ? <p className="lesson">{screen.lesson}</p> : null}
          {screen.note ? <p className="note">{screen.note}</p> : null}
          {screen.wait ? <p className="wait" data-testid="wait">{screen.wait}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {screen.roster ? (
            <div className="roster">
              {screen.roster.map((card) => (
                <div key={card.mechId} className="roster-card">
                  <h3>{card.name}</h3>
                  <p>{card.owner}</p>
                  <div className="swaps">
                    {card.options.map((option) => (
                      <button key={option.name} type="button" disabled={busy} onClick={() => void send(option.action)}>
                        {option.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {screen.choices.length > 0 ? (
            <div className="choices">
              {screen.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  data-testid={`choice-${choice.id}`}
                  disabled={busy}
                  onClick={() => void send(choice.action)}
                >
                  <strong>{choice.label}</strong>
                  {choice.hint ? <span>{choice.hint}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
          {screen.pad ? <Pad screen={screen} disabled={busy} onPick={(value) => void send(padAction(screen, playerId, value))} /> : null}
          {screen.undo ? (
            <button className="ghost" type="button" disabled={busy} onClick={() => void send(screen.undo as Action)}>
              Undo last tap
            </button>
          ) : null}
          {screen.over ? <p className="lesson">Clear the fallen minis. The cards stay marked until you wipe them.</p> : null}
        </section>
      </div>
    </main>
  )
}

function Pad({
  screen,
  disabled,
  onPick,
}: {
  screen: Screen
  disabled: boolean
  onPick: (value: number) => void
}) {
  const pad = screen.pad
  if (!pad) return null
  const numbers = []
  for (let value = pad.min; value <= pad.max; value += 1) numbers.push(value)
  return (
    <div className="pad" aria-label={pad.label}>
      {numbers.map((value) => (
        <button key={value} type="button" data-testid={`pad-${value}`} disabled={disabled} onClick={() => onPick(value)}>
          {value}
        </button>
      ))}
    </div>
  )
}

function padAction(screen: Screen, playerId: string, value: number): Action {
  const kind = screen.pad?.kind
  if (kind === "initiative") return { type: "initiative", playerId, roll: value }
  if (kind === "dice") return { type: "dice", playerId, roll: value }
  if (kind === "jump") return { type: "jumpInches", playerId, inches: value }
  if (kind === "band") return { type: "band", playerId, amount: value }
  if (kind === "overheat") return { type: "overheat", playerId, amount: value }
  return { type: "card", playerId, field: screen.pad?.field ?? "walk", value }
}
