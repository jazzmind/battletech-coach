"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { loadRecent, type RecentGame } from "@/lib/recent"
import { AppFrame } from "./app-frame"

const TILES = [
  { href: "/learn", title: "Learn", text: "The eleven games from the box, one rule at a time." },
  { href: "/join", title: "Join", text: "Type the code from the other screen and sit down." },
  { href: "/create", title: "Create", text: "Bring your own force and a table made from what you own." },
  { href: "/history", title: "History", text: "Open a fight still on the table, or read a finished record." },
]

export function MenuScreen() {
  const [live, setLive] = useState<RecentGame | null>(null)

  useEffect(() => {
    const game = loadRecent().find((item) => item.turn !== "Finished")
    setLive(game ?? null)
  }, [])

  return (
    <AppFrame title="Table Coach" lede="One choice at a time, on both screens.">
      {live ? (
        <Link href={`/game/${live.code}`} className="resume">
          Back to the table · {live.scenario} · {live.code}
        </Link>
      ) : null}
      <div className="menu-grid">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="menu-tile">
            <strong>{tile.title}</strong>
            <span>{tile.text}</span>
          </Link>
        ))}
      </div>
    </AppFrame>
  )
}
