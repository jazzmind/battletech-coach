"use client"

import { useEffect, useState } from "react"
import type { Faction } from "@/lib/game/types"
import { RadioCards } from "./radio-cards"

const NAME_KEY = "mech-coach-name"
const FACTION_KEY = "mech-coach-faction"

export function usePlayer() {
  const [name, setNameState] = useState("")
  const [faction, setFactionState] = useState<Faction>("innerSphere")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(NAME_KEY)
    if (saved) setNameState(saved)
    const side = localStorage.getItem(FACTION_KEY)
    if (side === "clan" || side === "innerSphere") setFactionState(side)
    setReady(true)
  }, [])

  function setName(next: string) {
    setNameState(next)
    localStorage.setItem(NAME_KEY, next)
  }

  function setFaction(next: Faction) {
    setFactionState(next)
    localStorage.setItem(FACTION_KEY, next)
  }

  return { name, setName, faction, setFaction, ready }
}

export function FactionPicker({
  faction,
  setFaction,
}: {
  faction: Faction
  setFaction: (faction: Faction) => void
}) {
  return (
    <RadioCards
      legend="Faction"
      name="faction"
      value={faction}
      onChange={setFaction}
      options={[
        { value: "innerSphere", title: "Inner Sphere", subtitle: "Lyran Commonwealth · Twycross Garrison", image: "/art/pilots/lyran.jpg" },
        { value: "clan", title: "Clan", subtitle: "Clan Jade Falcon", image: "/art/pilots/falcon.jpg" },
      ]}
    />
  )
}
