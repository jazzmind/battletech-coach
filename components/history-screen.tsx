"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { SCENARIOS } from "@/lib/game/scenarios"
import { forgetRecent, loadRecent, saveRecent, type RecentGame } from "@/lib/recent"
import { deleteRecap, loadRecaps, type Recap } from "@/lib/recaps"
import { AppFrame } from "./app-frame"
import { Modal } from "./modal"

export function HistoryScreen() {
  const [live, setLive] = useState<RecentGame[]>([])
  const [recaps, setRecaps] = useState<Recap[]>([])
  const [pending, setPending] = useState<Recap | null>(null)

  useEffect(() => {
    setRecaps(loadRecaps())
    const saved = loadRecent()
    let stop = false
    async function refresh() {
      const running: RecentGame[] = []
      for (const game of saved) {
        const response = await fetch(`/api/rooms/${game.code}`, { cache: "no-store" })
        if (response.status === 404) continue
        if (!response.ok) {
          if (game.turn !== "Finished") running.push(game)
          continue
        }
        const data = await response.json()
        if (data.state?.phase === "over") continue
        const scenario = SCENARIOS.find((item) => item.id === data.state?.scenarioId)
        running.push({
          code: game.code,
          scenarioId: data.state?.scenarioId ?? game.scenarioId,
          scenario: data.state?.customScenario?.title ?? scenario?.title ?? game.scenario,
          turn: data.state?.turn > 0 ? `Turn ${data.state.turn}` : "Setup",
        })
      }
      if (stop) return
      saveRecent(running)
      setLive(running)
    }
    void refresh()
    return () => {
      stop = true
    }
  }, [])

  function remove(recap: Recap) {
    deleteRecap(recap.code)
    forgetRecent(recap.code)
    setRecaps(loadRecaps())
    setPending(null)
  }

  return (
    <AppFrame title="History" lede="Fights still on the table, and the records saved on this device.">
      <section className="panel">
        <h2>On the table</h2>
        {live.length === 0 ? <p className="lede">No game is waiting.</p> : null}
        <div className="scenario-group">
          {live.map((game) => (
            <Link key={game.code} href={`/game/${game.code}`} className="scenario">
              <strong>{game.scenario}</strong>
              <small>{game.turn} · {game.code}</small>
            </Link>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Records</h2>
        {recaps.length === 0 ? <p className="lede">Finished games are saved here when the fight ends.</p> : null}
        <div className="scenario-group">
          {recaps.map((recap) => (
            <article key={recap.code} className="chapter">
              <div>
                <strong>{recap.title}</strong>
                <small>
                  {recap.winner ? `${recap.winner} wins` : "Nobody lost"} · {recap.code}
                </small>
              </div>
              <div className="row-actions">
                <Link href={`/history/${recap.code}`}>View</Link>
                <button type="button" className="ghost" onClick={() => setPending(recap)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <Modal open={pending != null} title="Delete this record?" onClose={() => setPending(null)}>
        {pending ? (
          <>
            <p>
              {pending.title} ({pending.code}) leaves this device. The other player keeps their own copy.
            </p>
            <button type="button" className="primary" onClick={() => remove(pending)}>
              Delete the record
            </button>
          </>
        ) : null}
      </Modal>
    </AppFrame>
  )
}
