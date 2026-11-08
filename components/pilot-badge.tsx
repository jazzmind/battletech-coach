"use client"

import Link from "next/link"
import { factionLabel } from "@/lib/game/scenarios"
import { usePlayer } from "./use-player"

export function PilotBadge({ next }: { next: string }) {
  const { name, faction, ready } = usePlayer()
  if (!ready) return null
  if (name.trim().length === 0) {
    return (
      <div className="pilot-empty">
        <p>No pilot yet. Set your name and faction first.</p>
        <Link href={`/pilot?next=${encodeURIComponent(next)}`} className="primary back-link">Set up pilot</Link>
      </div>
    )
  }
  return (
    <div className="pilot-badge">
      <span><small>Pilot</small> {name}</span>
      <span><small>Faction</small> {factionLabel(faction)}</span>
      <Link href={`/pilot?next=${encodeURIComponent(next)}`}>Change</Link>
    </div>
  )
}
