import { cardOf, miniByName } from "./cards"
import { adjustedMove } from "./math"
import { factionLabel, rosterFor, scenarioOf, speak } from "./scenarios"
import { toText } from "./script"
import { tipFor } from "./tips"
import { clipId } from "../voice/key"
import { briefingLines, endingLines, interludeFor, lessonLines, toVoice } from "../voice/lines"
import {
  currentCard,
  enemiesOf,
  modesFor,
  nextActivator,
  rulesOf,
  setupSteps,
} from "./flow"
import type { Action, Choice, GameState, Mech, MoveMode, Player, Rules, Screen } from "./types"

const MODE_LABEL: Record<MoveMode, { label: string; hint: string }> = {
  stand: { label: "Stand still", hint: "Less than 1 inch. Easier to hit, and your shot is one easier." },
  walk: { label: "Walk", hint: "Use the ground inches on the card." },
  jump: { label: "Jump", hint: "Use the inches next to the j. Ignore trees and buildings." },
  sprint: { label: "Sprint", hint: "One and a half times the walk inches. No shooting." },
  charge: { label: "Charge", hint: "End touching a mech that already moved. You both might take damage." },
  dfa: { label: "Death from above", hint: "Jump onto a mech that already moved. Risky if you miss." },
}

export function present(state: GameState, playerId: string): Screen {
  return finish(state, playerId, compose(state, playerId))
}

function finish(state: GameState, playerId: string, screen: Screen): Screen {
  const scenario = scenarioOf(state)
  screen.hud.goal = goalLine(state)
  if (state.layout) {
    const highlight = screen.map?.highlight
    const stage = state.phase === "lobby" || state.phase === "draft" || state.phase === "briefing" || state.phase === "place"
    screen.map = {
      where: stage ? "stage" : "look",
      width: state.layout.width,
      depth: state.layout.depth,
      zoneDepth: state.layout.zoneDepth,
      host: state.players[0]?.name ?? "Host",
      guest: state.players[1]?.name ?? "Guest",
      highlight,
      pieces: state.layout.pieces.map((piece) => ({
        number: piece.number,
        x: piece.x,
        y: piece.y,
        w: piece.w,
        h: piece.h,
        label: piece.label,
        blocksLos: piece.blocksLos,
      })),
      objectives: state.layout.objectives.map((item) => ({
        x: item.x,
        y: item.y,
        label: item.label,
        kind: item.kind,
      })),
      tokens: state.mechs
        .filter((mech) => mech.x != null && mech.y != null)
        .map((mech) => ({
          id: mech.id,
          name: mech.name,
          x: mech.x ?? 0,
          y: mech.y ?? 0,
          mine: mech.ownerId === playerId,
          out: mech.knockedOut,
        })),
    }
    const acting = state.mechs.find((mech) => mech.id === state.activeMechId)
    const order = acting?.order
    if (
      screen.map &&
      acting &&
      order &&
      state.solo &&
      state.phase === "move" &&
      state.step === "placed" &&
      acting.ownerId === state.coachId
    ) {
      screen.map.where = "stage"
      screen.map.order = { name: acting.name, x: order.x, y: order.y }
    }
  }
  if (state.phase !== "lobby" && state.phase !== "briefing" && state.phase !== "over" && state.phase !== "draft") {
    const tip = tipFor(state, playerId)
    if (tip) screen.tip = tip
  }
  const interlude = state.phase === "initiative" ? interludeFor(scenario, state.turn) : undefined
  if (interlude) {
    const names = seatNames(state)
    screen.interlude = { title: interlude.title, text: speak(toText(interlude.lines), names.innerSphere, names.clan) }
    screen.voice = { ...screen.voice, interlude: toVoice(interlude.lines, names) }
  }
  if (state.phase === "over") {
    const winner = state.players.find((player) => player.id === state.winnerId)
    const names = seatNames(state)
    const outcome = winner?.faction ?? "draw"
    screen.ending = speak(toText(scenario.ending[outcome]), names.innerSphere, names.clan)
    screen.voice = {
      ending: toVoice(endingLines(scenario, outcome), names),
      lesson: toVoice(lessonLines(scenario), names),
    }
  }
  return screen
}

function compose(state: GameState, playerId: string): Screen {
  const scenario = scenarioOf(state)
  const screen = blank(state, playerId)
  const me = state.players.find((player) => player.id === playerId)

  if (state.phase === "over") {
    const winner = state.players.find((player) => player.id === state.winnerId)
    screen.kicker = "What happened"
    screen.title = winner ? `${winner.name} holds the field` : "Both pilots stand down"
    screen.say = happened(state)
    screen.lesson = scenario.lesson
    screen.over = { winner: winner?.name ?? "", reason: state.winReason ?? "" }
    if (scenario.pickup) {
      screen.links = [
        { label: "Jeff's Tools", href: "https://jeffs-bt-tools.github.io/battletech-tools/" },
        { label: "Terminal", href: "https://terminal.tools/" },
        { label: "Wolfnet 350 rules", href: "https://wolfsdragoons.com/wp-content/uploads/2026/06/AS-350-3.1.pdf" },
      ]
    }
    return screen
  }

  if (state.phase === "lobby") {
    screen.kicker = scenario.title
    screen.title = state.code
    screen.say = scenario.pickup
      ? "Channel open. On the other screen, open this coach and type the code. Load your force while you wait."
      : "Channel open. On the other screen, open this coach and type the code. You will share one battle."
    screen.lesson = scenario.summary
    if (scenario.pickup && me) {
      screen.draft = draftOf(state, me)
      screen.active = true
      screen.choices = [{ id: "reroll", label: "New battlefield", action: { type: "reroll", playerId: me.id } }]
    }
    return screen
  }

  if (!me) {
    screen.kicker = scenario.title
    screen.title = state.code
    screen.say = "Both seats in this battle are taken."
    return screen
  }

  if (state.phase === "draft") return presentDraft(state, screen, me)
  if (state.phase === "briefing") return presentBriefing(state, screen, me)
  if (state.phase === "roster") return presentRoster(state, screen, me)
  if (state.phase === "gather") return presentGather(state, screen, me)
  if (state.phase === "place") return presentPlace(state, screen, me)
  if (state.phase === "cards") return presentCards(state, screen, me)
  if (state.phase === "initiative") return presentInitiative(state, screen, me)
  if (state.phase === "move") return presentMove(state, screen, me)
  if (state.phase === "combat") return presentCombat(state, screen, me)
  if (state.phase === "end") return presentEnd(state, screen, me)
  return screen
}

function presentBriefing(state: GameState, screen: Screen, me: Player): Screen {
  const scenario = scenarioOf(state)
  const names = seatNames(state)
  const fill = (text: string) => speak(text, names.innerSphere, names.clan)
  const side = scenario.sides[me.faction]
  screen.kicker = scenario.chapter
  screen.title = scenario.title
  screen.say = fill(toText(scenario.story))
  screen.lesson = scenario.lesson
  screen.lessonKicker = "New rule today"
  screen.voice = {
    mission: toVoice(briefingLines(scenario, me.faction), names),
    lesson: toVoice(lessonLines(scenario), names),
    clip: clipId(scenario.id, me.faction),
  }
  screen.mission = {
    chapter: scenario.chapter,
    story: fill(toText(scenario.story)),
    goal: scenario.goal,
    unit: side.unit,
    orders: fill(side.orders),
    plan: side.plan.map(fill),
  }
  if (scenario.pickup) {
    if (state.confirmations.includes(me.id)) {
      const other = otherPlayer(state, me.id)
      screen.wait = other ? `Stand by. ${other.name} has not confirmed yet.` : "Stand by."
      screen.active = false
      screen.choices = []
      return screen
    }
    screen.active = true
    screen.choices = [
      { id: "briefing-ok", label: "I know the plan", action: { type: "confirm", playerId: me.id } },
      { id: "reroll", label: "New battlefield", action: { type: "reroll", playerId: me.id } },
    ]
    return screen
  }
  return bothConfirm(state, screen, me, "briefing-ok", "I know the plan")
}

function presentDraft(state: GameState, screen: Screen, me: Player): Screen {
  const scenario = scenarioOf(state)
  screen.kicker = scenario.title
  screen.title = "Muster your force"
  screen.say = `${me.name}, Command needs your roster. Import a Jeff's Tools or Terminal file, or type a card. Then tick the mechs that fight. The budget is ${state.pvBudget ?? 0} PV.`
  screen.lesson = "Formations, pilot cards, and battlefield support stay off. Only BattleMechs are coached."
  screen.draft = draftOf(state, me)
  screen.active = !me.ready
  if (me.ready) {
    const other = otherPlayer(state, me.id)
    screen.wait = other?.ready
      ? "Both forces locked. Briefing coming up."
      : `Stand by. ${other?.name ?? "The other pilot"} is still locking a force.`
    return screen
  }
  screen.choices = [
    { id: "reroll", label: "New battlefield", action: { type: "reroll", playerId: me.id } },
    { id: "ready", label: "Lock this force", action: { type: "ready", playerId: me.id } },
  ]
  return screen
}

function draftOf(state: GameState, me: Player): NonNullable<Screen["draft"]> {
  const selected = new Set(state.mechs.filter((mech) => mech.ownerId === me.id).map((mech) => mech.variant))
  const mine = (state.pools[me.id] ?? []).map((id) => {
    const card = cardOf(state.cards, id)
    return { id, name: card.name, pv: card.pv ?? 0, side: card.side, selected: selected.has(id) }
  })
  return {
    budget: state.pvBudget ?? 0,
    mine,
    skipped: state.skipped[me.id] ?? [],
    spent: mine.filter((card) => card.selected).reduce((sum, card) => sum + card.pv, 0),
    ready: me.ready,
  }
}

function presentRoster(state: GameState, screen: Screen, me: Player): Screen {
  const scenario = scenarioOf(state)
  const seats = state.players.map((player) => {
    const names = state.mechs
      .filter((mech) => mech.ownerId === player.id)
      .map((mech) => `the ${mech.name}, side ${cardOf(state.cards, mech.variant).side}`)
    return `${player.name} uses ${joinList(names)}`
  })
  screen.kicker = "Muster"
  screen.title = "These mechs only"
  screen.say = scenario.pickup
    ? `${seats.join(". ")}. Take out these minis and their cards.`
    : `${seats.join(". ")}. Take those minis and their cards out of the box. Leave every other mech in the box. The skill box is blank. Write ${scenario.skill} in it for this game. Open the list only if you want to swap one.`
  screen.lesson = scenario.lesson
  screen.lessonKicker = "New rule today"
  screen.active = true
  screen.roster = state.mechs.map((mech) => {
    const owner = ownerOf(state, mech)
    const taken = new Set(state.mechs.map((other) => other.name))
    return {
      mechId: mech.id,
      name: mech.name,
      owner: `${owner.name} · ${factionLabel(owner.faction)}`,
      options: scenario.pickup
        ? []
        : rosterFor(owner.faction)
        .filter((name) => name !== mech.name && !taken.has(name))
        .map((name) => ({
          name,
          action: { type: "swap", playerId: me.id, mechId: mech.id, name } satisfies Action,
        })),
    }
  })
  if (!me.ready) {
    screen.choices = [
      {
        id: "ready",
        label: "Roster confirmed",
        action: { type: "ready", playerId: me.id },
      },
    ]
  } else {
    const other = otherPlayer(state, me.id)
    screen.wait = other ? `Stand by. ${other.name} is still checking the roster.` : "Stand by."
  }
  return screen
}

function presentGather(state: GameState, screen: Screen, me: Player): Screen {
  const scenario = scenarioOf(state)
  const names = state.players.map((player) => player.name).join(" and ")
  const mechs = state.mechs.map((mech) => `the ${mech.name}`)
  screen.kicker = "Prepare the battlefield"
  screen.title = "Take these out"
  screen.say = scenario.pickup
    ? `${names}. ${scenario.table} Take out ${joinList(mechs)} and their cards. Also take ${joinList(scenario.extraPieces)}.`
    : `${names}. ${scenario.table} Take out only ${joinList(mechs)}, with their cards. Also take ${joinList(scenario.extraPieces)}. Leave every other mech in the box.`
  screen.lesson = scenario.lesson
  screen.lessonKicker = "New rule today"
  const gallery = state.mechs.flatMap((mech) => {
    const photo = miniByName(mech.name)?.photo
    return photo ? [{ name: mech.name, painter: photo.painter, page: photo.page }] : []
  })
  if (gallery.length > 0) screen.gallery = gallery
  return bothConfirm(state, screen, me, "gather-ok", "Pieces are out")
}

function presentPlace(state: GameState, screen: Screen, me: Player): Screen {
  const steps = setupSteps(state)
  const step = steps[state.placeIndex]
  screen.kicker = `Setup ${state.placeIndex + 1} of ${steps.length}`
  screen.title = "Place terrain"
  screen.say = step ? step.say : "The battlefield is set."
  if (state.layout && step?.piece) {
    screen.map = {
      where: "stage",
      width: state.layout.width,
      depth: state.layout.depth,
      zoneDepth: state.layout.zoneDepth,
      host: state.players[0]?.name ?? "Host",
      guest: state.players[1]?.name ?? "Guest",
      highlight: step.piece,
      pieces: [],
      objectives: [],
    }
  }
  const actor = step ? (step.who === "host" ? state.players[0] : state.players[1]) : undefined
  if (!actor || !handsOn(state, me, actor.id)) {
    screen.wait = actor ? `Stand by. ${actor.name} is placing this piece.` : "Stand by. Watch the table."
    screen.active = false
    return screen
  }
  screen.active = true
  screen.choices = [{ id: "placed", label: "Piece placed", action: { type: "confirm", playerId: me.id } }]
  return screen
}

function presentCards(state: GameState, screen: Screen, me: Player): Screen {
  const scenario = scenarioOf(state)
  const current = currentCard(state)
  screen.kicker = "Record sheet check"
  if (!current) {
    screen.title = "Write the skill"
    screen.say = `The skill box on each card is blank. Write ${scenario.skill} in that box for this game. A regular pilot is ${scenario.skill}. When you shoot, roll two dice and add only the dice.`
    return bothConfirm(state, screen, me, "skill-written", "Skill is written")
  }
  const owner = ownerOf(state, current.mech)
  const side = cardOf(state.cards, current.mech.variant).side
  screen.title = current.mech.name
  const prompts: Record<string, string> = {
    walk: `${owner.name}, the ${current.mech.name} card should show the side labeled ${side}. What is the ground move in inches? Not the jump number. The skill box is blank. Write ${scenario.skill} there.`,
    armor: `${owner.name}, count the armor bubbles on the ${side} side of the ${current.mech.name}. Those are the open circles, not the red ones.`,
    structure: `${owner.name}, count the red structure bubbles on the ${side} side of the ${current.mech.name}.`,
    skill: `${owner.name}, what skill number is written on the ${current.mech.name} card? A regular pilot is 4. When it shoots, you roll two dice and add them. This skill is where that target starts. You do not add the skill to the dice.`,
    tmm: `${owner.name}, what is the TMM on the ${current.mech.name} card? That is the number that makes it harder to hit when it moves.`,
    ov: `${owner.name}, how many overheat boxes are on the ${current.mech.name} card before the S? Tap 0 if there is no OV.`,
    size: `${owner.name}, what size is the ${current.mech.name}? It is 1, 2, 3, or 4.`,
    jump: `${owner.name}, does the move line on the ${current.mech.name} show a j for jump?`,
    jumpInches: `${owner.name}, what are the inches next to the j on the ${current.mech.name} card?`,
  }
  screen.say = prompts[current.field]
  if (!handsOn(state, me, owner.id)) {
    screen.wait = `${owner.name} is reading the ${current.mech.name} card.`
    return screen
  }
  screen.active = true
  if (current.field === "jump") {
    screen.choices = [
      { id: "jump-yes", label: "Yes, it jumps", action: { type: "card", playerId: me.id, field: "jump", value: true } },
      { id: "jump-no", label: "No jump", action: { type: "card", playerId: me.id, field: "jump", value: false } },
    ]
    return screen
  }
  const pads = {
    walk: { min: 1, max: 30, label: "Walk inches" },
    armor: { min: 0, max: 16, label: "Armor bubbles" },
    structure: { min: 0, max: 12, label: "Structure bubbles" },
    skill: { min: 0, max: 8, label: "Skill" },
    tmm: { min: 0, max: 6, label: "TMM" },
    ov: { min: 0, max: 6, label: "Overheat boxes" },
    size: { min: 1, max: 4, label: "Size" },
    jumpInches: { min: 1, max: 30, label: "Jump inches" },
  } as const
  const pad = pads[current.field]
  screen.pad = { kind: "card", field: current.field, ...pad }
  return screen
}

function presentInitiative(state: GameState, screen: Screen, me: Player): Screen {
  screen.kicker = state.turn === 1 ? "First turn" : `Turn ${state.turn}`
  screen.title = "Roll initiative"
  screen.lesson = scenarioOf(state).lesson
  screen.lessonKicker = "New rule today"
  screen.say = "Each of you roll two dice and add them. Type that total. Do not add anything else. The lower roll moves first. A tie means roll again."
  if (state.initiative[me.id] == null) {
    screen.active = true
    screen.pad = { kind: "initiative", min: 2, max: 12, label: "Your total" }
    return screen
  }
  const other = otherPlayer(state, me.id)
  screen.wait = other ? `Stand by. ${other.name} has not sent a total yet.` : "Stand by for the other roll."
  return screen
}

function presentMove(state: GameState, screen: Screen, me: Player): Screen {
  screen.kicker = "Movement phase"
  if (state.step === "pick") {
    const next = nextActivator(state)
    if (!next) return screen
    const actor = playerById(state, next.playerId)
    screen.title = "Which mech moves?"
    screen.say = `${actor?.name ?? "You"}, you have the move. Pick the mech that moves now.`
    if (next.playerId !== me.id) {
      screen.wait = `Stand by. ${actor?.name ?? "The other pilot"} is picking a mech.`
      return screen
    }
    screen.active = true
    screen.choices = next.mechIds
      .map((id) => state.mechs.find((mech) => mech.id === id))
      .filter((mech): mech is Mech => Boolean(mech && !mech.shutdown))
      .map((mech) => ({
        id: mech.id,
        label: mech.name,
        hint: mech.shutdown ? "Shut down" : undefined,
        action: { type: "pickMech", playerId: me.id, mechId: mech.id },
      }))
    return screen
  }

  const mech = active(state)
  if (!mech) return screen
  const owner = ownerOf(state, mech)
  const mine = handsOn(state, me, owner.id)

  if (state.step === "pass") {
    screen.title = mech.name
    screen.say = mech.shutdown
      ? `${mech.name} is shut down. It stays where it is and cannot shoot. ${owner.name}, tap to continue.`
      : `${mech.name} has to stay. ${owner.name}, tap to continue.`
    return ownerOnly(screen, mine, owner.name, [
      { id: "pass", label: "Holding position", action: { type: "continue", playerId: me.id } },
    ])
  }

  if (state.step === "mode") {
    screen.title = mech.name
    screen.say = `${owner.name}, the ${mech.name} has the move. How does it move?`
    const modes = modesFor(state, mech)
    return ownerOnly(
      screen,
      mine,
      owner.name,
      modes.map((mode) => ({
        id: mode,
        label: MODE_LABEL[mode].label,
        hint: MODE_LABEL[mode].hint,
        action: { type: "moveMode", playerId: me.id, mode },
      })),
    )
  }

  if (state.step === "jump") {
    screen.title = mech.name
    screen.say = `${owner.name}, what are the jump inches on the ${mech.name} card?`
    if (!mine) {
      screen.wait = `${owner.name} is reading the jump inches.`
      return screen
    }
    screen.active = true
    screen.pad = { kind: "jump", min: 1, max: 30, label: "Jump inches" }
    return screen
  }

  if (state.step === "charge") {
    const kind = mech.moveMode === "dfa" ? "jump onto" : "charge"
    screen.title = mech.name
    screen.say = `${owner.name}, which mech already moved, and can the ${mech.name} ${kind} it?`
    const targets = state.mechs.filter(
      (other) => other.ownerId !== mech.ownerId && !other.knockedOut && state.moveOrder.includes(other.id),
    )
    return ownerOnly(
      screen,
      mine,
      owner.name,
      targets.map((target) => ({
        id: target.id,
        label: target.name,
        action: { type: "chargeTarget", playerId: me.id, targetId: target.id },
      })),
    )
  }

  if (state.step === "reach") {
    screen.title = mech.name
    screen.say = `${owner.name}, can you end this move touching that mech?`
    return ownerOnly(screen, mine, owner.name, [
      { id: "reach-yes", label: "Yes, I can reach", action: { type: "reach", playerId: me.id, yes: true } },
      { id: "reach-no", label: "No, pick another move", action: { type: "reach", playerId: me.id, yes: false } },
    ])
  }

  if (state.step === "placed") {
    screen.title = mech.name
    screen.say = placedSay(state, mech, owner)
    if (state.solo && owner.id === state.coachId) screen.check = { mech: mech.name }
    const label = state.solo && owner.id === state.coachId ? "It's on that spot" : "It's in its new spot"
    return ownerOnly(screen, mine, owner.name, [
      { id: "moved", label, action: { type: "continue", playerId: me.id } },
    ])
  }

  if (state.step === "terrain") {
    screen.title = "Check the inches"
    screen.say = `${owner.name}, did the tape stay inside the move? Clear ground costs 1 inch per inch. Trees cost 2. A climb costs extra. A step steeper than 2 inches is not allowed.`
    return ownerOnly(screen, mine, owner.name, [
      { id: "path-yes", label: "Yes, the path fits", action: { type: "terrain", playerId: me.id, ok: true } },
      { id: "path-no", label: "No, I'll move it again", action: { type: "terrain", playerId: me.id, ok: false } },
    ])
  }

  if (state.step === "water") {
    screen.title = mech.name
    screen.say = `${owner.name}, did the ${mech.name} end this move in water? Water cools one heat if it shoots.`
    return ownerOnly(screen, mine, owner.name, [
      { id: "water-yes", label: "Yes, it's in water", action: { type: "water", playerId: me.id, inWater: true } },
      { id: "water-no", label: "No water", action: { type: "water", playerId: me.id, inWater: false } },
    ])
  }

  if (state.step === "cover") {
    screen.title = mech.name
    screen.say = `${owner.name}, is the ${mech.name} touching a building or standing in the trees?`
    return ownerOnly(screen, mine, owner.name, [
      { id: "cover-yes", label: "Yes, it's in cover", action: { type: "cover", playerId: me.id, touching: true } },
      { id: "cover-no", label: "No cover", action: { type: "cover", playerId: me.id, touching: false } },
    ])
  }

  screen.say = "Moving."
  return screen
}

function presentCombat(state: GameState, screen: Screen, me: Player): Screen {
  const rules = rulesOf(state)
  const mech = active(state)
  screen.kicker = "Combat phase"
  if (!mech) {
    screen.say = "Combat is resolving."
    return screen
  }
  const owner = ownerOf(state, mech)
  const mine = handsOn(state, me, owner.id)
  const combat = state.combat
  const target = combat?.targetId ? state.mechs.find((item) => item.id === combat.targetId) : undefined

  if (state.step === "pass") {
    screen.title = mech.name
    screen.say =
      mech.moveMode === "sprint"
        ? `${mech.name} sprinted, so it cannot shoot. ${owner.name}, tap to continue.`
        : `${mech.name} is shut down, so it cannot shoot. ${owner.name}, tap to continue.`
    return ownerOnly(screen, mine, owner.name, [
      { id: "skip-shot", label: "Next", action: { type: "continue", playerId: me.id } },
    ])
  }

  if (state.step === "kind") {
    screen.title = mech.name
    screen.say = shotChoiceSay(owner.name, mech.name, rules)
    const choices: Choice[] = [
      {
        id: "shoot",
        label: "Shoot",
        hint: "Then roll two dice and add them. Tap that total. The coach counts skill and modifiers.",
        action: { type: "kind", playerId: me.id, kind: "weapon" },
      },
    ]
    if (rules.physical) {
      choices.push({
        id: "punch",
        label: "Punch",
        hint: "Within 1 inch. Damage equals its size. You cannot also shoot.",
        action: { type: "kind", playerId: me.id, kind: "physical" },
      })
      choices.push({
        id: "melee",
        label: "Melee",
        hint: "Only if the card says MEL. Within 2 inches. Damage is size plus 1.",
        action: { type: "kind", playerId: me.id, kind: "melee" },
      })
    }
    choices.push({
      id: "hold",
      label: "Hold fire",
      hint: "No roll, and no bubbles.",
      action: { type: "kind", playerId: me.id, kind: "hold" },
    })
    return ownerOnly(screen, mine, owner.name, choices)
  }

  if (state.step === "target") {
    screen.title = "Pick a target"
    screen.say = `${owner.name}, designate a target. Which enemy is the ${mech.name} attacking?`
    return ownerOnly(
      screen,
      mine,
      owner.name,
      enemiesOf(state, mech.ownerId).map((enemy) => ({
        id: enemy.id,
        label: enemy.name,
        action: { type: "target", playerId: me.id, targetId: enemy.id },
      })),
    )
  }

  if (state.step === "los") {
    screen.title = target?.name ?? "Target"
    screen.say = `${owner.name}, can you see the ${target?.name ?? "target"}? A building, a hill, or 6 inches of trees blocks sight.`
    return yesNo(screen, mine, owner.name, me.id, "los")
  }
  if (state.step === "arc") {
    screen.title = target?.name ?? "Target"
    screen.say = `${owner.name}, is the ${target?.name ?? "target"} in front of the ${mech.name}?`
    return yesNo(screen, mine, owner.name, me.id, "arc")
  }
  if (state.step === "contact") {
    screen.title = target?.name ?? "Target"
    screen.say =
      combat?.kind === "weapon"
        ? `${owner.name}, are the ${mech.name} and the ${target?.name ?? "target"} bases touching?`
        : combat?.kind === "melee"
          ? `${owner.name}, is the ${target?.name ?? "target"} within 2 inches and in front?`
          : `${owner.name}, is the ${target?.name ?? "target"} within 1 inch and in front?`
    return yesNo(screen, mine, owner.name, me.id, "contact")
  }
  if (state.step === "partial") {
    screen.title = target?.name ?? "Target"
    screen.say = `${owner.name}, is at least two-thirds of the ${target?.name ?? "target"} hidden by a building, a hill, or water?`
    return yesNo(screen, mine, owner.name, me.id, "partial")
  }
  if (state.step === "woods") {
    screen.title = target?.name ?? "Target"
    screen.say = `${owner.name}, do trees cross the line between you, or is the ${target?.name ?? "target"} standing in trees?`
    return yesNo(screen, mine, owner.name, me.id, "woods")
  }

  if (state.step === "range") {
    screen.title = "How far?"
    screen.say = `${owner.name}, measure from base edge to base edge. What band is the ${target?.name ?? "target"} in?`
    const choices: Choice[] = [
      {
        id: "short",
        label: "Short",
        hint: rules.realRange
          ? "6 inches or less. Adds 0 to the number the dice need."
          : "6 inches or less. Use the short damage box. The dice still need your skill.",
        action: { type: "range", playerId: me.id, range: "short" },
      },
      {
        id: "medium",
        label: "Medium",
        hint: rules.realRange
          ? "Past 6, up to 24 inches. Adds 2 to the number the dice need."
          : "Past 6, up to 24 inches. Use the medium damage box. The dice still need your skill.",
        action: { type: "range", playerId: me.id, range: "medium" },
      },
    ]
    if (rules.realRange) {
      choices.push({
        id: "long",
        label: "Long",
        hint: "Past 24, up to 42 inches. Adds 4 to the number the dice need.",
        action: { type: "range", playerId: me.id, range: "long" },
      })
    }
    choices.push({
      id: "toofar",
      label: "Too far",
      hint: rules.realRange ? "Past 42 inches. This shot cannot hit." : "Past 24 inches. This shot cannot hit.",
      action: { type: "range", playerId: me.id, range: "tooFar" },
    })
    choices.push({
      id: "dash",
      label: "The card has a dash",
      hint: "This mech cannot shoot that band.",
      action: { type: "range", playerId: me.id, range: "dash" },
    })
    return ownerOnly(screen, mine, owner.name, choices)
  }

  if (state.step === "overheat") {
    screen.title = "Overheat?"
    screen.say = `${owner.name}, you may add up to ${mech.ov ?? 0} extra damage at this range. You will mark that much heat at the end of the turn. At 4 heat, the mech shuts down next turn. Tap 0 to add none.`
    if (!mine) {
      screen.wait = `${owner.name} is choosing overheat.`
      return screen
    }
    screen.active = true
    screen.pad = { kind: "overheat", min: 0, max: mech.ov ?? 0, label: "Extra damage" }
    return screen
  }

  if (state.step === "roll") {
    const total = combat?.targetNumber ?? 0
    const lines = combat?.lines ?? []
    screen.title = total <= 2 ? "Any roll hits" : `Need ${total}+`
    screen.say = rollSay(owner.name, total, lines)
    if (rules.specialsReminder) {
      screen.note = [state.notice, "If a special ability on a card changes this number, tap it before you roll. Then roll the two dice."]
        .filter(Boolean)
        .join(" ")
    }
    if (!mine) {
      screen.wait =
        total <= 2
          ? `Watch ${owner.name} roll two dice and add them. Any total hits. Skill and modifiers are already counted.`
          : `Watch ${owner.name} roll two dice and add them. The total needs to be ${total} or more. Skill and modifiers are already counted.`
      return screen
    }
    screen.active = true
    screen.pad = { kind: "dice", min: 2, max: 12, label: "Sum of the two dice" }
    if (rules.specialsReminder) {
      screen.choices = [
        { id: "tweak-up", label: "Card adds 1", action: { type: "tweak", playerId: me.id, delta: 1 } },
        { id: "tweak-down", label: "Card subtracts 1", action: { type: "tweak", playerId: me.id, delta: -1 } },
      ]
    }
    return screen
  }

  if (state.step === "miss") {
    screen.title = "Miss"
    const rolled = state.solo && owner.id === state.coachId && combat?.dice != null ? `The ${mech.name} rolled ${combat.dice}. ` : ""
    screen.say = `${rolled}${owner.name}, no hit. The ${mech.name} missed the ${target?.name ?? "target"}. Mark nothing.`
    return ownerOnly(screen, mine, owner.name, [
      { id: "miss-next", label: "Next", action: { type: "continue", playerId: me.id } },
    ])
  }

  if (state.step === "rear") {
    screen.title = "Front or back?"
    screen.say = `${owner.name}, lay a straight edge from center to center. Does it enter through the back of the ${target?.name ?? "target"} base? The back adds one bubble.`
    return yesNo(screen, mine, owner.name, me.id, "rear")
  }

  if (state.step === "star") {
    screen.title = "Minimum damage"
    screen.say = `${owner.name}, that box is 0 with a star. Roll one die. 4, 5, or 6 counts as 1 bubble. 1, 2, or 3 counts as 0. Tap the face you rolled.`
    if (!mine) {
      screen.wait = `${owner.name} is rolling one die.`
      return screen
    }
    screen.active = true
    screen.pad = { kind: "star", min: 1, max: 6, label: "One die" }
    return screen
  }

  if (state.step === "band") {
    const band = combat?.range ?? "short"
    screen.title = `${band[0].toUpperCase()}${band.slice(1)} damage`
    screen.say = `${owner.name}, what number is in the ${band} box on the ${mech.name} card? That is how many bubbles you will mark on the mech you hit. If weapon hits have lowered it, use the lowered number. A 0 with a star means roll one die: on 4 or more, type 1, otherwise type 0.`
    if (!mine) {
      screen.wait = `${owner.name} is reading the damage box.`
      return screen
    }
    screen.active = true
    screen.pad = { kind: "band", min: 0, max: 15, label: "Card damage" }
    return screen
  }

  if (state.step === "bubbles" && rules.retreat && target) {
    const targetOwner = ownerOf(state, target)
    const armor = combat?.armorMarked ?? 0
    const structure = combat?.structureMarked ?? 0
    const marked = [armor > 0 ? `${armor} armor` : "", structure > 0 ? `${structure} structure` : ""]
      .filter((part) => part.length > 0)
      .join(" and ")
    screen.title = marked.length > 0 ? `Mark ${marked}` : "No bubbles"
    screen.say = `${owner.name}, the ${combat?.range ?? "short"} box counts as ${combat?.cardDamage ?? 0}. The coach counted ${marked || "no bubbles"} on ${targetOwner.name}'s ${target.name} card. Mark those same bubbles on the card. ${target.name} has ${target.armorLeft ?? 0} armor and ${target.structureLeft ?? 0} structure left.`
    return ownerOnly(screen, mine, owner.name, [
      { id: "armor", label: "The card matches", action: { type: "marked", playerId: me.id, result: "armor" } },
    ])
  }

  if (state.step === "bubbles") {
    const amount = combat?.totalDamage ?? 0
    const targetOwner = target ? ownerOf(state, target) : undefined
    const whose = target && targetOwner ? `${targetOwner.name}'s ${target.name} card` : "the target's card"
    const band = combat?.range ?? "short"
    screen.title = `Mark ${amount}`
    const rolled = state.solo && owner.id === state.coachId && combat?.dice != null ? `The ${mech.name} rolled ${combat.dice}. ` : ""
    screen.say = `${rolled}${owner.name}, hit confirmed. The ${band} box counts as ${combat?.cardDamage ?? amount}. Mark ${amount} bubble${amount === 1 ? "" : "s"} on ${whose}. That is your opponent's card, not your own. Fill the armor bubbles first, then the red structure bubbles.`
    if (!rules.crits) {
      screen.say += " If the last structure bubble is filled, that mech is knocked out and comes off the table."
    }
    if ((combat?.overheat ?? 0) > 0 && combat?.range !== "long") {
      screen.say += ` That includes ${combat?.overheat} from overheat.`
    }
    if (combat?.rear) screen.say += " That includes 1 because it hit the back."
    const choices: Choice[] = [
      {
        id: "armor",
        label: "Still has armor",
        hint: "Bubbles are left on the mech you hit.",
        action: { type: "marked", playerId: me.id, result: "armor" },
      },
    ]
    if (rules.crits) {
      choices.push({
        id: "structure",
        label: "Structure marked, still up",
        action: { type: "marked", playerId: me.id, result: "structure" },
      })
    }
    choices.push({
      id: "out",
      label: "Knocked out",
      hint: "The last structure bubble is marked. Take that mini off the table.",
      action: { type: "marked", playerId: me.id, result: "out" },
    })
    if (!rules.crits) {
      choices[0].label = "Still standing"
    }
    return ownerOnly(screen, mine, owner.name, choices)
  }

  if (state.step === "self") {
    screen.title = `Mark ${combat?.selfDamage ?? 0} on yourself`
    screen.say = `${owner.name}, mark ${combat?.selfDamage ?? 0} bubbles on the ${mech.name} card too.`
    const choices: Choice[] = [
      { id: "self-armor", label: "Still standing", action: { type: "marked", playerId: me.id, result: "armor" } },
    ]
    if (rules.crits) {
      choices.push({
        id: "self-structure",
        label: "Structure marked, still up",
        action: { type: "marked", playerId: me.id, result: "structure" },
      })
    }
    choices.push({ id: "self-out", label: "Knocked out", action: { type: "marked", playerId: me.id, result: "out" } })
    return ownerOnly(screen, mine, owner.name, choices)
  }

  if (state.step === "crit") {
    const who = combat?.critFor === "self" ? mech.name : target?.name ?? "the target"
    screen.title = "Critical hit"
    screen.say = `${owner.name}, roll two dice. Look at the critical hit table on the tables card. What happened to the ${who}?`
    return ownerOnly(screen, mine, owner.name, [
      { id: "crit-none", label: "No critical hit", action: { type: "crit", playerId: me.id, effect: "none" } },
      { id: "crit-weapon", label: "Weapon hit", hint: "Every damage box goes down by 1.", action: { type: "crit", playerId: me.id, effect: "weapon" } },
      { id: "crit-fc", label: "Fire control hit", hint: "Later shots need 2 more. It stacks.", action: { type: "crit", playerId: me.id, effect: "fireControl" } },
      { id: "crit-mp", label: "MP hit", hint: "Move and TMM are cut, at least by 2 inches and 1 TMM.", action: { type: "crit", playerId: me.id, effect: "mp" } },
      { id: "crit-engine", label: "Engine hit", hint: "Shooting adds 1 heat. A second engine hit destroys it.", action: { type: "crit", playerId: me.id, effect: "engine" } },
      { id: "crit-ammo", label: "Ammo hit", action: { type: "crit", playerId: me.id, effect: "ammo" } },
      { id: "crit-dead", label: "Mech destroyed", action: { type: "crit", playerId: me.id, effect: "destroyed" } },
    ])
  }

  if (state.step === "ammo") {
    screen.title = "Ammo hit"
    screen.say = `${owner.name}, look at the specials on that card. CASE II or ENE means nothing extra. CASE means one more bubble, then roll again if structure was marked. Anything else destroys the mech.`
    return ownerOnly(screen, mine, owner.name, [
      { id: "ammo-safe", label: "CASE II or ENE", action: { type: "ammo", playerId: me.id, result: "safe" } },
      { id: "ammo-case", label: "CASE", action: { type: "ammo", playerId: me.id, result: "case" } },
      { id: "ammo-dead", label: "No CASE and no ENE", action: { type: "ammo", playerId: me.id, result: "destroyed" } },
    ])
  }

  if (state.step === "ammoMark") {
    screen.title = "Mark 1 more"
    screen.say = `${owner.name}, CASE marks one more bubble. If that was the last structure bubble, it is knocked out. If structure was marked and it is still up, roll the table again.`
    return ownerOnly(screen, mine, owner.name, [
      { id: "ammo-armor", label: "Still has armor", action: { type: "marked", playerId: me.id, result: "armor" } },
      { id: "ammo-structure", label: "Structure marked, roll again", action: { type: "marked", playerId: me.id, result: "structure" } },
      { id: "ammo-out", label: "Knocked out", action: { type: "marked", playerId: me.id, result: "out" } },
    ])
  }

  screen.say = "Resolving the shot."
  return screen
}

function presentEnd(state: GameState, screen: Screen, me: Player): Screen {
  const rules = rulesOf(state)
  if (state.step === "beacon") {
    const scenario = scenarioOf(state)
    const current = scenario.objectives?.[state.objectiveIndex]
    screen.kicker = current?.kind === "exit" ? "Breakthrough" : "Beacon"
    screen.title = current ? current.label : "Who holds it?"
    screen.say = !current
      ? `${me.name}, is one of your mechs touching the beacon, with no enemy mech touching it?`
      : current.kind === "exit"
        ? `${me.name}, did one of your mechs leave the table across the other home edge this turn?`
        : `${me.name}, is one of your mechs touching ${current.label}, with no enemy mech touching it?`
    if (state.beaconAnswers[me.id] != null) {
      const other = otherPlayer(state, me.id)
      screen.wait = other ? `Stand by. ${other.name} has not answered yet.` : "Stand by."
      return screen
    }
    screen.active = true
    screen.choices = [
      { id: "beacon-yes", label: "Yes, we score", action: { type: "beacon", playerId: me.id, alone: true } },
      { id: "beacon-no", label: "No", action: { type: "beacon", playerId: me.id, alone: false } },
    ]
    return screen
  }
  screen.kicker = "End phase"
  screen.title = "Mark the cards"
  screen.say = heatSay(state)
  if (rules.retreat) {
    screen.say = "The first turn is over. One more turn, then both pilots pull back. Nobody will lose."
  } else if (!rules.heatScale && !rules.teachingHeat) {
    screen.say = "The turn is over. Mechs still on the table stay where they are."
  }
  return bothConfirm(state, screen, me, "heat-ok", "Cards are marked")
}

function heatSay(state: GameState): string {
  const rules = rulesOf(state)
  const lines = state.mechs
    .filter((mech) => !mech.knockedOut)
    .map((mech) => {
      if (rules.teachingHeat) {
        return mech.hot ? `${mech.name} shot, so it is Hot. Its next shot needs one more.` : `${mech.name} did not shoot, so it cools off.`
      }
      if (mech.woke) return `${mech.name} was shut down. Erase its heat. It wakes up and can move next turn.`
      if (mech.shutdown) return `${mech.name} is at heat 4. It shuts down and skips its next turn.`
      if (mech.heat === 0) return `${mech.name} has no heat. Erase any heat boxes.`
      return `${mech.name} heat is ${mech.heat}. Mark that many boxes. Walk inches drop by ${mech.heat * 2}.`
    })
  return lines.join(" ")
}

function placedSay(state: GameState, mech: Mech, owner: Player): string {
  if (state.solo && owner.id === state.coachId && mech.order) {
    const fromEdge = Math.round(mech.order.y)
    if (mech.moveMode === "stand") return `Leave the ${mech.name} on its ring. It is standing still.`
    return `Put the ${mech.name} on the ring. That is ${fromEdge} inches from your edge.`
  }
  const mode = mech.moveMode ?? "walk"
  const inches = adjustedMove(mech, mode === "charge" ? "walk" : mode === "dfa" ? "jump" : mode)
  const heatNote =
    mech.heat > 0 && mode !== "jump" && mode !== "dfa" && mode !== "stand"
      ? ` Heat took ${mech.heat * 2} inches off the walk.`
      : ""
  if (mode === "stand") return `${owner.name}, leave the ${mech.name} where it is. Less than 1 inch counts as standing still.`
  if (mode === "jump") {
    return `${owner.name}, jump the ${mech.name} up to ${inches} inches. Jumping ignores trees and buildings. It cannot jump out of water. You can turn it when it lands.`
  }
  if (mode === "sprint") {
    return `${owner.name}, sprint the ${mech.name} up to ${inches} inches. It cannot shoot this turn.${heatNote}`
  }
  if (mode === "charge") {
    return `${owner.name}, charge the ${mech.name} up to ${inches} inches and end touching the target.${heatNote}`
  }
  if (mode === "dfa") {
    return `${owner.name}, jump the ${mech.name} up to ${inches} inches and end touching the target.`
  }
  return `${owner.name}, move the ${mech.name} up to ${inches} inches. You can turn it at the end.${heatNote}`
}

function yesNo(
  screen: Screen,
  mine: boolean,
  ownerName: string,
  playerId: string,
  field: "los" | "arc" | "contact" | "partial" | "woods" | "rear",
): Screen {
  return ownerOnly(screen, mine, ownerName, [
    { id: `${field}-yes`, label: "Yes", action: { type: "yesNo", playerId, field, yes: true } },
    { id: `${field}-no`, label: "No", action: { type: "yesNo", playerId, field, yes: false } },
  ])
}

function ownerOnly(screen: Screen, mine: boolean, ownerName: string, choices: Choice[]): Screen {
  if (!mine) {
    screen.wait = `Stand by. ${ownerName} has the controls. Watch the table.`
    screen.active = false
    screen.choices = []
    return screen
  }
  screen.active = true
  screen.choices = choices
  return screen
}

function bothConfirm(state: GameState, screen: Screen, me: Player, id: string, label: string): Screen {
  if (state.confirmations.includes(me.id)) {
    const other = otherPlayer(state, me.id)
    screen.wait = other ? `Stand by. ${other.name} has not confirmed yet.` : "Stand by."
    screen.active = false
    return screen
  }
  screen.active = true
  screen.choices = [{ id, label, action: { type: "confirm", playerId: me.id } }]
  return screen
}

function happened(state: GameState): string {
  const scenario = scenarioOf(state)
  const length =
    state.turn > 0
      ? `${scenario.title} lasted ${state.turn} turn${state.turn === 1 ? "" : "s"}.`
      : `${scenario.title} ended during setup.`
  const mechs = state.mechs
    .map((mech) => {
      const owner = state.players.find((player) => player.id === mech.ownerId)?.name ?? "A pilot"
      if (mech.knockedOut) return `${owner}'s ${mech.name} was knocked out.`
      if (mech.armorLeft != null) {
        return `${owner}'s ${mech.name} still has ${mech.armorLeft} armor and ${mech.structureLeft ?? 0} structure.`
      }
      return `${owner}'s ${mech.name} stayed on the table.`
    })
    .join(" ")
  return `${length} ${state.winReason ?? "The battle is over."} ${mechs}`
}

function shotChoiceSay(ownerName: string, mechName: string, rules: Rules): string {
  const dice = "If you shoot, roll two dice and add them. Tap that total. Do not add your skill yourself."
  const firstGame =
    rules.teachingRange && !rules.realRange && !rules.teachingCover && !rules.teachingJump && !rules.teachingHeat
  const range = firstGame
    ? " Within 6 inches, use the short damage box on your card. Past 6 and up to 24, use the medium box. Past 24, hold fire. The number the dice need is your skill either way."
    : ""
  return `${ownerName}, the ${mechName} is weapons free. Shoot, or hold fire? ${dice}${range}`
}

function rollSay(ownerName: string, total: number, lines: { label: string; amount: number }[]): string {
  const extras = lines.some((line) => line.label !== "Skill")
  const meaning = extras
    ? "A plus makes the shot harder. A minus makes it easier."
    : "The skill spot on the card is blank. A regular pilot is 4. Nothing else changes the skill on this shot."
  const need = total <= 2 ? "Any total hits." : `The two dice need ${total} or more.`
  return `${ownerName}, roll two dice and add them. Tap that total. Do not add the skill or any modifiers to the dice. The coach already counted them. ${breakdown(lines)} ${meaning} ${need}`
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ""
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

function breakdown(lines: { label: string; amount: number }[]): string {
  if (lines.length === 0) return ""
  return lines
    .map((line) => `${line.label} ${line.amount >= 0 ? "+" : ""}${line.amount}`)
    .join(". ") + "."
}

function blank(state: GameState, playerId: string): Screen {
  const scenario = scenarioOf(state)
  return {
    code: state.code,
    version: state.version,
    kicker: scenario.title,
    title: scenario.title,
    say: "",
    note: state.notice,
    active: false,
    choices: [],
    hud: {
      scenario: scenario.title,
      turn: state.turn > 0 ? `Turn ${state.turn}` : "Setup",
      goal: "",
      rows: state.mechs.map((mech) => ({
        id: mech.id,
        name: mech.name,
        detail: hudDetail(mech),
        mine: mech.ownerId === playerId,
        out: mech.knockedOut,
      })),
    },
    undo:
      state.past && state.lastActorId === playerId
        ? { type: "undo", playerId }
        : undefined,
  }
}

function hudDetail(mech: Mech): string {
  if (mech.knockedOut) return "Knocked out"
  const bits: string[] = []
  if (mech.armorLeft != null) bits.push(`Armor ${mech.armorLeft}`)
  if (mech.structureLeft != null) bits.push(`Structure ${mech.structureLeft}`)
  if (mech.shutdown) bits.push("Shut down")
  if (mech.woke) bits.push("Wakes up")
  if (mech.hot) bits.push("Hot")
  if (mech.heat > 0) bits.push(`Heat ${mech.heat}`)
  if (mech.fireControlHits > 0) bits.push(`Fire control ${mech.fireControlHits}`)
  if (mech.moveMode) bits.push(mech.moveMode)
  if (mech.walkInches != null) {
    const mode = mech.moveMode === "jump" || mech.moveMode === "dfa" ? "jump" : "walk"
    bits.push(`${adjustedMove(mech, mode)} in`)
  }
  return bits.join(" · ") || "On the table"
}

function active(state: GameState): Mech | undefined {
  return state.mechs.find((mech) => mech.id === state.activeMechId)
}

function ownerOf(state: GameState, mech: Mech): Player {
  return state.players.find((player) => player.id === mech.ownerId) ?? state.players[0]
}

function playerById(state: GameState, playerId: string): Player | undefined {
  return state.players.find((player) => player.id === playerId)
}

function handsOn(state: GameState, me: Player, ownerId: string): boolean {
  if (me.id === ownerId) return true
  return Boolean(state.solo && state.coachId === ownerId && me.id !== state.coachId)
}

function otherPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((player) => player.id !== playerId)
}

function seatNames(state: GameState): { innerSphere: string; clan: string } {
  return {
    innerSphere: state.players.find((player) => player.faction === "innerSphere")?.name ?? "the Lyrans",
    clan: state.players.find((player) => player.faction === "clan")?.name ?? "the Falcons",
  }
}

function goalLine(state: GameState): string {
  const scenario = scenarioOf(state)
  if (scenario.rules.retreat) return "Two turns, then both pull back. Nobody loses."
  if (scenario.rules.beacon) {
    const scores = state.players.map((player) => `${player.name} ${player.beaconPoints}`).join(" · ")
    const exit = scenario.objectives?.some((item) => item.kind === "exit")
    if (exit) return `Leave across the far edge, or knock the other side out. ${scores}`.trim()
    const what = scenario.objectives && scenario.objectives.length > 1 ? "the beacons" : "the beacon"
    return `First to ${scenario.beaconGoal} on ${what}. ${scores}`.trim()
  }
  return "Knock out every enemy mech."
}
