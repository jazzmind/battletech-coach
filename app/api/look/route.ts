import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const JPEG = "data:image/jpeg;base64,"

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? ""
  const key = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : ""
  if (!key) {
    return NextResponse.json({ error: "Add your xAI key on this device." }, { status: 401 })
  }
  let body: { image?: string; prompt?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The picture did not arrive." }, { status: 400 })
  }
  if (!body.image?.startsWith(JPEG)) {
    return NextResponse.json({ error: "Send a JPEG of your side of the table." }, { status: 400 })
  }
  if (body.image.length > 2_000_000) {
    return NextResponse.json({ error: "That picture is too big. Move the camera back and try again." }, { status: 413 })
  }
  if (!body.prompt || body.prompt.length > 4_000) {
    return NextResponse.json({ error: "The coach could not describe this step." }, { status: 400 })
  }

  let response: Response
  try {
    response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.7",
        input: [
          {
            role: "user",
            content: [
              { type: "input_image", image_url: body.image, detail: "high" },
              { type: "input_text", text: body.prompt },
            ],
          },
        ],
      }),
    })
  } catch {
    return NextResponse.json({ error: "xAI could not look at that picture." }, { status: 502 })
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return NextResponse.json({ error: "xAI could not look at that picture." }, { status: 502 })
  }
  const text = readText(payload)
  if (!text) return NextResponse.json({ error: "xAI sent back an empty look." }, { status: 502 })
  return NextResponse.json(
    { text },
    { headers: { "cache-control": "no-store" } },
  )
}

function readText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return ""
  const output = (payload as { output?: unknown }).output
  if (!Array.isArray(output)) return ""
  const parts: string[] = []
  for (const item of output) {
    if (!item || typeof item !== "object") continue
    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const piece of content) {
      if (!piece || typeof piece !== "object") continue
      const text = (piece as { text?: unknown }).text
      if (typeof text === "string" && text.trim()) parts.push(text.trim())
    }
  }
  return parts.join("\n")
}
