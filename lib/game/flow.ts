import { boxAt, defaultFace, mustFace } from "./cards"
import {
  attackPreview,
  availableModes,
  boxedDamage,
  chargeSelfDamage,
  chargeTargetDamage,
  starDamage,
  weaponBubbles,
} from "./math"
import { mustScenario, rosterFor, type Scenario } from "./scenarios"
import type {
  Action,
  AttackKind,
  CardField,
  CombatState,
  GameState,
  Mech,
  Player,
  Rules,
} from "./types"
import { RuleError } from "./types"

export function createGame(input: {
  code: string
  scenarioId: string
  hostId: string
  hostName: string
  faction: Player["faction"]
}): GameState {
  mustScenario(input.scenarioId)
  const host: Player = {
    id: input.hostId,
    name: cleanName(input.hostName),
    faction: input.faction,
    ready: false,
    beaconPoints: 0,
  }
  const scenario = mustScenario(input.scenarioId)
  return {
    version: 1,
    code: input.code,
    scenarioId: scenario.id,
    players: [host],
    mechs: scenario.forces[host.faction].map((variantId, index) => freshMech(scenario, `h${index}`, variantId, host.id)),
    phase: "lobby",
    step: "wait",
    confirmations: [],
    placeIndex: 0,
    initiative: {},
    turn: 0,
    moveOrder: [],
    combatIndex: 0,
    beaconAnswers: {},
  }
}

export function claimSeat(
  state: GameState,
  input: { playerId: string; name: string },
): { state: GameState; playerId: string } {
  const cleaned = cleanName(input.name)
  const named = state.players.filter((player) => player.name.toLowerCase() === cleaned.toLowerCase())
  if (named.length > 1) {
    throw new RuleError("Both seats use that name. Stay on the screen that already has the buttons.")
  }
  if (named.length === 1) return { state, playerId: named[0].id }
  if (state.players.some((player) => player.id === input.playerId)) return { state, playerId: input.playerId }
  const next = applyAction(state, { type: "join", playerId: input.playerId, name: cleaned })
  return { state: next, playerId: input.playerId }
}

export function applyAction(state: GameState, action: Action): GameState {
  if (action.type === "join" && state.players.some((player) => player.id === action.playerId)) {
    return state
  }
  if (action.type === "undo") {
    if (!state.past) throw new RuleError("Nothing to undo.")
    if (state.lastActorId !== action.playerId) {
      throw new RuleError("Only the player who just tapped can undo.")
    }
    const restored = state.past
    restored.version = state.version + 1
    restored.past = undefined
    restored.lastActorId = undefined
    return restored
  }
  const snapshot = structuredClone(state)
  snapshot.past = undefined
  const next = structuredClone(state)
  next.past = undefined
  next.notice = undefined
  mutate(next, action)
  next.past = snapshot
  next.lastActorId = "playerId" in action ? action.playerId : undefined
  next.version = state.version + 1
  return next
}

export function rulesOf(state: GameState): Rules {
  return mustScenario(state.scenarioId).rules
}

export function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ")
  if (trimmed.length < 1 || trimmed.length > 16) {
    throw new RuleError("Use a name up to 16 letters.")
  }
  return trimmed
}

export function setupSteps(state: GameState): { who: "host" | "guest"; say: string }[] {
  const scenario = mustScenario(state.scenarioId)
  const steps = scenario.terrain.map((step) => ({
    who: step.who,
    say: step.say.replace("{name}", playerBySeat(state, step.who)?.name ?? "Player"),
  }))
  const host = state.players[0]
  const guest = state.players[1]
  if (host) steps.push({ who: "host", say: facingSay(state, host) })
  if (guest) steps.push({ who: "guest", say: facingSay(state, guest) })
  return steps
}

export function pieceList(state: GameState): string[] {
  const scenario = mustScenario(state.scenarioId)
  const minis = state.mechs.map((mech) => `the ${mech.name} mini and its card`)
  return [...minis, ...scenario.extraPieces]
}

export function nextCardField(mech: Mech, _rules: Rules): CardField | null {
  if (mech.walkInches == null) return "walk"
  if (mech.armor == null) return "armor"
  if (mech.structure == null) return "structure"
  return null
}

export function currentCard(state: GameState): { mech: Mech; field: CardField } | null {
  const rules = rulesOf(state)
  for (const mech of state.mechs) {
    const field = nextCardField(mech, rules)
    if (field) return { mech, field }
  }
  return null
}

export function nextActivator(state: GameState): { playerId: string; mechIds: string[] } | null {
  if (!state.lowPlayerId || !state.highPlayerId) return null
  const prefer = state.moveOrder.length % 2 === 0 ? state.lowPlayerId : state.highPlayerId
  const first = remainingMechs(state, prefer)
  if (first.length > 0) return { playerId: prefer, mechIds: first.map((mech) => mech.id) }
  const other = prefer === state.lowPlayerId ? state.highPlayerId : state.lowPlayerId
  const second = remainingMechs(state, other)
  if (second.length > 0) return { playerId: other, mechIds: second.map((mech) => mech.id) }
  return null
}

function mutate(state: GameState, action: Action) {
  switch (action.type) {
    case "join":
      return onJoin(state, action)
    case "swap":
      return onSwap(state, action)
    case "ready":
      return onReady(state, action)
    case "confirm":
      return onConfirm(state, action)
    case "continue":
      return onContinue(state, action)
    case "card":
      return onCard(state, action)
    case "initiative":
      return onInitiative(state, action)
    case "pickMech":
      return onPickMech(state, action)
    case "moveMode":
      return onMoveMode(state, action)
    case "jumpInches":
      return onJumpInches(state, action)
    case "chargeTarget":
      return onChargeTarget(state, action)
    case "reach":
      return onReach(state, action)
    case "terrain":
      return onTerrain(state, action)
    case "water":
      return onWater(state, action)
    case "cover":
      return onCover(state, action)
    case "kind":
      return onKind(state, action)
    case "target":
      return onTarget(state, action)
    case "yesNo":
      return onYesNo(state, action)
    case "range":
      return onRange(state, action)
    case "overheat":
      return onOverheat(state, action)
    case "tweak":
      return onTweak(state, action)
    case "dice":
      return onDice(state, action)
    case "band":
      return onBand(state, action)
    case "star":
      return onStar(state, action)
    case "marked":
      return onMarked(state, action)
    case "crit":
      return onCrit(state, action)
    case "ammo":
      return onAmmo(state, action)
    case "beacon":
      return onBeacon(state, action)
    default:
      throw new RuleError("That action is not part of this coach.")
  }
}

function onJoin(state: GameState, action: Extract<Action, { type: "join" }>) {
  if (state.phase !== "lobby") throw new RuleError("This game has already started.")
  if (state.players.length >= 2) throw new RuleError("This game already has two players.")
  const host = state.players[0]
  const faction = host.faction === "innerSphere" ? "clan" : "innerSphere"
  const guest: Player = {
    id: action.playerId,
    name: cleanName(action.name),
    faction,
    ready: false,
    beaconPoints: 0,
  }
  state.players.push(guest)
  const scenario = mustScenario(state.scenarioId)
  scenario.forces[faction].forEach((variantId, index) => {
    state.mechs.push(freshMech(scenario, `g${index}`, variantId, guest.id))
  })
  state.phase = "briefing"
  state.step = "confirm"
  state.confirmations = []
}

function onSwap(state: GameState, action: Extract<Action, { type: "swap" }>) {
  if (state.phase !== "roster") throw new RuleError("The minis are already on the table.")
  requirePlayer(state, action.playerId)
  const mech = requireMech(state, action.mechId)
  const owner = requirePlayer(state, mech.ownerId)
  if (!rosterFor(owner.faction).includes(action.name)) {
    throw new RuleError("That mini is not on this side.")
  }
  if (state.mechs.some((other) => other.name === action.name && other.id !== mech.id)) {
    throw new RuleError("That mini is already out.")
  }
  const fresh = freshMech(mustScenario(state.scenarioId), mech.id, variantForName(state, action.name), mech.ownerId)
  const index = state.mechs.findIndex((other) => other.id === mech.id)
  state.mechs[index] = fresh
  for (const player of state.players) player.ready = false
}

function onReady(state: GameState, action: Extract<Action, { type: "ready" }>) {
  if (state.phase !== "roster") throw new RuleError("You are past choosing minis.")
  const player = requirePlayer(state, action.playerId)
  player.ready = true
  if (state.players.length === 2 && state.players.every((seat) => seat.ready)) {
    state.phase = "gather"
    state.step = "confirm"
    state.confirmations = []
  }
}

function onConfirm(state: GameState, action: Extract<Action, { type: "confirm" }>) {
  requirePlayer(state, action.playerId)
  if (state.players.length < 2) throw new RuleError("Wait for the other player.")
  if (state.phase === "briefing") {
    if (!state.confirmations.includes(action.playerId)) state.confirmations.push(action.playerId)
    if (state.confirmations.length < 2) return
    state.confirmations = []
    state.phase = "roster"
    state.step = "ready"
    return
  }
  if (state.phase === "place") {
    const step = setupSteps(state)[state.placeIndex]
    const actor = step ? playerBySeat(state, step.who) : undefined
    if (!actor || actor.id !== action.playerId) {
      throw new RuleError("The other player is putting this on the table.")
    }
    state.placeIndex += 1
    if (state.placeIndex >= setupSteps(state).length) {
      state.phase = "cards"
      state.step = "ask"
    }
    return
  }
  if (state.phase === "cards") {
    if (currentCard(state)) throw new RuleError("Read the number on the card first.")
    if (!state.confirmations.includes(action.playerId)) state.confirmations.push(action.playerId)
    if (state.confirmations.length < 2) return
    state.confirmations = []
    startInitiative(state)
    return
  }
  if (state.phase === "gather" || (state.phase === "end" && state.step === "heat")) {
    if (!state.confirmations.includes(action.playerId)) state.confirmations.push(action.playerId)
    if (state.confirmations.length < 2) return
    state.confirmations = []
    if (state.phase === "gather") {
      state.phase = "place"
      state.placeIndex = 0
      state.step = "confirm"
      return
    }
    if (rulesOf(state).beacon) {
      state.step = "beacon"
      state.beaconAnswers = {}
      return
    }
    startInitiative(state)
    return
  }
  throw new RuleError("Nothing to confirm right now.")
}

function onContinue(state: GameState, action: Extract<Action, { type: "continue" }>) {
  if (state.phase === "move" && state.step === "placed") {
    requireOwner(state, action.playerId)
    nextMoveQuestion(state, "placed")
    return
  }
  if (state.phase === "move" && state.step === "pass") {
    requireOwner(state, action.playerId)
    const mech = activeMech(state)
    mech.moveMode = "stand"
    commitMove(state)
    return
  }
  if (state.phase === "combat" && state.step === "pass") {
    requireOwner(state, action.playerId)
    advanceCombat(state)
    return
  }
  if (state.phase === "combat" && state.step === "miss") {
    requireOwner(state, action.playerId)
    advanceCombat(state)
    return
  }
  throw new RuleError("Nothing to continue.")
}

function onCard(state: GameState, action: Extract<Action, { type: "card" }>) {
  if (state.phase !== "cards") throw new RuleError("The cards are already read.")
  const current = currentCard(state)
  if (!current) throw new RuleError("Every card is in.")
  if (current.mech.ownerId !== action.playerId) {
    throw new RuleError("The other player reads this card.")
  }
  if (current.field !== action.field) throw new RuleError("That is not the number we need.")
  if (typeof action.value !== "number") throw new RuleError("Type the number on the card.")
  const card = mustFace(current.mech.variant)
  const expected = cardCount(card, current.field)
  if (action.value !== expected) {
    current.mech.quizMisses = (current.mech.quizMisses ?? 0) + 1
    state.notice = missSay(current.mech, card, current.field, expected)
    return
  }
  current.mech.quizMisses = 0
  state.notice = undefined
  writeCard(current.mech, action.field, action.value)
  if (!currentCard(state)) startInitiative(state)
}

function onInitiative(state: GameState, action: Extract<Action, { type: "initiative" }>) {
  if (state.phase !== "initiative") throw new RuleError("It is not time to roll initiative.")
  requirePlayer(state, action.playerId)
  if (state.initiative[action.playerId] != null) throw new RuleError("You already rolled.")
  assertRange(action.roll, 2, 12, "Type the total of two dice.")
  state.initiative[action.playerId] = action.roll
  if (state.players.some((player) => state.initiative[player.id] == null)) return
  const [first, second] = state.players
  if (state.initiative[first.id] === state.initiative[second.id]) {
    state.initiative = {}
    state.notice = "Tie. Roll again."
    return
  }
  const low = state.initiative[first.id] < state.initiative[second.id] ? first : second
  const high = low.id === first.id ? second : first
  state.lowPlayerId = low.id
  state.highPlayerId = high.id
  beginMove(state)
}

function onPickMech(state: GameState, action: Extract<Action, { type: "pickMech" }>) {
  if (state.phase !== "move" || state.step !== "pick") throw new RuleError("You are not picking a mech.")
  const next = nextActivator(state)
  if (!next || next.playerId !== action.playerId) throw new RuleError("Watch the table. It is the other player's turn.")
  if (!next.mechIds.includes(action.mechId)) throw new RuleError("That mech already moved.")
  selectMech(state, action.mechId)
}

function onMoveMode(state: GameState, action: Extract<Action, { type: "moveMode" }>) {
  if (state.phase !== "move" || state.step !== "mode") throw new RuleError("You are not choosing a move.")
  const mech = requireOwner(state, action.playerId)
  const modes = modesFor(state, mech)
  if (!modes.includes(action.mode)) throw new RuleError("That move is not open.")
  mech.moveMode = action.mode
  mech.declaration = undefined
  if (action.mode === "jump" && mech.jumpInches == null) {
    state.step = "jump"
    return
  }
  if (action.mode === "charge" || action.mode === "dfa") {
    state.step = "charge"
    return
  }
  state.step = "placed"
}

function onJumpInches(state: GameState, action: Extract<Action, { type: "jumpInches" }>) {
  if (state.phase !== "move" || state.step !== "jump") throw new RuleError("We do not need jump inches.")
  const mech = requireOwner(state, action.playerId)
  assertRange(action.inches, 1, 30, "Type the jump inches from the card.")
  mech.jumpInches = action.inches
  state.step = "placed"
}

function onChargeTarget(state: GameState, action: Extract<Action, { type: "chargeTarget" }>) {
  if (state.phase !== "move" || state.step !== "charge") throw new RuleError("You are not charging.")
  const mech = requireOwner(state, action.playerId)
  const target = requireMech(state, action.targetId)
  if (target.ownerId === mech.ownerId || target.knockedOut) throw new RuleError("Pick an enemy mech.")
  if (!state.moveOrder.includes(target.id)) {
    throw new RuleError("That mech has not moved yet. A charge can only hit a mech that already moved.")
  }
  if (mech.moveMode !== "charge" && mech.moveMode !== "dfa") throw new RuleError("Pick charge or death from above first.")
  mech.declaration = { kind: mech.moveMode, targetId: target.id }
  state.step = "reach"
}

function onReach(state: GameState, action: Extract<Action, { type: "reach" }>) {
  if (state.phase !== "move" || state.step !== "reach") throw new RuleError("You are not checking the charge.")
  const mech = requireOwner(state, action.playerId)
  if (!action.yes) {
    mech.declaration = undefined
    mech.moveMode = undefined
    state.step = "mode"
    state.notice = "Then it is not a charge. Pick a different move."
    return
  }
  state.step = "placed"
}

function onTerrain(state: GameState, action: Extract<Action, { type: "terrain" }>) {
  if (state.phase !== "move" || state.step !== "terrain") throw new RuleError("You are not checking the path.")
  requireOwner(state, action.playerId)
  if (!action.ok) {
    state.notice = "Move it again. Trees cost 2 inches per inch, and a climb costs extra."
    return
  }
  nextMoveQuestion(state, "terrain")
}

function onWater(state: GameState, action: Extract<Action, { type: "water" }>) {
  if (state.phase !== "move" || state.step !== "water") throw new RuleError("You are not checking water.")
  const mech = requireOwner(state, action.playerId)
  mech.inWater = action.inWater
  nextMoveQuestion(state, "water")
}

function onCover(state: GameState, action: Extract<Action, { type: "cover" }>) {
  if (state.phase !== "move" || state.step !== "cover") throw new RuleError("You are not checking cover.")
  const mech = requireOwner(state, action.playerId)
  mech.touchingCover = action.touching
  nextMoveQuestion(state, "cover")
}

function onKind(state: GameState, action: Extract<Action, { type: "kind" }>) {
  if (state.phase !== "combat" || state.step !== "kind") throw new RuleError("You are not choosing an attack.")
  const mech = requireOwner(state, action.playerId)
  const rules = rulesOf(state)
  if (action.kind === "hold") {
    mech.shotThisTurn = false
    advanceCombat(state)
    return
  }
  if ((action.kind === "physical" || action.kind === "melee") && !rules.physical) {
    throw new RuleError("This game does not use punches yet.")
  }
  const combat = ensureCombat(state, mech.id)
  combat.kind = action.kind
  combat.targetId = undefined
  state.step = "target"
}

function onTarget(state: GameState, action: Extract<Action, { type: "target" }>) {
  if (state.phase !== "combat" || state.step !== "target") throw new RuleError("You are not picking a target.")
  const mech = requireOwner(state, action.playerId)
  const target = requireMech(state, action.targetId)
  if (target.ownerId === mech.ownerId || target.knockedOut) throw new RuleError("Pick an enemy that is still standing.")
  const combat = state.combat
  if (!combat) throw new RuleError("The attack was lost. Undo and try again.")
  combat.targetId = target.id
  combat.partial = false
  combat.woods = false
  const rules = rulesOf(state)
  if (combat.kind === "weapon" && rules.los) {
    state.step = "los"
    return
  }
  afterLos(state)
}

function onYesNo(state: GameState, action: Extract<Action, { type: "yesNo" }>) {
  if (state.phase !== "combat") throw new RuleError("That question is not up.")
  requireOwner(state, action.playerId)
  const combat = state.combat
  if (!combat) throw new RuleError("The attack was lost. Undo and try again.")
  if (action.field === "los" && state.step === "los") {
    if (!action.yes) {
      state.notice = "You cannot shoot what you cannot see."
      state.step = "kind"
      return
    }
    afterLos(state)
    return
  }
  if (action.field === "arc" && state.step === "arc") {
    if (!action.yes) {
      state.notice = "It has to be in front of your mech."
      state.step = "kind"
      return
    }
    afterArc(state)
    return
  }
  if (action.field === "contact" && state.step === "contact") {
    if (combat.kind === "weapon") {
      if (action.yes) {
        state.notice = "Bases are touching. You cannot shoot. Punch, or pick someone else."
        state.step = "kind"
        return
      }
      askShotExtras(state)
      return
    }
    if (!action.yes) {
      state.notice =
        combat.kind === "melee"
          ? "Melee reaches 2 inches, and the target has to be in front."
          : "A punch reaches 1 inch, and the target has to be in front."
      state.step = "kind"
      return
    }
    askShotExtras(state)
    return
  }
  if (action.field === "partial" && state.step === "partial") {
    combat.partial = action.yes
    combat.askedPartial = true
    askShotExtras(state)
    return
  }
  if (action.field === "woods" && state.step === "woods") {
    combat.woods = action.yes
    combat.askedWoods = true
    askShotExtras(state)
    return
  }
  if (action.field === "rear" && state.step === "rear") {
    combat.rear = action.yes
    if (combat.kind === "weapon") {
      applyPrintedDamage(state)
      return
    }
    if (action.yes && combat.totalDamage != null) combat.totalDamage += 1
    state.step = "bubbles"
    return
  }
  throw new RuleError("That is not the question on the table.")
}

function onRange(state: GameState, action: Extract<Action, { type: "range" }>) {
  if (state.phase !== "combat" || state.step !== "range") throw new RuleError("You are not measuring range.")
  const mech = requireOwner(state, action.playerId)
  const rules = rulesOf(state)
  const combat = state.combat
  if (!combat) throw new RuleError("The attack was lost. Undo and try again.")
  if (action.range === "tooFar" || action.range === "dash") {
    state.notice =
      action.range === "dash"
        ? "A dash in that box means this mech cannot shoot that far."
        : rules.realRange
          ? "Too far. Long range stops at 42 inches."
          : "Too far. This game shoots out to 24 inches."
    state.step = "kind"
    return
  }
  if (!rules.realRange && action.range === "long") {
    state.notice = "Too far. This game shoots out to 24 inches."
    state.step = "kind"
    return
  }
  combat.range = action.range
  if (rules.heatScale && (mech.ov ?? 0) > 0 && action.range !== "long") {
    state.step = "overheat"
    return
  }
  startRoll(state)
}

function onOverheat(state: GameState, action: Extract<Action, { type: "overheat" }>) {
  if (state.phase !== "combat" || state.step !== "overheat") throw new RuleError("You are not choosing overheat.")
  const mech = requireOwner(state, action.playerId)
  const max = mech.ov ?? 0
  assertRange(action.amount, 0, max, "That is more overheat than the card has.")
  const combat = state.combat
  if (!combat) throw new RuleError("The attack was lost. Undo and try again.")
  combat.overheat = action.amount
  mech.overheatUsed = action.amount
  startRoll(state)
}

function onTweak(state: GameState, action: Extract<Action, { type: "tweak" }>) {
  if (state.phase !== "combat" || state.step !== "roll") throw new RuleError("You can only adjust the number before the roll.")
  if (!rulesOf(state).specialsReminder) throw new RuleError("This game does not adjust for specials.")
  requireOwner(state, action.playerId)
  const combat = state.combat
  if (!combat) throw new RuleError("The attack was lost. Undo and try again.")
  combat.tweak = Math.max(-3, Math.min(3, combat.tweak + action.delta))
  fillPreview(state)
}

function onDice(state: GameState, action: Extract<Action, { type: "dice" }>) {
  if (state.phase !== "combat" || state.step !== "roll") throw new RuleError("It is not time to roll.")
  const mech = requireOwner(state, action.playerId)
  assertRange(action.roll, 2, 12, "Type the total of two dice.")
  const combat = state.combat
  if (!combat || combat.targetNumber == null || !combat.kind || !combat.targetId) {
    throw new RuleError("The attack was lost. Undo and try again.")
  }
  combat.dice = action.roll
  const weapon = combat.kind === "weapon"
  mech.shotThisTurn = weapon
  if (action.roll < combat.targetNumber) {
    if (combat.kind === "dfa") {
      combat.selfDamage = (mech.size ?? 1) + 1
      state.step = "self"
      state.notice = "The jump missed. Mark one more than your size on your own card."
      return
    }
    state.step = "miss"
    state.notice = "Miss. No bubbles."
    return
  }
  if (weapon) {
    if (rulesOf(state).rear) {
      state.step = "rear"
      return
    }
    applyPrintedDamage(state)
    return
  }
  resolvePhysicalHit(state)
}

function onStar(state: GameState, action: Extract<Action, { type: "star" }>) {
  if (state.phase !== "combat" || state.step !== "star") throw new RuleError("That box is not a star.")
  const mech = requireOwner(state, action.playerId)
  assertRange(action.roll, 1, 6, "Roll one die and tap that face.")
  const combat = state.combat
  if (!combat || !combat.range) throw new RuleError("The attack was lost. Undo and try again.")
  const card = mustFace(mech.variant)
  if (boxAt(card, combat.range) !== "star") throw new RuleError("That box is not a star.")
  finishWeaponDamage(state, starDamage(action.roll, mech.weaponHits))
}

function onBand(state: GameState, action: Extract<Action, { type: "band" }>) {
  if (state.phase !== "combat" || state.step !== "band") throw new RuleError("We do not need a damage number.")
  requireOwner(state, action.playerId)
  assertRange(action.amount, 0, 20, "Type the damage box from the card.")
  const combat = state.combat
  if (!combat || !combat.range) throw new RuleError("The attack was lost. Undo and try again.")
  combat.cardDamage = action.amount
  combat.totalDamage = weaponBubbles(action.amount, combat.overheat, combat.rear, combat.range)
  if (rulesOf(state).retreat) {
    applyLessonHit(state)
    return
  }
  state.step = "bubbles"
}

function onMarked(state: GameState, action: Extract<Action, { type: "marked" }>) {
  if (state.phase !== "combat") throw new RuleError("Nothing is being marked.")
  requireOwner(state, action.playerId)
  if (state.step === "self") {
    onSelfMarked(state, action.result)
    return
  }
  if (state.step === "ammoMark") {
    onAmmoMarked(state, action.result)
    return
  }
  if (state.step !== "bubbles") throw new RuleError("Nothing is being marked.")
  if (rulesOf(state).retreat) {
    afterTarget(state)
    return
  }
  const combat = state.combat
  if (!combat?.targetId) throw new RuleError("The attack was lost. Undo and try again.")
  const target = requireMech(state, combat.targetId)
  if (action.result === "out") {
    destroyMech(target)
    if (checkWin(state)) return
    afterTarget(state)
    return
  }
  const rules = rulesOf(state)
  const needsCrit =
    rules.crits &&
    !combat.critDone &&
    (action.result === "structure" || combat.dice === 12 || Boolean(combat.forceCrit))
  if (needsCrit) {
    combat.critFor = "target"
    state.step = "crit"
    return
  }
  afterTarget(state)
}

function onSelfMarked(state: GameState, result: "armor" | "structure" | "out") {
  const combat = state.combat
  if (!combat) throw new RuleError("The attack was lost. Undo and try again.")
  const attacker = requireMech(state, combat.attackerId)
  combat.selfDone = true
  if (result === "out") {
    destroyMech(attacker)
    if (checkWin(state)) return
    afterTarget(state)
    return
  }
  if (rulesOf(state).crits && result === "structure") {
    combat.critDone = false
    combat.critFor = "self"
    state.step = "crit"
    return
  }
  afterTarget(state)
}

function onCrit(state: GameState, action: Extract<Action, { type: "crit" }>) {
  if (state.phase !== "combat" || state.step !== "crit") throw new RuleError("It is not time for a crit.")
  requireOwner(state, action.playerId)
  const combat = state.combat
  if (!combat?.targetId) throw new RuleError("The attack was lost. Undo and try again.")
  const mech =
    combat.critFor === "self" ? requireMech(state, combat.attackerId) : requireMech(state, combat.targetId)
  combat.critDone = true
  if (action.effect === "none") {
    afterCrit(state)
    return
  }
  if (action.effect === "weapon") mech.weaponHits += 1
  if (action.effect === "fireControl") mech.fireControlHits += 1
  if (action.effect === "mp") mech.mpHits += 1
  if (action.effect === "engine") {
    mech.engineHits += 1
    if (mech.engineHits >= 2) destroyMech(mech)
  }
  if (action.effect === "destroyed") destroyMech(mech)
  if (action.effect === "ammo") {
    state.step = "ammo"
    return
  }
  if (checkWin(state)) return
  afterCrit(state)
}

function onAmmo(state: GameState, action: Extract<Action, { type: "ammo" }>) {
  if (state.phase !== "combat" || state.step !== "ammo") throw new RuleError("You are not resolving ammo.")
  requireOwner(state, action.playerId)
  const combat = state.combat
  if (!combat?.targetId) throw new RuleError("The attack was lost. Undo and try again.")
  const mech =
    combat.critFor === "self" ? requireMech(state, combat.attackerId) : requireMech(state, combat.targetId)
  if (action.result === "destroyed") {
    destroyMech(mech)
    if (checkWin(state)) return
    afterCrit(state)
    return
  }
  if (action.result === "safe") {
    afterCrit(state)
    return
  }
  state.step = "ammoMark"
}

function onBeacon(state: GameState, action: Extract<Action, { type: "beacon" }>) {
  if (state.phase !== "end" || state.step !== "beacon") throw new RuleError("The beacon is not scoring.")
  requirePlayer(state, action.playerId)
  state.beaconAnswers[action.playerId] = action.alone
  if (state.players.some((player) => state.beaconAnswers[player.id] == null)) return
  const [first, second] = state.players
  const firstYes = state.beaconAnswers[first.id]
  const secondYes = state.beaconAnswers[second.id]
  let headline = "Nobody scores the beacon."
  if (firstYes && secondYes) {
    headline = "You both claimed the beacon, so nobody is alone. No point."
  } else if (firstYes) {
    first.beaconPoints += 1
    headline = `${first.name} scores 1 beacon point.`
  } else if (secondYes) {
    second.beaconPoints += 1
    headline = `${second.name} scores 1 beacon point.`
  }
  if (checkWin(state)) return
  startInitiative(state)
  state.notice = headline
}

function beginMove(state: GameState) {
  state.phase = "move"
  state.moveOrder = []
  state.combat = undefined
  state.combatIndex = 0
  state.activeMechId = undefined
  for (const mech of state.mechs) {
    if (mech.knockedOut) continue
    mech.moveMode = undefined
    mech.touchingCover = false
    mech.inWater = false
    mech.shotThisTurn = false
    mech.overheatUsed = 0
    mech.woke = false
    mech.declaration = undefined
  }
  prepareMove(state)
}

function prepareMove(state: GameState) {
  const next = nextActivator(state)
  if (!next) {
    beginCombat(state)
    return
  }
  const choices = next.mechIds.map((id) => requireMech(state, id)).filter((mech) => !mech.shutdown)
  if (choices.length === 0) {
    state.activeMechId = next.mechIds[0]
    state.step = "pass"
    return
  }
  if (choices.length > 1) {
    state.activeMechId = undefined
    state.step = "pick"
    return
  }
  selectMech(state, choices[0].id)
}

function selectMech(state: GameState, mechId: string) {
  const mech = requireMech(state, mechId)
  state.activeMechId = mech.id
  if (mech.shutdown) {
    mech.moveMode = "stand"
    state.step = "pass"
    return
  }
  const modes = modesFor(state, mech)
  if (modes.length === 1 && modes[0] === "walk") {
    mech.moveMode = "walk"
    state.step = "placed"
    return
  }
  state.step = "mode"
}

function nextMoveQuestion(state: GameState, from: "placed" | "terrain" | "water" | "cover") {
  const rules = rulesOf(state)
  const mech = activeMech(state)
  const jumping = mech.moveMode === "jump" || mech.moveMode === "dfa"
  const moved = mech.moveMode !== "stand" && mech.moveMode != null
  if (from === "placed" && rules.terrainCost && moved && !jumping) {
    state.step = "terrain"
    return
  }
  if (from !== "water" && from !== "cover" && rules.heatScale) {
    state.step = "water"
    return
  }
  if (from !== "cover" && rules.teachingCover) {
    state.step = "cover"
    return
  }
  commitMove(state)
}

function commitMove(state: GameState) {
  const mech = activeMech(state)
  state.moveOrder.push(mech.id)
  state.activeMechId = undefined
  prepareMove(state)
}

function beginCombat(state: GameState) {
  state.phase = "combat"
  state.combatIndex = 0
  state.combat = undefined
  state.activeMechId = undefined
  if (checkWin(state)) return
  prepareCombat(state)
}

function prepareCombat(state: GameState) {
  while (state.combatIndex < state.moveOrder.length) {
    const mech = requireMech(state, state.moveOrder[state.combatIndex])
    if (mech.knockedOut) {
      state.combatIndex += 1
      continue
    }
    state.activeMechId = mech.id
    if (mech.shutdown || mech.moveMode === "sprint") {
      state.step = "pass"
      state.combat = undefined
      return
    }
    if (mech.declaration) {
      const target = requireMech(state, mech.declaration.targetId)
      if (target.knockedOut) {
        mech.declaration = undefined
        state.combat = freshCombat(mech.id)
        state.step = "kind"
        state.notice = "That target already fell. Choose another attack."
        return
      }
      state.combat = freshCombat(mech.id, mech.declaration.kind, mech.declaration.targetId)
      askShotExtras(state)
      return
    }
    state.combat = freshCombat(mech.id)
    state.step = "kind"
    return
  }
  beginEnd(state)
}

function advanceCombat(state: GameState) {
  state.combatIndex += 1
  state.combat = undefined
  prepareCombat(state)
}

function afterLos(state: GameState) {
  if (rulesOf(state).firingArc && state.combat?.kind === "weapon") {
    state.step = "arc"
    return
  }
  afterArc(state)
}

function afterArc(state: GameState) {
  const rules = rulesOf(state)
  const kind = state.combat?.kind
  if (kind === "physical" || kind === "melee") {
    state.step = "contact"
    return
  }
  if (kind === "weapon" && rules.physical) {
    state.step = "contact"
    return
  }
  askShotExtras(state)
}

function askShotExtras(state: GameState) {
  const rules = rulesOf(state)
  const combat = state.combat
  if (!combat) return
  if (rules.partialCover && !combat.askedPartial) {
    state.step = "partial"
    return
  }
  if (rules.woods && !combat.askedWoods) {
    state.step = "woods"
    return
  }
  if (combat.kind === "weapon") {
    state.step = "range"
    return
  }
  startRoll(state)
}

function onAmmoMarked(state: GameState, result: "armor" | "structure" | "out") {
  const combat = state.combat
  if (!combat?.targetId) throw new RuleError("The attack was lost. Undo and try again.")
  const mech =
    combat.critFor === "self" ? requireMech(state, combat.attackerId) : requireMech(state, combat.targetId)
  if (result === "out") {
    destroyMech(mech)
    if (checkWin(state)) return
    afterCrit(state)
    return
  }
  if (result === "structure") {
    combat.critDone = false
    state.step = "crit"
    return
  }
  afterCrit(state)
}

function startRoll(state: GameState) {
  fillPreview(state)
  state.step = "roll"
}

function fillPreview(state: GameState) {
  const combat = state.combat
  if (!combat?.kind || !combat.targetId) return
  const preview = attackPreview({
    attacker: requireMech(state, combat.attackerId),
    target: requireMech(state, combat.targetId),
    rules: rulesOf(state),
    kind: combat.kind,
    range: combat.range,
    partial: combat.partial,
    woods: combat.woods,
    tweak: combat.tweak,
  })
  combat.lines = preview.lines
  combat.targetNumber = preview.total
}

function resolvePhysicalHit(state: GameState) {
  const combat = state.combat
  if (!combat?.kind || !combat.targetId) throw new RuleError("The attack was lost. Undo and try again.")
  const attacker = requireMech(state, combat.attackerId)
  const target = requireMech(state, combat.targetId)
  const rules = rulesOf(state)
  if (combat.kind === "physical") combat.totalDamage = attacker.size ?? 1
  if (combat.kind === "melee") combat.totalDamage = (attacker.size ?? 1) + 1
  if (combat.kind === "charge") {
    combat.totalDamage = chargeTargetDamage(attacker, rules)
    combat.selfDamage = chargeSelfDamage(attacker, target, rules)
  }
  if (combat.kind === "dfa") {
    combat.totalDamage = chargeTargetDamage(attacker, rules) + 1
    combat.selfDamage = attacker.size ?? 1
    combat.forceCrit = true
  }
  if (rules.rear && state.step !== "rear" && state.step !== "bubbles") {
    state.step = "rear"
    return
  }
  state.step = "bubbles"
}

function afterTarget(state: GameState) {
  const combat = state.combat
  if (combat?.selfDamage != null && combat.selfDamage > 0 && !combat.selfDone) {
    state.step = "self"
    return
  }
  advanceCombat(state)
}

function afterCrit(state: GameState) {
  if (checkWin(state)) return
  afterTarget(state)
}

function beginEnd(state: GameState) {
  applyHeat(state)
  if (rulesOf(state).retreat && state.turn >= 2) {
    mutualRetreat(state, "Two turns are done. Both pilots pull back. Nobody lost.")
    return
  }
  state.phase = "end"
  state.step = "heat"
  state.confirmations = []
  state.activeMechId = undefined
  checkWin(state)
}

function applyHeat(state: GameState) {
  const rules = rulesOf(state)
  for (const mech of state.mechs) {
    if (mech.knockedOut) continue
    if (rules.teachingHeat) {
      mech.hot = mech.shotThisTurn
      continue
    }
    if (!rules.heatScale) continue
    const beganShutdown = mech.shutdown
    let heat = mech.heat
    if (mech.shotThisTurn) heat += mech.overheatUsed
    if (mech.inWater) heat -= 1
    if (!mech.shotThisTurn) heat = 0
    if (beganShutdown) {
      heat = 0
      mech.shutdown = false
      mech.woke = true
    }
    if (mech.shotThisTurn && mech.engineHits > 0) heat += 1
    if (heat >= 4) {
      mech.heat = 4
      mech.shutdown = true
    } else {
      mech.heat = Math.max(0, heat)
      if (!beganShutdown) mech.shutdown = false
    }
  }
}

function startInitiative(state: GameState) {
  if (checkWin(state)) return
  state.turn += 1
  state.phase = "initiative"
  state.step = "roll"
  state.initiative = {}
  state.beaconAnswers = {}
  state.confirmations = []
  state.moveOrder = []
  state.combat = undefined
}

function checkWin(state: GameState): boolean {
  const winner = findWinner(state)
  if (!winner) return false
  state.phase = "over"
  state.step = "done"
  state.winnerId = winner.id
  state.winReason = winner.reason
  return true
}

function findWinner(state: GameState): { id: string; reason: string } | null {
  if (rulesOf(state).retreat) return null
  if (state.players.length < 2) return null
  for (const player of state.players) {
    const mine = state.mechs.filter((mech) => mech.ownerId === player.id)
    if (mine.length > 0 && mine.every((mech) => mech.knockedOut)) {
      const other = state.players.find((seat) => seat.id !== player.id)
      if (!other) return null
      return { id: other.id, reason: "Every enemy mech is knocked out." }
    }
  }
  const scenario = mustScenario(state.scenarioId)
  if (scenario.rules.beacon) {
    for (const player of state.players) {
      if (player.beaconPoints >= scenario.beaconGoal) {
        return { id: player.id, reason: `${player.name} reached ${player.beaconPoints} beacon points.` }
      }
    }
  }
  return null
}

function modesFor(state: GameState, mech: Mech) {
  const enemiesMoved = state.mechs.some(
    (other) => other.ownerId !== mech.ownerId && !other.knockedOut && state.moveOrder.includes(other.id),
  )
  return availableModes(mech, rulesOf(state), enemiesMoved)
}

function freshCombat(attackerId: string, kind?: AttackKind, targetId?: string): CombatState {
  return {
    attackerId,
    kind,
    targetId,
    overheat: 0,
    lines: [],
    rear: false,
    critDone: false,
    partial: false,
    woods: false,
    askedPartial: false,
    askedWoods: false,
    tweak: 0,
  }
}

function ensureCombat(state: GameState, attackerId: string): CombatState {
  if (!state.combat) state.combat = freshCombat(attackerId)
  return state.combat
}

function writeCard(mech: Mech, field: CardField, value: number | boolean) {
  if (field === "jump") {
    if (typeof value !== "boolean") throw new RuleError("Tap yes or no.")
    mech.hasJump = value
    return
  }
  if (typeof value !== "number") throw new RuleError("Type a number from the card.")
  if (field === "walk") {
    assertRange(value, 1, 30, "Walk inches should be on the card.")
    mech.walkInches = value
  } else if (field === "skill") {
    assertRange(value, 0, 8, "Skill is usually 4.")
    mech.skill = value
  } else if (field === "tmm") {
    assertRange(value, 0, 6, "TMM is the small movement number on the card.")
    mech.tmm = value
  } else if (field === "ov") {
    assertRange(value, 0, 6, "OV is how many overheat boxes are on the card.")
    mech.ov = value
  } else if (field === "size") {
    assertRange(value, 1, 4, "Size is 1, 2, 3, or 4.")
    mech.size = value
  } else if (field === "jumpInches") {
    assertRange(value, 1, 30, "Type the inches next to the j.")
    mech.jumpInches = value
  } else if (field === "armor") {
    assertRange(value, 0, 16, "Count the armor bubbles on the card.")
    mech.armor = value
    mech.armorLeft = value
  } else if (field === "structure") {
    assertRange(value, 0, 12, "Count the red structure bubbles on the card.")
    mech.structure = value
    mech.structureLeft = value
  }
}

function freshMech(scenario: Scenario, id: string, variantId: string, ownerId: string): Mech {
  const card = mustFace(variantId)
  const mech = blankMech(id, card.name, ownerId)
  mech.variant = card.id
  mech.skill = scenario.skill
  mech.tmm = card.tmm
  mech.ov = card.ov
  mech.size = card.size
  mech.hasJump = card.jump != null
  if (card.jump != null) mech.jumpInches = card.jump
  if (scenario.group !== "teaching") {
    mech.walkInches = card.walk
    mech.armor = card.armor
    mech.armorLeft = card.armor
    mech.structure = card.structure
    mech.structureLeft = card.structure
  }
  return mech
}

function variantForName(state: GameState, name: string): string {
  const scenario = mustScenario(state.scenarioId)
  const listed = [...scenario.forces.innerSphere, ...scenario.forces.clan]
  const match = listed.find((id) => mustFace(id).name === name)
  return match ?? defaultFace(name).id
}

function cardCount(card: ReturnType<typeof mustFace>, field: CardField): number {
  if (field === "walk") return card.walk
  if (field === "armor") return card.armor
  if (field === "structure") return card.structure
  throw new RuleError("That number is already on the card.")
}

function missSay(mech: Mech, card: ReturnType<typeof mustFace>, field: CardField, expected: number): string {
  const where =
    field === "walk"
      ? "Ground move is the number on the move line. Skip the j."
      : field === "armor"
        ? "Armor bubbles are the open circles. Skip the red ones."
        : "Structure bubbles are the red ones."
  if ((mech.quizMisses ?? 0) < 2) return `That does not match the card. ${where}`
  const unit = field === "walk" ? "inches" : "bubbles"
  return `The side labeled ${card.side} has ${expected} ${unit}. ${where}`
}

function applyPrintedDamage(state: GameState) {
  const combat = state.combat
  if (!combat?.range || !combat.attackerId) throw new RuleError("The attack was lost. Undo and try again.")
  const mech = requireMech(state, combat.attackerId)
  const box = boxAt(mustFace(mech.variant), combat.range)
  if (box === "star") {
    state.step = "star"
    return
  }
  finishWeaponDamage(state, boxedDamage(box, mech.weaponHits))
}

function finishWeaponDamage(state: GameState, cardDamage: number) {
  const combat = state.combat
  if (!combat?.range) throw new RuleError("The attack was lost. Undo and try again.")
  combat.cardDamage = cardDamage
  combat.totalDamage = weaponBubbles(cardDamage, combat.overheat, combat.rear, combat.range)
  if (rulesOf(state).retreat) {
    applyLessonHit(state)
    return
  }
  state.step = "bubbles"
}

function facingSay(state: GameState, player: Player): string {
  const sides = state.mechs
    .filter((mech) => mech.ownerId === player.id)
    .map((mech) => `Use the side labeled ${mustFace(mech.variant).side} on the ${mech.name}. Leave the other side face down.`)
    .join(" ")
  return `${player.name}, put ${namesOf(state, player.id)} on your home edge, facing the other side. ${sides}`.trim()
}

function applyLessonHit(state: GameState) {
  const combat = state.combat
  if (!combat?.targetId || combat.totalDamage == null) throw new RuleError("The attack was lost. Undo and try again.")
  const target = requireMech(state, combat.targetId)
  const pool = (target.armorLeft ?? 0) + (target.structureLeft ?? 0)
  if (combat.totalDamage > 0 && combat.totalDamage >= pool) {
    mutualRetreat(
      state,
      `That shot would knock out the ${target.name}. It is not counted. Both pilots pull back. Nobody lost.`,
    )
    return
  }
  const spent = spendBubbles(target, combat.totalDamage)
  combat.armorMarked = spent.armor
  combat.structureMarked = spent.structure
  state.step = "bubbles"
}

function spendBubbles(mech: Mech, amount: number): { armor: number; structure: number } {
  const armor = Math.min(mech.armorLeft ?? 0, amount)
  mech.armorLeft = (mech.armorLeft ?? 0) - armor
  const structure = Math.min(mech.structureLeft ?? 0, amount - armor)
  mech.structureLeft = (mech.structureLeft ?? 0) - structure
  return { armor, structure }
}

function mutualRetreat(state: GameState, reason: string) {
  state.phase = "over"
  state.step = "done"
  state.winnerId = undefined
  state.activeMechId = undefined
  state.winReason = reason
}

function blankMech(id: string, name: string, ownerId: string): Mech {
  return {
    id,
    name,
    variant: "",
    ownerId,
    knockedOut: false,
    heat: 0,
    hot: false,
    shutdown: false,
    fireControlHits: 0,
    weaponHits: 0,
    engineHits: 0,
    mpHits: 0,
    touchingCover: false,
    inWater: false,
    shotThisTurn: false,
    overheatUsed: 0,
  }
}

function destroyMech(mech: Mech) {
  mech.knockedOut = true
  mech.shutdown = false
}

function remainingMechs(state: GameState, playerId: string): Mech[] {
  const moved = new Set(state.moveOrder)
  return state.mechs.filter((mech) => mech.ownerId === playerId && !mech.knockedOut && !moved.has(mech.id))
}

function requirePlayer(state: GameState, playerId: string): Player {
  const player = state.players.find((seat) => seat.id === playerId)
  if (!player) throw new RuleError("You are not in this game.")
  return player
}

function requireMech(state: GameState, mechId: string): Mech {
  const mech = state.mechs.find((item) => item.id === mechId)
  if (!mech) throw new RuleError("That mech is not in this game.")
  return mech
}

function activeMech(state: GameState): Mech {
  if (!state.activeMechId) throw new RuleError("No mech is active.")
  return requireMech(state, state.activeMechId)
}

function requireOwner(state: GameState, playerId: string): Mech {
  const mech = activeMech(state)
  if (mech.ownerId !== playerId) throw new RuleError("Watch the table. It is the other player's turn.")
  return mech
}

function playerBySeat(state: GameState, seat: "host" | "guest"): Player | undefined {
  return seat === "host" ? state.players[0] : state.players[1]
}

function namesOf(state: GameState, playerId: string): string {
  const names = state.mechs.filter((mech) => mech.ownerId === playerId).map((mech) => `the ${mech.name}`)
  if (names.length <= 1) return names[0] ?? "your mech"
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

function assertRange(value: number, min: number, max: number, message: string) {
  if (!Number.isInteger(value) || value < min || value > max) throw new RuleError(message)
}

export function enemiesOf(state: GameState, ownerId: string): Mech[] {
  return state.mechs.filter((mech) => mech.ownerId !== ownerId && !mech.knockedOut)
}

export { modesFor }
