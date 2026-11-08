"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { present } from "@/lib/game/present"
import { SCENARIOS } from "@/lib/game/scenarios"
import type { Action, GameState, Screen } from "@/lib/game/types"
import { loadPlayerId, savePlayerId } from "@/lib/ids"
import { rememberGame } from "@/lib/recent"
import { Mark } from "./mark"
import { TableLook } from "./table-look"

export function CoachScreen({ code }: { code: string }) {
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState("")
  const [poolFor, setPoolFor] = useState<string | null>(null)
  const [lookOpen, setLookOpen] = useState(false)

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

  useEffect(() => {
    if (!state) return
    const scenario = SCENARIOS.find((item) => item.id === state.scenarioId)
    rememberGame({
      code: state.code,
      scenarioId: state.scenarioId,
      scenario: scenario?.title ?? state.scenarioId,
      turn: state.phase === "over" ? "Finished" : state.turn > 0 ? `Turn ${state.turn}` : "Setup",
    })
  }, [state])

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
        <p>That table is gone. Check the code, or go back and start another.</p>
        <Link href="/" className="primary back-link" data-testid="go-back">Go back</Link>
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
          {error ? (
            <div className="error">
              <p>{error}</p>
              <Link href="/" className="ghost back-link" data-testid="go-back">Go back</Link>
            </div>
          ) : null}
          <Link href="/" className="games-link">Games</Link>
        </section>
      </main>
    )
  }

  const screen = present(state, playerId)
  return (
    <main className="wrap table">
      <header className="top">
        <div className="brand">
          <Mark />
          <div>
            <h1>Table Coach</h1>
            <p>{screen.hud.scenario}</p>
          </div>
        </div>
        <div className="top-actions">
          <Link href="/" className="games-link">Games</Link>
          <div className="code-pill" data-testid="room-code">{screen.code}</div>
        </div>
      </header>
      <div className="play">
        <aside className={`hud${lookOpen ? " look-open" : ""}`}>
          <h2>{screen.hud.turn}</h2>
          <p className="meta">{screen.hud.scenario}</p>
          {screen.hud.goal ? <p className="goal" data-testid="goal">{screen.hud.goal}</p> : null}
          <div className="hud-body">
          {screen.hud.rows.map((row) => (
            <div key={row.name} className={`row${row.mine ? " mine" : ""}${row.out ? " out" : ""}`}>
              <span className="who">{row.name}</span>
              <span className="detail">{row.detail}</span>
            </div>
          ))}
          </div>
          <div className="hud-tools">
            {screen.undo ? (
              <button
                className="icon-btn"
                type="button"
                aria-label="Undo last tap"
                title="Undo last tap"
                disabled={busy}
                onClick={() => void send(screen.undo as Action)}
              >
                <UndoIcon />
              </button>
            ) : null}
            <TableLook
              screen={screen}
              playerName={state.players.find((player) => player.id === playerId)?.name ?? name}
              onOpenChange={setLookOpen}
            />
          </div>
        </aside>
        <section className="stage">
          <ScrollPane className="stage-scroll story-pane" testId="story" more="More story below" watch={`${screen.say}:${screen.tip?.title ?? ""}:${screen.mission?.chapter ?? ""}`}>
          <p className="pane-tag">Story</p>
          <article className="say">
            <p className="kicker">{screen.kicker}</p>
            <h2 data-testid="title">{screen.title}</h2>
            <p className="aloud" data-testid="say">{screen.say}</p>
          </article>
          {screen.mission ? (
            <section className="mission" data-testid="mission">
              <p className="kicker">{screen.mission.unit}</p>
              <p><strong>Goal. </strong>{screen.mission.goal}</p>
              <p><strong>Orders. </strong>{screen.mission.orders}</p>
              <p className="kicker">How to think</p>
              <ol>
                {screen.mission.plan.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </section>
          ) : null}
          {screen.lesson ? (
            <p className="lesson">
              {screen.over ? <span className="kicker">What we learned</span> : screen.lessonKicker ? <span className="kicker">{screen.lessonKicker}</span> : null}
              {screen.lesson}
            </p>
          ) : null}
          {screen.tip ? (
            <aside className="tip" data-testid="tip">
              <p className="kicker">{screen.tip.title}</p>
              <p>{screen.tip.text}</p>
            </aside>
          ) : null}
          {screen.ending ? <p className="ending" data-testid="ending">{screen.ending}</p> : null}
          {screen.note ? <p className="note">{screen.note}</p> : null}
          {screen.gallery && screen.gallery.length > 0 ? (
            <div className="gallery">
              {screen.gallery.map((photo) => (
                <a key={photo.page} href={photo.page} target="_blank" rel="noreferrer">
                  {photo.name}, painted by {photo.painter}
                </a>
              ))}
            </div>
          ) : null}
          {screen.roster ? (
            <div className="roster">
              {screen.roster.map((card) => (
                <div key={card.mechId} className="roster-card">
                  <h3>{card.name}</h3>
                  <p>{card.owner}</p>
                  {card.options.length > 0 && poolFor !== card.mechId ? (
                    <button className="ghost" type="button" disabled={busy} onClick={() => setPoolFor(card.mechId)}>
                      Choose a different mech
                    </button>
                  ) : null}
                  {poolFor === card.mechId ? (
                    <div className="swaps">
                      <button className="ghost" type="button" onClick={() => setPoolFor(null)}>
                        Keep {card.name}
                      </button>
                      {card.options.map((option) => (
                        <button key={option.name} type="button" disabled={busy} onClick={() => void send(option.action)}>
                          {option.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {screen.over?.winner ? <p className="lesson">Clear the fallen minis. The cards stay marked until you wipe them.</p> : null}
          </ScrollPane>
          <ScrollPane className={`dock button-pane${screen.active ? " live" : ""}`} testId="dock" more="More buttons below" watch={`${screen.title}:${screen.choices.length}:${screen.pad?.label ?? ""}`}>
            <p className="pane-tag">Buttons</p>
            <p className={`cue${screen.active ? " yours" : ""}`} data-testid="cue">
              <i />
              {busy ? "Sending that tap…" : screen.active ? "Your turn. Tap a button." : screen.wait ? screen.wait : screen.over ? "The fight is over." : "Watch the table."}
            </p>
            {error ? (
              <div className="error">
                <p>{error}</p>
                <Link href="/" className="ghost back-link" data-testid="go-back">Go back</Link>
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
            {screen.over ? (
              <Link href="/" className="primary back-link">All games</Link>
            ) : null}
          </ScrollPane>
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
      <p className="pad-label">{pad.label}</p>
      {numbers.map((value) => (
        <button key={value} type="button" data-testid={`pad-${value}`} disabled={disabled} onClick={() => onPick(value)}>
          {value}
        </button>
      ))}
    </div>
  )
}

function ScrollPane({
  className,
  testId,
  more,
  watch,
  children,
}: {
  className: string
  testId: string
  more: string
  watch: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      const leftover = el.scrollHeight - el.scrollTop - el.clientHeight
      setHasMore(leftover > 12)
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    el.addEventListener("scroll", check, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener("scroll", check)
    }
  }, [watch])

  return (
    <div ref={ref} className={`${className}${hasMore ? " has-more" : ""}`} data-testid={testId}>
      {children}
      {hasMore ? <p className="more-hint">{more}</p> : null}
    </div>
  )
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 8H4v4M4.5 8.5A8 8 0 1 1 6 18"
      />
    </svg>
  )
}

function padAction(screen: Screen, playerId: string, value: number): Action {
  const kind = screen.pad?.kind
  if (kind === "initiative") return { type: "initiative", playerId, roll: value }
  if (kind === "dice") return { type: "dice", playerId, roll: value }
  if (kind === "jump") return { type: "jumpInches", playerId, inches: value }
  if (kind === "band") return { type: "band", playerId, amount: value }
  if (kind === "star") return { type: "star", playerId, roll: value }
  if (kind === "overheat") return { type: "overheat", playerId, amount: value }
  return { type: "card", playerId, field: screen.pad?.field ?? "walk", value }
}
