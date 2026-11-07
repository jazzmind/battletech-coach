import { NextResponse } from "next/server"
import { createGame } from "@/lib/game/flow"
import { getScenario } from "@/lib/game/scenarios"
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
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The coach could not read that." }, { status: 400 })
  }
  if (!body.scenarioId || !getScenario(body.scenarioId)) {
    return NextResponse.json({ error: "Pick a scenario." }, { status: 400 })
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
        return NextResponse.json({ state, playerId })
      } catch (error) {
        if (error instanceof Error && error.message === "That code is already in use.") continue
        throw error
      }
    }
    return NextResponse.json({ error: "Could not make a code. Try again." }, { status: 500 })
  } catch (error) {
    if (error instanceof RuleError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: "The coach could not start the game." }, { status: 500 })
  }
}
