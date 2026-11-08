import data from "./manifest.json"

export type Recording = { file: string; seconds: number; text: string }
export type Caption = { start: number; end: number; text: string }
export type Clip = { url: string; seconds: number; poster?: string; captions: Caption[] }
export type Manifest = { lines: Record<string, Recording>; clips: Record<string, Clip>; lineClips?: Record<string, Clip> }

export const MANIFEST = data as Manifest

export function recordingFor(key: string): Recording | undefined {
  return MANIFEST.lines[key]
}

export function clipFor(id: string): Clip | undefined {
  return MANIFEST.clips[id]
}

export function lineClipFor(key: string): Clip | undefined {
  return MANIFEST.lineClips?.[key]
}
