"use client"

import { useEffect, useState } from "react"
import type { Faction } from "@/lib/game/types"

const NAME_KEY = "mech-coach-name"
const FACTION_KEY = "mech-coach-faction"

export function usePlayer() {
  const [name, setNameState] = useState("")
  const [faction, setFactionState] = useState<Faction>("innerSphere")

  useEffect(() => {
    const saved = localStorage.getItem(NAME_KEY)
    if (saved) setNameState(saved)
    const side = localStorage.getItem(FACTION_KEY)
    if (side === "clan" || side === "innerSphere") setFactionState(side)
  }, [])

  function setName(next: string) {
    setNameState(next)
    localStorage.setItem(NAME_KEY, next)
  }

  function setFaction(next: Faction) {
    setFactionState(next)
    localStorage.setItem(FACTION_KEY, next)
  }

  return { name, setName, faction, setFaction }
}

export function FactionPicker({
  faction,
  setFaction,
}: {
  faction: Faction
  setFaction: (faction: Faction) => void
}) {
  return (
    <div className="sides" role="group" aria-label="Your side">
      <button type="button" aria-pressed={faction === "innerSphere"} onClick={() => setFaction("innerSphere")}>
        Inner Sphere
      </button>
      <button type="button" aria-pressed={faction === "clan"} onClick={() => setFaction("clan")}>
        Clan
      </button>
    </div>
  )
}
