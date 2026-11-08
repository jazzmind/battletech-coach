"use client"

import { useState } from "react"
import type { CardFace, DamageBox } from "@/lib/game/cards"
import { importForce } from "@/lib/forces/jeffs"
import type { Screen } from "@/lib/game/types"
import { RuleError } from "@/lib/game/types"

const STEPS = [
  { key: "walk", min: 1, max: 30, label: "Walk inches" },
  { key: "tmm", min: 0, max: 5, label: "TMM" },
  { key: "size", min: 1, max: 4, label: "Size" },
  { key: "armor", min: 0, max: 16, label: "Armor bubbles" },
  { key: "structure", min: 0, max: 12, label: "Structure bubbles" },
  { key: "ov", min: 0, max: 6, label: "Overheat boxes" },
  { key: "skill", min: 0, max: 8, label: "Skill" },
  { key: "pv", min: 0, max: 80, label: "Point value" },
  { key: "short", min: 0, max: 10, label: "Short damage" },
  { key: "medium", min: 0, max: 10, label: "Medium damage" },
  { key: "long", min: 0, max: 10, label: "Long damage" },
] as const

type StepKey = (typeof STEPS)[number]["key"]

export function DraftPanel({
  draft,
  busy,
  onBring,
  onField,
}: {
  draft: NonNullable<Screen["draft"]>
  busy: boolean
  onBring: (cards: CardFace[], skipped: string[], replace: boolean) => void
  onField: (ids: string[]) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [paste, setPaste] = useState("")
  const [typing, setTyping] = useState(false)

  function take(raw: unknown, replace: boolean) {
    try {
      const force = importForce(raw)
      if (force.cards.length === 0 && force.skipped.length === 0) {
        setError("That file has no units.")
        return
      }
      setError(null)
      onBring(
        force.cards,
        force.skipped.map((unit) => `${unit.name} (${unit.type}) is not coached yet`),
        replace,
      )
    } catch (caught) {
      setError(caught instanceof RuleError ? caught.message : "That file could not be read.")
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      take(JSON.parse(await file.text()), true)
    } catch {
      setError("That file is not JSON.")
    }
  }

  const selected = draft.mine.filter((card) => card.selected).map((card) => card.id)

  return (
    <section className="draft" data-testid="draft">
      <p>
        {draft.spent} of {draft.budget} PV
      </p>
      <label className="file">
        Import a force file
        <input
          type="file"
          accept="application/json,.json"
          data-testid="force-file"
          disabled={busy}
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
      </label>
      <label>
        Or paste the export
        <textarea value={paste} onChange={(event) => setPaste(event.target.value)} rows={3} data-testid="force-paste" />
      </label>
      <button
        type="button"
        className="ghost"
        disabled={busy || paste.trim().length === 0}
        onClick={() => {
        try {
          take(JSON.parse(paste), true)
        } catch {
          setError("That paste is not JSON.")
        }
      }}
      >
        Use this export
      </button>
      <button type="button" className="ghost" disabled={busy} onClick={() => setTyping((open) => !open)}>
        {typing ? "Close the card" : "Type in a card"}
      </button>
      {typing ? (
        <CardWizard
          busy={busy}
          onDone={(card) => {
            setTyping(false)
            onBring([card], [], false)
          }}
        />
      ) : null}
      {draft.mine.length > 0 ? (
        <div className="scenario-group">
          {draft.mine.map((card) => (
            <button
              key={card.id}
              type="button"
              className="scenario"
              aria-pressed={card.selected}
              disabled={busy}
              onClick={() => {
                const next = card.selected ? selected.filter((id) => id !== card.id) : [...selected, card.id]
                onField(next)
              }}
            >
              <strong>{card.name}</strong>
              <small>
                {card.side} · {card.pv > 0 ? `${card.pv} PV` : "PV not on the card"}
              </small>
            </button>
          ))}
        </div>
      ) : null}
      {draft.skipped.length > 0 ? <p className="note">{draft.skipped.join(" ")}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  )
}

function CardWizard({ busy, onDone }: { busy: boolean; onDone: (card: CardFace) => void }) {
  const [name, setName] = useState("")
  const [named, setNamed] = useState(false)
  const [phase, setPhase] = useState<"jump-ask" | "jump-inches" | "stats">("stats")
  const [step, setStep] = useState(0)
  const [jump, setJump] = useState<number | null>(null)
  const [star, setStar] = useState(false)
  const [values, setValues] = useState<Partial<Record<StepKey, number>>>({})
  const [bands, setBands] = useState<{ short: DamageBox; medium: DamageBox; long: DamageBox }>({
    short: 0,
    medium: 0,
    long: 0,
  })

  if (!named) {
    return (
      <form
        className="wizard"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) setNamed(true)
        }}
      >
        <label>
          Mech name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} data-testid="card-name" />
        </label>
        <button type="submit" className="primary" disabled={name.trim().length === 0}>
          Next
        </button>
      </form>
    )
  }

  if (phase === "jump-ask") {
    return (
      <div className="wizard">
        <p className="pad-label">{name}: does the move line show a j?</p>
        <div className="choices">
          <button type="button" onClick={() => setPhase("jump-inches")}>
            Yes, it jumps
          </button>
          <button
            type="button"
            onClick={() => {
              setJump(null)
              setPhase("stats")
            }}
          >
            No jump
          </button>
        </div>
      </div>
    )
  }

  if (phase === "jump-inches") {
    return (
      <div className="wizard">
        <p className="pad-label">{name}: inches next to the j</p>
        <div className="pad" aria-label="Jump inches">
          {numbersFor(1, 30).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setJump(value)
                setPhase("stats")
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const current = STEPS[step]
  if (!current) return null
  const damage = current.key === "short" || current.key === "medium" || current.key === "long"

  function store(value: number) {
    const next = { ...values, [current.key]: value }
    const nextBands = { ...bands }
    if (current.key === "short" || current.key === "medium" || current.key === "long") {
      nextBands[current.key] = star && value === 0 ? "star" : value
    }
    setValues(next)
    setBands(nextBands)
    setStar(false)
    if (current.key === "walk") {
      setStep(1)
      setPhase("jump-ask")
      return
    }
    if (step + 1 < STEPS.length) {
      setStep(step + 1)
      return
    }
    onDone({
      id: `typed-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "mech"}-${Date.now()}`,
      name: name.trim(),
      side: "card",
      faction: "innerSphere",
      walk: next.walk ?? 1,
      jump,
      tmm: next.tmm ?? 0,
      size: next.size ?? 1,
      armor: next.armor ?? 0,
      structure: next.structure ?? 1,
      ov: next.ov ?? 0,
      short: current.key === "short" ? (star && value === 0 ? "star" : value) : nextBands.short,
      medium: current.key === "medium" ? (star && value === 0 ? "star" : value) : nextBands.medium,
      long: current.key === "long" ? (star && value === 0 ? "star" : value) : nextBands.long,
      specials: [],
      pv: next.pv,
      skill: next.skill,
      unitType: "BM",
    })
  }

  return (
    <div className="wizard">
      <p className="pad-label">
        {name}: {current.label}
      </p>
      {damage ? (
        <button type="button" className="ghost" aria-pressed={star} onClick={() => setStar((on) => !on)}>
          0 with a star
        </button>
      ) : null}
      <div className="pad" aria-label={current.label}>
        {numbersFor(current.min, current.max).map((value) => (
          <button key={value} type="button" disabled={busy} data-testid={`card-${current.key}-${value}`} onClick={() => store(value)}>
            {value}
          </button>
        ))}
      </div>
    </div>
  )
}

function numbersFor(min: number, max: number): number[] {
  const numbers: number[] = []
  for (let value = min; value <= max; value += 1) numbers.push(value)
  return numbers
}
