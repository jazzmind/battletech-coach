import type { Speaker, VoiceLine } from "../game/script"
import { CAST } from "./cast"

export type Segment =
  | { kind: "video"; id: string; lines: VoiceLine[] }
  | { kind: "still"; line: VoiceLine; image: string | null }

export function buildSegments(input: {
  lines: VoiceLine[]
  clip?: string
  clipAt?: number
  clipSpan?: number
  lineClips?: Record<string, unknown>
  scene?: string
  portraits?: Partial<Record<Speaker, string>>
}): Segment[] {
  const portraits = input.portraits ?? portraitMap()
  const lineClips = input.lineClips ?? {}
  const segments: Segment[] = []
  let index = 0
  while (index < input.lines.length) {
    const line = input.lines[index]
    if (lineClips[line.key]) {
      segments.push({ kind: "video", id: `line:${line.key}`, lines: [line] })
      index += 1
      continue
    }
    const span = input.clipSpan ?? 0
    if (input.clip && input.clipAt != null && index === input.clipAt && span > 0) {
      const lines = input.lines.slice(index, index + span)
      segments.push({ kind: "video", id: input.clip, lines })
      index += lines.length
      continue
    }
    segments.push({ kind: "still", line, image: stillImage(line.who, input.scene, portraits) })
    index += 1
  }
  return segments
}

function stillImage(who: Speaker, scene: string | undefined, portraits: Partial<Record<Speaker, string>>): string | null {
  if (who === "narrator") return scene ?? null
  return portraits[who] ?? null
}

function portraitMap(): Partial<Record<Speaker, string>> {
  const map: Partial<Record<Speaker, string>> = {}
  for (const who of Object.keys(CAST) as Speaker[]) {
    if (CAST[who].portrait) map[who] = CAST[who].portrait
  }
  return map
}

export function lineCount(segments: Segment[]): number {
  return segments.reduce((sum, segment) => sum + (segment.kind === "video" ? segment.lines.length : 1), 0)
}

export function lineAt(segments: Segment[], index: number): { segment: Segment; local: number; start: number } | undefined {
  let cursor = 0
  for (const segment of segments) {
    const size = segment.kind === "video" ? segment.lines.length : 1
    if (index < cursor + size) return { segment, local: index - cursor, start: cursor }
    cursor += size
  }
  return undefined
}
