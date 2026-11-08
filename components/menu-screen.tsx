"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { loadRecent, type RecentGame } from "@/lib/recent"
import { AppFrame } from "./app-frame"

const TILES = [
  { href: "/learn", title: "Learn", text: "The Twycross campaign. Eleven missions from the box, each adding one rule." },
  { href: "/join", title: "Join", text: "Another pilot has issued a challenge. Enter the code and take your seat." },
  { href: "/create", title: "Create", text: "A pickup battle with your own force, on a battlefield made from the terrain you own." },
  { href: "/history", title: "History", text: "Battles still in the field, and after-action reports from this device." },
]

export function MenuScreen() {
  const [live, setLive] = useState<RecentGame | null>(null)

  useEffect(() => {
    const game = loadRecent().find((item) => item.turn !== "Finished")
    setLive(game ?? null)
  }, [])

  return (
    <AppFrame title="Table Coach" lede="Alpha Strike. Twycross, 3050." nav={false}>
      {live ? (
        <Link href={`/game/${live.code}`} className="resume">
          Rejoin the fight · {live.scenario} · {live.code}
        </Link>
      ) : null}
      <section className="intro">
        <article className="say">
          <p className="kicker">Briefing</p>
          <h2>The Jade Falcons have landed.</h2>
          <p>
            Table Coach runs a game of BattleTech: Alpha Strike for two MechWarriors at one table. Each of you opens it on
            your own phone or tablet. It tells you whose move it is, what to roll, and which bubbles to mark on your card.
          </p>
          <p>The minis, the cards, the dice, and the tape measure stay on the table. The coach never rolls for you.</p>
        </article>
      </section>
      <div className="menu-grid">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="menu-tile">
            <strong>{tile.title}</strong>
            <span>{tile.text}</span>
          </Link>
        ))}
      </div>
      <section className="intro intro-steps">
        <div className="panel">
          <h2>How a battle starts</h2>
          <ol>
            <li>One pilot picks a mission in Learn, or sets up a pickup battle in Create. That screen shows a four-letter code.</li>
            <li>The other pilot opens Join on their own device and enters the code.</li>
            <li>Play together. Each screen only shows the buttons for its own pilot.</li>
          </ol>
          <p className="kit">
            You need the Alpha Strike box set, or your own minis and cards, plus two dice and a tape measure.
          </p>
        </div>
      </section>
    </AppFrame>
  )
}
