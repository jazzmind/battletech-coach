"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BOX_INVENTORY, TERRAIN_LABEL, type ObjectiveType, type PickupInventory, type TableSize, type TerrainKind } from "@/lib/scenario-gen/layout"
import { loadPlayerId, savePlayerId } from "@/lib/ids"
import { AppFrame } from "./app-frame"
import { FactionPicker, usePlayer } from "./use-player"

const TERRAIN_KEYS = Object.keys(BOX_INVENTORY) as TerrainKind[]

export function CreateScreen() {
  const router = useRouter()
  const { name, setName, faction, setFaction } = usePlayer()
  const [budget, setBudget] = useState(250)
  const [table, setTable] = useState<TableSize>("3x4")
  const [objective, setObjective] = useState<ObjectiveType>("center")
  const [inventory, setInventory] = useState<PickupInventory>(BOX_INVENTORY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem("mech-coach-terrain")
    if (!saved) return
    try {
      const parsed = JSON.parse(saved) as Partial<PickupInventory>
      setInventory({ ...BOX_INVENTORY, ...parsed })
    } catch {
      localStorage.removeItem("mech-coach-terrain")
    }
  }, [])

  async function createPickup() {
    setBusy(true)
    setError(null)
    localStorage.setItem("mech-coach-terrain", JSON.stringify(inventory))
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "pickup",
        name,
        faction,
        playerId: loadPlayerId(),
        budget,
        table,
        objective,
        inventory,
      }),
    })
    const data = await response.json()
    setBusy(false)
    if (!response.ok) {
      setError(data.error ?? "The battle did not launch. Try again.")
      return
    }
    if (typeof data.playerId === "string") savePlayerId(data.playerId)
    router.push(`/game/${data.state.code}`)
  }

  return (
    <AppFrame
      title="Create"
      lede="A pickup battle. Import your force from Jeff's Tools or Terminal, or type in the cards. The coach lays out a battlefield using only the terrain you own."
    >
      <section className="panel">
        <label>
          Pilot name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} />
        </label>
        <FactionPicker faction={faction} setFaction={setFaction} />
        <p className="group-title">Point budget per side</p>
        <div className="sides" role="group" aria-label="Point budget">
          {[150, 250, 350].map((value) => (
            <button key={value} type="button" aria-pressed={budget === value} onClick={() => setBudget(value)}>
              {value} PV
            </button>
          ))}
        </div>
        <p className="group-title">Table size</p>
        <div className="sides" role="group" aria-label="Table size">
          {(["3x3", "3x4", "4x6"] as TableSize[]).map((value) => (
            <button key={value} type="button" aria-pressed={table === value} onClick={() => setTable(value)}>
              {value} ft
            </button>
          ))}
        </div>
        <p className="group-title">Mission</p>
        <div className="scenario-group">
          {(
            [
              ["fight", "Stand-up fight"],
              ["center", "Hold the center"],
              ["markers", "Two or three beacons"],
              ["breakthrough", "Breakthrough"],
            ] as [ObjectiveType, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" className="scenario" aria-pressed={objective === id} onClick={() => setObjective(id)}>
              <strong>{label}</strong>
            </button>
          ))}
        </div>
        <p className="group-title">Terrain you own</p>
        <div className="counts">
          {TERRAIN_KEYS.map((kind) => (
            <label key={kind}>
              {TERRAIN_LABEL[kind]}
              <input
                type="number"
                min={0}
                max={12}
                value={inventory[kind]}
                onChange={(event) => setInventory({ ...inventory, [kind]: Number(event.target.value) })}
              />
            </label>
          ))}
        </div>
        <button className="primary" type="button" disabled={busy || name.trim().length === 0} onClick={() => void createPickup()}>
          Issue the challenge
        </button>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </AppFrame>
  )
}
