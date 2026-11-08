import { NextResponse } from "next/server"
import { createGame, createPickupGame } from "@/lib/game/flow"
import { getScenario } from "@/lib/game/scenarios"
import { BOX_INVENTORY, type ObjectiveType, type PickupInventory, type TableSize, type TerrainKind } from "@/lib/scenario-gen/layout"
import { RuleError } from "@/lib/game/types"
import { makeCode } from "@/lib/ids"
import { createRoom } from "@/lib/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: {
    scenarioId?: string
    name?: string
    faction?: string
    playerId?: string
    kind?: string
    budget?: number
    table?: string
    objective?: string
    inventory?: Partial<PickupInventory>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "The coach could not read that." },
      { status: 400, headers: { "cache-control": "no-store" } },
    )
  }
  if (body.kind === "pickup") {
    const tables: TableSize[] = ["3x3", "3x4", "4x6"]
    const objectives: ObjectiveType[] = ["fight", "center", "markers", "breakthrough"]
    const budgets = [150, 250, 350]
    if (!tables.includes(body.table as TableSize) || !objectives.includes(body.objective as ObjectiveType)) {
      return NextResponse.json({ error: "Pick a table and an objective." }, { status: 400 })
    }
    if (!budgets.includes(body.budget ?? 0)) {
      return NextResponse.json({ error: "Pick a 150, 250, or 350 point budget." }, { status: 400 })
    }
    const inventory = { ...BOX_INVENTORY }
    for (const key of Object.keys(BOX_INVENTORY) as TerrainKind[]) {
      const value = body.inventory?.[key]
      if (value == null) continue
      if (!Number.isInteger(value) || value < 0 || value > 12) {
        return NextResponse.json({ error: "Terrain counts should be 0 to 12." }, { status: 400 })
      }
      inventory[key] = value
    }
    const faction = body.faction === "clan" ? "clan" : "innerSphere"
    const playerId = typeof body.playerId === "string" && body.playerId.length >= 8 ? body.playerId : crypto.randomUUID()
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = makeCode()
        const state = createPickupGame({
          code,
          hostId: playerId,
          hostName: body.name ?? "",
          faction,
          table: body.table as TableSize,
          objective: body.objective as ObjectiveType,
          inventory,
          seed: crypto.randomUUID(),
          pvBudget: body.budget ?? 250,
        })
        try {
          await createRoom(state)
          return NextResponse.json({ state, playerId }, { headers: { "cache-control": "no-store" } })
        } catch (error) {
          if (error instanceof Error && error.message === "That code is already in use.") continue
          throw error
        }
      }
      return NextResponse.json({ error: "Could not make a code. Try again." }, { status: 500 })
    } catch (error) {
      if (error instanceof RuleError) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      console.error(error)
      return NextResponse.json({ error: "The coach could not start the game." }, { status: 500 })
    }
  }
  if (!body.scenarioId || !getScenario(body.scenarioId)) {
    return NextResponse.json(
      { error: "Pick a scenario." },
      { status: 400, headers: { "cache-control": "no-store" } },
    )
  }
  const faction = body.faction === "clan" ? "clan" : "innerSphere"
  const playerId = typeof body.playerId === "string" && body.playerId.length >= 8 ? body.playerId : crypto.randomUUID()
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = makeCode()
      const state = createGame({
        code,
        scenarioId: body.scenarioId,
        hostId: playerId,
        hostName: body.name ?? "",
        faction,
      })
      try {
        await createRoom(state)
        return NextResponse.json({ state, playerId }, { headers: { "cache-control": "no-store" } })
      } catch (error) {
        if (error instanceof Error && error.message === "That code is already in use.") continue
        throw error
      }
    }
    return NextResponse.json(
      { error: "Could not make a code. Try again." },
      { status: 500, headers: { "cache-control": "no-store" } },
    )
  } catch (error) {
    if (error instanceof RuleError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: { "cache-control": "no-store" } })
    }
    console.error(error)
    return NextResponse.json(
      { error: "The coach could not start the game." },
      { status: 500, headers: { "cache-control": "no-store" } },
    )
  }
}
