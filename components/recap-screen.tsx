"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { loadRecaps, type Recap } from "@/lib/recaps"
import { AppFrame } from "./app-frame"

export function RecapScreen({ code }: { code: string }) {
  const [recap, setRecap] = useState<Recap | null | undefined>(undefined)

  useEffect(() => {
    const found = loadRecaps().find((item) => item.code.toUpperCase() === code.toUpperCase())
    setRecap(found ?? null)
  }, [code])

  if (recap === undefined) {
    return (
      <AppFrame title="Record">
        <p>Opening the record…</p>
      </AppFrame>
    )
  }
  if (!recap) {
    return (
      <AppFrame title="No record">
        <p>This device has no record of {code}.</p>
        <Link href="/history" className="ghost back-link">
          History
        </Link>
      </AppFrame>
    )
  }

  const turns = new Map<number, Recap["log"]>()
  for (const line of recap.log) {
    const bucket = turns.get(line.turn) ?? []
    bucket.push(line)
    turns.set(line.turn, bucket)
  }

  return (
    <AppFrame title={recap.winner ? `${recap.winner} wins` : "Nobody lost"} lede={recap.chapter}>
      <article className="say">
        <p className="kicker">{recap.title}</p>
        <h2>{recap.winner ? `${recap.winner} wins` : "Nobody lost"}</h2>
        <p className="aloud">{recap.happened}</p>
      </article>
      {recap.ending ? <p className="ending">{recap.ending}</p> : null}
      <section className="panel">
        <h2>The mechs</h2>
        {recap.mechs.map((mech) => (
          <div key={`${mech.owner}-${mech.name}`} className={`row${mech.knockedOut ? " out" : ""}`}>
            <span className="who">{mech.owner}&apos;s {mech.name}</span>
            <span className="detail">
              {mech.knockedOut
                ? "Knocked out"
                : mech.armorLeft != null
                  ? `${mech.armorLeft} armor · ${mech.structureLeft ?? 0} structure`
                  : "Stayed on the table"}
            </span>
          </div>
        ))}
      </section>
      {recap.log.length > 0 ? (
        <section className="panel">
          <h2>The record</h2>
          {[...turns.entries()].map(([turn, lines]) => (
            <div key={turn} className="log-turn">
              <p className="kicker">{turn > 0 ? `Turn ${turn}` : "Setup"}</p>
              {lines.map((line, index) => (
                <p key={`${turn}-${index}`} className={`log-line${line.side ? ` log-${line.side}` : ""}`}>
                  {line.text}
                </p>
              ))}
            </div>
          ))}
        </section>
      ) : (
        <p className="note">This fight was saved before the turn record. The summary above is the whole record.</p>
      )}
      <Link href="/history" className="ghost back-link">
        History
      </Link>
    </AppFrame>
  )
}
