"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { present } from "@/lib/game/present"
import { CATALOG } from "@/lib/game/scenarios"
import type { Action, GameState, Screen } from "@/lib/game/types"
import { loadPlayerId, savePlayerId } from "@/lib/ids"
import { rememberGame } from "@/lib/recent"
import { recapOf, saveRecap } from "@/lib/recaps"
import type { VoiceLine } from "@/lib/game/script"
import { play, stop, unlock } from "@/lib/voice/player"
import { BriefingClip } from "./briefing-clip"
import { DraftPanel } from "./draft-panel"
import { autoLines, type AudioSettings } from "@/lib/voice/auto"
import { GameToolbar } from "./game-toolbar"
import { Mark } from "./mark"
import { Minimap } from "./minimap"
import { Modal } from "./modal"
import { ReadAloud } from "./read-aloud"
import { StoryTheater } from "./story-theater"
import { loadStoryView, saveStoryView, StoryViewToggle, type StoryView } from "./story-view-toggle"
import { TableMap } from "./table-map"

export function CoachScreen({ code }: { code: string }) {
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState("")
  const [poolFor, setPoolFor] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [mechsOpen, setMechsOpen] = useState(false)
  const [portrait, setPortrait] = useState<{ name: string; art: string } | null>(null)
  const [cameraAsk, setCameraAsk] = useState(0)
  const [audio, setAudio] = useState<AudioSettings>({ story: true, steps: false })
  const [view, setView] = useState<StoryView>("watch")

  useEffect(() => {
    setPlayerId(loadPlayerId())
    const saved = localStorage.getItem("mech-coach-name")
    if (saved) setName(saved)
    setAudio({ story: localStorage.getItem(STORY_KEY) !== "0", steps: localStorage.getItem(STEPS_KEY) === "1" })
    setView(loadStoryView())
  }, [])

  function changeView(next: StoryView) {
    stop()
    saveStoryView(next)
    setView(next)
  }

  function changeAudio(next: AudioSettings) {
    localStorage.setItem(STORY_KEY, next.story ? "1" : "0")
    localStorage.setItem(STEPS_KEY, next.steps ? "1" : "0")
    if (next.story || next.steps) unlock()
    else stop()
    setAudio(next)
  }

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
    const scenario = CATALOG.find((item) => item.id === state.scenarioId)
    rememberGame({
      code: state.code,
      scenarioId: state.scenarioId,
      scenario: state.customScenario?.title ?? scenario?.title ?? state.scenarioId,
      turn: state.phase === "over" ? "Finished" : state.turn > 0 ? `Turn ${state.turn}` : "Setup",
    })
    if (state.phase === "over" && playerId) saveRecap(recapOf(state, playerId))
  }, [state, playerId])

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
            <h1>Battle {code}</h1>
            <p>Switching devices? Enter the pilot name you used on the other screen to take that seat.</p>
            <p>Pilots in this battle: {state.players.map((player) => player.name).join(" and ")}.</p>
          </div>
        </header>
        <section className="panel" style={{ marginTop: "1rem" }}>
          <label>
            Pilot name
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} />
          </label>
          <button className="primary" type="button" disabled={busy || name.trim().length === 0} onClick={() => void join()}>
            Take my seat
          </button>
          {error ? (
            <div className="error">
              <p>{error}</p>
              <Link href="/" className="ghost back-link" data-testid="go-back">Back to Home</Link>
            </div>
          ) : null}
          <Link href="/" className="games-link">Home</Link>
        </section>
      </main>
    )
  }

  const screen = present(state, playerId)
  const showDock = !screen.over && (screen.choices.length > 0 || Boolean(screen.pad) || Boolean(screen.wait) || Boolean(error))
  const playerName = state.players.find((player) => player.id === playerId)?.name ?? name
  const storyLines = screen.voice?.mission
    ? [...screen.voice.mission, ...(screen.voice.lesson ?? [])]
    : (screen.voice?.interlude ?? screen.voice?.ending)
  const hasStory = Boolean(storyLines && storyLines.length > 0)
  const watching = view === "watch" && hasStory
  const storyNames = {
    innerSphere: state.players.find((player) => player.faction === "innerSphere")?.name ?? "the Lyrans",
    clan: state.players.find((player) => player.faction === "clan")?.name ?? "the Falcons",
  }
  const playLabel = screen.voice?.mission ? "Play briefing" : screen.voice?.interlude ? "Play the radio" : "Play the ending"
  const showMinimap = Boolean(screen.map && screen.map.where !== "stage")
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
        <div className="command-bar">
          <GameToolbar
            code={screen.code}
            busy={busy}
            undo={screen.undo}
            hasMap={Boolean(screen.map)}
            audio={audio}
            screen={screen}
            playerName={playerName}
            cameraAsk={cameraAsk}
            onUndo={() => void send(screen.undo as Action)}
            onMap={() => setMapOpen(true)}
            onAudio={changeAudio}
          />
        </div>
        <div className="code-pill" data-testid="room-code">{screen.code}</div>
      </header>
      <div className="play">
        <aside className="hud">
          <button type="button" className="hud-strip" onClick={() => setMechsOpen(true)}>
            <span>{screen.hud.turn}</span>
            <span>{screen.hud.goal ?? screen.hud.scenario}</span>
          </button>
          <div className="hud-head">
            <h2>{screen.hud.turn}</h2>
            <p className="meta">{screen.hud.scenario}</p>
            {screen.hud.goal ? <p className="goal" data-testid="goal">{screen.hud.goal}</p> : null}
          </div>
          <div className="hud-body">
          {screen.hud.rows.map((row) => (
            <div key={row.id} className={`row${row.mine ? " mine" : ""}${row.out ? " out" : ""}`}>
              {row.art ? (
                <button type="button" className="mech-thumb" aria-label={`${row.name} portrait`} onClick={() => setPortrait({ name: row.name, art: row.art as string })}>
                  <img src={row.art} alt="" />
                </button>
              ) : null}
              <span className="who">{row.name}</span>
              <span className="detail">{row.detail}</span>
            </div>
          ))}
          </div>
          <AutoRead screen={screen} audio={audio} view={view} />
        </aside>
        <section className="stage">
          <ScrollPane className="stage-scroll story-pane" testId="story" more="More story below" watch={`${screen.say}:${screen.tip?.title ?? ""}:${screen.mission?.chapter ?? ""}`}>
          {hasStory ? (
            <div className="story-bar">
              <p className="kicker">{screen.kicker}</p>
              <StoryViewToggle view={view} onChange={changeView} />
            </div>
          ) : (
            <p className="pane-tag">Story</p>
          )}
          <article className={`say${watching ? " story-compact" : ""}`}>
            {hasStory ? null : <p className="kicker">{screen.kicker}</p>}
            <h2 data-testid="title">{screen.title}</h2>
            {watching ? null : <p className="aloud" data-testid="say">{screen.say}</p>}
          </article>
          {watching && storyLines ? (
            <StoryTheater
              key={`${screen.kicker}|${screen.title}|${screen.ending ?? ""}|${screen.interlude?.title ?? ""}`}
              lines={storyLines}
              clip={screen.voice?.mission ? screen.voice.clip : undefined}
              clipAt={screen.voice?.mission ? screen.voice.clipAt : undefined}
              clipSpan={screen.voice?.mission ? screen.voice.clipSpan : undefined}
              scene={screen.voice?.scene}
              names={storyNames}
              playLabel={playLabel}
              autoplay={audio.story}
              active={watching}
              onRead={() => changeView("read")}
            />
          ) : null}
          {!watching && screen.interlude ? (
            <section className="mission interlude" data-testid="interlude">
              <ReadAloud lines={screen.voice?.interlude} label="Play the radio" testId="read-interlude" />
              <p className="kicker">{screen.interlude.title}</p>
              <p>{screen.interlude.text}</p>
            </section>
          ) : null}
          {screen.mission ? (
            <section className="mission" data-testid="mission">
              {watching ? null : <ReadAloud lines={screen.voice?.mission} label="Read the briefing" testId="read-briefing" />}
              {watching ? null : <BriefingClip id={screen.voice?.clip} from={screen.voice?.clip?.endsWith(".clan") ? "Galaxy Command" : "Garrison Command"} />}
              <p className="kicker">{screen.mission.unit}</p>
              <p><strong>Goal. </strong>{screen.mission.goal}</p>
              {watching ? null : <p><strong>Orders. </strong>{screen.mission.orders}</p>}
              {watching ? null : <p className="kicker">How to think</p>}
              {watching ? null : (
                <ol>
                  {screen.mission.plan.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              )}
            </section>
          ) : null}
          {screen.review && screen.lesson ? (
            <p className="lesson">
              <span className="kicker">Still in force</span>
              {screen.review}
            </p>
          ) : null}
          {screen.lesson ? (
            <p className="lesson">
              {screen.over ? <span className="kicker">What we learned</span> : screen.lessonKicker ? <span className="kicker">{screen.lessonKicker}</span> : null}
              {screen.lesson}
              <ReadAloud lines={screen.voice?.lesson} label="Read the rule" testId="read-lesson" />
            </p>
          ) : null}
          {screen.tip ? (
            <aside className="tip" data-testid="tip">
              <p className="kicker">{screen.tip.title}</p>
              <p>{screen.tip.text}</p>
            </aside>
          ) : null}
          {screen.map?.where === "stage" ? <TableMap map={screen.map} /> : null}
          {screen.check ? (
            <button type="button" className="camera-cta" onClick={() => setCameraAsk((value) => value + 1)}>
              Check the spot with the camera
            </button>
          ) : null}
          {screen.draft ? (
            <DraftPanel
              draft={screen.draft}
              busy={busy}
              onBring={(cards, skipped, replace) => void send({ type: "bring", playerId, cards, skipped, replace })}
              onField={(variantIds) => void send({ type: "field", playerId, variantIds })}
            />
          ) : null}
          {!watching && screen.ending ? (
            <div className="ending" data-testid="ending">
              <ReadAloud lines={screen.voice?.ending} label="Read the ending" testId="read-ending" />
              <p>{screen.ending}</p>
            </div>
          ) : null}
          {screen.links ? (
            <p className="ending">
              Build the next list in{" "}
              {screen.links.map((link, index) => (
                <span key={link.href}>
                  {index > 0 ? (index === screen.links!.length - 1 ? " or " : ", ") : null}
                  <a href={link.href}>{link.label}</a>
                </span>
              ))}
              .
            </p>
          ) : null}
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
          {screen.over ? (
            <div className="end-actions">
              <button type="button" className="primary" onClick={() => saveRecap(recapOf(state, playerId))}>
                File the report
              </button>
              <Link href={`/history/${screen.code}`} className="ghost back-link">
                Read the after-action report
              </Link>
              <Link href="/" className="ghost back-link">Home</Link>
            </div>
          ) : null}
          {screen.over?.winner ? <p className="lesson">Clear the fallen minis. The cards stay marked until you wipe them.</p> : null}
          </ScrollPane>
        </section>
        {showDock || showMinimap ? (
        <div className="rail">
        {showDock ? (
          <ScrollPane className={`dock button-pane${screen.active ? " live" : ""}`} testId="dock" more="More buttons below" watch={`${screen.title}:${screen.choices.length}:${screen.pad?.label ?? ""}`}>
            <p className={`cue${screen.active ? " yours" : ""}`} data-testid="cue">
              <i />
              {busy ? "Sending…" : screen.active ? "Your move." : screen.wait ? screen.wait : "Stand by. Watch the table."}
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
          </ScrollPane>
        ) : null}
        {showMinimap && screen.map ? <Minimap map={screen.map} onOpen={() => setMapOpen(true)} /> : null}
        </div>
        ) : null}
      </div>
      {screen.map ? (
        <Modal open={mapOpen} title="Battlefield map" wide onClose={() => setMapOpen(false)}>
          <TableMap map={screen.map} />
        </Modal>
      ) : null}
      <Modal open={mechsOpen} title="Forces on the field" onClose={() => setMechsOpen(false)}>
        {screen.hud.rows.map((row) => (
          <div key={row.id} className={`row${row.mine ? " mine" : ""}${row.out ? " out" : ""}`}>
            {row.art ? (
              <button type="button" className="mech-thumb" aria-label={`${row.name} portrait`} onClick={() => setPortrait({ name: row.name, art: row.art as string })}>
                <img src={row.art} alt="" />
              </button>
            ) : null}
            <span className="who">{row.name}</span>
            <span className="detail">{row.detail}</span>
          </div>
        ))}
      </Modal>
      <Modal open={portrait != null} title={portrait?.name ?? "Mech"} onClose={() => setPortrait(null)}>
        {portrait ? <img className="mech-full" src={portrait.art} alt={portrait.name} /> : null}
      </Modal>
    </main>
  )
}

const STORY_KEY = "mech-coach-story-audio"
const STEPS_KEY = "mech-coach-step-audio"

function AutoRead({ screen, audio, view }: { screen: Screen; audio: AudioSettings; view: StoryView }) {
  const key = `${screen.kicker}|${screen.title}|${screen.say}|${screen.interlude?.title ?? ""}|${screen.ending ?? ""}`
  const linesRef = useRef<VoiceLine[]>([])
  linesRef.current = autoLines(screen, audio, view)

  useEffect(() => {
    if (linesRef.current.length === 0) return
    void play("auto", linesRef.current)
  }, [audio.story, audio.steps, key, view])

  useEffect(() => () => stop(), [])
  return null
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
