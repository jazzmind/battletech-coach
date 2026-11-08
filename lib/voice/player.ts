"use client"

import { SPEAKERS, type Speaker, type VoiceLine } from "../game/script"
import { CAST } from "./cast"
import { recordingFor } from "./manifest"

type Listener = (state: { playing: string | null; who: Speaker | null }) => void

let run = 0
let audio: HTMLAudioElement | null = null
let playing: string | null = null
let speaking: Speaker | null = null
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener({ playing, who: speaking })
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  listener({ playing, who: speaking })
  return () => listeners.delete(listener)
}

export function stop() {
  run += 1
  if (audio) {
    audio.pause()
    audio = null
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
  playing = null
  speaking = null
  emit()
}

// iOS only lets a page speak after a tap has started speech once.
export function unlock() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  const blank = new SpeechSynthesisUtterance(" ")
  blank.volume = 0
  window.speechSynthesis.speak(blank)
}

export async function play(id: string, lines: readonly VoiceLine[]): Promise<void> {
  stop()
  const mine = run
  playing = id
  emit()
  for (const line of lines) {
    if (run !== mine) return
    speaking = line.who
    emit()
    const recording = recordingFor(line.key)
    const played = recording ? await playFile(recording.file, mine) : false
    if (!played && run === mine) await speakLine(line)
  }
  if (run !== mine) return
  playing = null
  speaking = null
  emit()
}

function playFile(file: string, mine: number): Promise<boolean> {
  return new Promise((resolve) => {
    const element = new Audio(file)
    audio = element
    element.onended = () => resolve(true)
    element.onerror = () => resolve(false)
    element.play().catch(() => resolve(false))
    const check = setInterval(() => {
      if (run === mine) return
      clearInterval(check)
      resolve(true)
    }, 200)
    element.addEventListener("ended", () => clearInterval(check))
    element.addEventListener("error", () => clearInterval(check))
  })
}

function speakLine(line: VoiceLine): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve()
    const utterance = new SpeechSynthesisUtterance(line.say)
    const cast = CAST[line.who].browser
    const voice = pickVoice(line.who)
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = "en-US"
    }
    utterance.pitch = cast.pitch
    utterance.rate = cast.rate
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

export function pickVoice(who: Speaker): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return undefined
  const prefer = CAST[who].browser.prefer
  for (const name of prefer) {
    const match = voices.find((voice) => voice.name === name || voice.name.startsWith(`${name} `))
    if (match) return match
  }
  for (const name of prefer) {
    const match = voices.find((voice) => voice.name.includes(name))
    if (match) return match
  }
  // No named match: spread the speakers over whatever English voices this device has.
  const english = voices.filter((voice) => voice.lang.startsWith("en"))
  if (english.length === 0) return undefined
  return english[SPEAKERS.indexOf(who) % english.length]
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.addEventListener?.("voiceschanged", () => window.speechSynthesis.getVoices())
}
