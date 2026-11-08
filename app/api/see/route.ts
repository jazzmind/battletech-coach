import { NextResponse } from "next/server"
import { authConfigured, getAuth } from "@/lib/auth"
import { chargeLook } from "@/lib/see-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const JPEG = "data:image/jpeg;base64,"

export async function POST(request: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: "Sign in with your email to check the table." }, { status: 401 })
  }
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in with your email to check the table." }, { status: 401 })
  }
  let body: { image?: string; mech?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The picture did not arrive." }, { status: 400 })
  }
  const mech = body.mech?.trim() ?? ""
  if (!mech || mech.length > 24) {
    return NextResponse.json({ error: "The coach does not know which mini to look for." }, { status: 400 })
  }
  if (!body.image?.startsWith(JPEG)) {
    return NextResponse.json({ error: "Send a JPEG of the table." }, { status: 400 })
  }
  if (body.image.length > 2_000_000) {
    return NextResponse.json({ error: "That picture is too big. Move the camera back and try again." }, { status: 413 })
  }
  const key = process.env.TYPESAFE_API_KEY
  if (!key) {
    return NextResponse.json({ error: "The camera check is not set up on this server. The ring is still the spot." }, { status: 503 })
  }

  const allowance = await chargeLook(session.user.id)
  if (allowance.result === "block") {
    const error = allowance.burst
      ? "Wait a moment, then take another picture. The ring is still the spot."
      : "The camera check is paused on this account. You can still put the mini on the ring."
    return NextResponse.json({ error }, { status: 429 })
  }

  let response: Response
  try {
    response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "TypeSafe-Danger-Zone-Images": "true",
      },
      body: JSON.stringify({
        model: "jev-1.14.0",
        state: "photo",
        assets: {
          photo: { type: "image", format: "jpeg", data_base64: body.image.slice(JPEG.length) },
        },
        questions: {
          where: { type: "box", instructions: `the ${mech} miniature on the table in photo` },
          present: { type: "noul", instructions: `Is the ${mech} miniature visible in photo?` },
        },
      }),
    })
  } catch {
    return NextResponse.json({ error: "I can't tell from here. The ring on the diagram is still the spot." }, { status: 502 })
  }
  if (!response.ok) {
    return NextResponse.json({ error: "I can't tell from here. The ring on the diagram is still the spot." }, { status: 502 })
  }
  const data = (await response.json()) as {
    answers?: {
      where?: { confidence?: number | null }
      present?: { noul?: number }
    }
  }
  const seen = (data.answers?.present?.noul ?? 0) >= 0.6
  const confidence = data.answers?.where?.confidence
  const placed = confidence == null || confidence >= 0.4
  if (seen && placed) {
    return NextResponse.json({ text: `I can see the ${mech}. Put it on the ring if it is not there yet.` })
  }
  return NextResponse.json({ text: "I can't tell from here. The ring on the diagram is still the spot." })
}
