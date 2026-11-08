"use client"

import type { Screen } from "@/lib/game/types"
import { TableMap } from "./table-map"

export function Minimap({ map, onOpen }: { map: NonNullable<Screen["map"]>; onOpen: () => void }) {
  return (
    <button type="button" className="minimap" aria-label="Open the battlefield map" onClick={onOpen}>
      <TableMap map={map} compact />
      <span className="minimap-caption">Battlefield · click to expand</span>
    </button>
  )
}
