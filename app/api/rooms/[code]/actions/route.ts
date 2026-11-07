import { NextResponse } from "next/server"
import { applyAction } from "@/lib/game/flow"
import type { Action } from "@/lib/game/types"
import { RuleError } from "@/lib/game/types"
import { getRoom, updateRoom } from "@/lib/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ code: string }> }

export async function POST(request: Request, context: Context) {
  const { code } = await context.params
  const current = await getRoom(code)
  if (!current) return NextResponse.json({ error: "No game with that code." }, { status: 404 })
  let body: { playerId?: string; expectedVersion?: number; action?: Action }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The coach could not read that." }, { status: 400 })
  }
  if (!body.action || typeof body.playerId !== "string" || typeof body.expectedVersion !== "number") {
    return NextResponse.json({ error: "That tap was missing a piece." }, { status: 400 })
  }
  if (current.version !== body.expectedVersion) {
    return NextResponse.json({ error: "The table moved. Updating.", state: current }, { status: 409 })
  }
  const action = { ...body.action, playerId: body.playerId } as Action
  try {
    const next = applyAction(current, action)
    const saved = await updateRoom(code, current.version, next)
    if (!saved.ok) {
      return NextResponse.json(
        { error: "The table moved. Updating.", state: saved.current },
        { status: 409 },
      )
    }
    return NextResponse.json({ state: next })
  } catch (error) {
    if (error instanceof RuleError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: "The coach could not do that." }, { status: 500 })
  }
}
