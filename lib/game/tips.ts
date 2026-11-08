import { mustFace, type CardFace } from "./cards"
import { enemiesOf } from "./flow"
import { mustScenario } from "./scenarios"
import type { GameState, Mech, Player, Rules } from "./types"

export type Tip = { title: string; text: string }

export type MechLore = {
  lore: string
  role: string
  variants: Record<string, string>
}

/** Flavor and card notes for every mini in the box. Card notes are gated in the tips. */
export const MECH_LORE: Record<string, MechLore> = {
  Wasp: {
    lore: "A small Lyran scout. It has been hopping around battlefields for a long time.",
    role: "Scout. Get close, or hide.",
    variants: {
      "WSP-3W": "This side only hurts inside 6 inches. The medium box is 0.",
      "WSP-5A": "This side is faster and can shoot at medium range.",
    },
  },
  Locust: {
    lore: "A light hunter. It runs circles around bigger mechs.",
    role: "Scout. Keep moving around the big mechs.",
    variants: {
      "LCT-3M": "Walk 16, with a little medium damage.",
      "LCT-7V": "Walk 20. Even faster, and the medium box is 2.",
    },
  },
  Blackjack: {
    lore: "A medium trooper with guns that still reach at long range.",
    role: "Shooter. Use the long box when you can.",
    variants: {
      "BJ-3": "This side can add 1 overheat, and the long box is 2.",
      "BJ-5": "No overheat on this side. The long box is 3, so it likes distance.",
    },
  },
  "Phoenix Hawk": {
    lore: "A medium raider. Lyran scouts use it to get somewhere first.",
    role: "Raider. Take the spot you want, then shoot.",
    variants: {
      "PXH-3K": "The long box on this side is 2.",
      "PXH-4M": "The long box on this side is 1. Stay a little closer than the 3K.",
    },
  },
  Wraith: {
    lore: "A fast medium mech built to get in close and use its fists.",
    role: "Brawler. Get within 24 inches.",
    variants: {
      "TR1": "Walk 14. The long box is 0.",
      "TR5": "Walk 16. A bit faster on the ground, and the long box is still 0.",
    },
  },
  Archer: {
    lore: "A heavy missile mech. It stands back and throws missiles.",
    role: "Missile boat. Stay far away and shoot.",
    variants: {
      "ARC-5R": "This side can add 1 overheat.",
      "ARC-7C": "This side hits harder, the long box is 4, and it can shoot behind itself.",
    },
  },
  Warhammer: {
    lore: "A famous heavy mech with a big gun on each arm. It walks a steady 8.",
    role: "Line fighter. Stand where you can see, and shoot.",
    variants: {
      "WHM-6R": "The older side. 5 armor.",
      "WHM-8R": "This side has 7 armor and a little more damage. The first duel uses it.",
    },
  },
  Atlas: {
    lore: "The biggest Inner Sphere mech in the box. It was built to make enemies afraid. It is slow.",
    role: "Assault. Walk straight in. You can take a hit.",
    variants: {
      "AS7-S": "Guns for every range, and it can shoot behind itself.",
      "AS7-S4": "This side can add 1 overheat, and the long box is 4.",
    },
  },
  "Fire Moth": {
    lore: "The Clans call it the Dasher. It is the fastest mech in this box. One solid hit can knock it out.",
    role: "Scout. Move every turn.",
    variants: {
      "FM-D": "Walk 26. 1 armor and 1 structure.",
      "FM-G": "Walk 30. Even faster, and just as thin.",
    },
  },
  Pouncer: {
    lore: "A Clan medium OmniMech. Omni means the guns can be changed between fights.",
    role: "Raider. Cross the wall, then shoot.",
    variants: {
      "POU-Prime": "The long box is 3. This side can shoot far.",
      "POU-T": "The long box is 0. This side has to get within 24 inches.",
    },
  },
  Nova: {
    lore: "A Clan medium OmniMech famous for running hot. It carries more guns than its engine can cool.",
    role: "Brawler. Shoot hard, then let it cool.",
    variants: {
      "NOV-Prime": "This side shows OV 4, the most overheat in the box.",
      "NOV-T": "No overheat boxes. The short and medium boxes are 6.",
    },
  },
  "Timber Wolf": {
    lore: "A Clan heavy OmniMech. Inner Sphere pilots named it the Mad Cat, because it looked like a Marauder and a Catapult mashed together.",
    role: "Line fighter. Shoot from medium or long.",
    variants: {
      "TW-Prime": "The long box is 4. This is the Mad Cat from the first duel.",
      "TW-T": "Short and medium are 7. This side hits harder up close, and OV is 2.",
    },
  },
  Warhawk: {
    lore: "A Clan assault OmniMech. The Inner Sphere calls it the Masakari. It is big, and its guns reach a long way.",
    role: "Assault. Pick the distance, then shoot.",
    variants: {
      "WHK-C": "6 damage at every range, even long.",
      "WHK-T": "The long box is 4, and this side can add 1 overheat.",
    },
  },
}

type Audience = "actor" | "watcher" | "table"

type TipContext = {
  state: GameState
  player: Player
  rules: Rules
  mine: Mech[]
  acting?: Mech
  mineActing: boolean
}

type TipRule = {
  needs?: (keyof Rules)[]
  audience: Audience
  when: (ctx: TipContext) => boolean
  tip: (ctx: TipContext) => Tip
}

const RULES: TipRule[] = [
  {
    audience: "actor",
    when: (ctx) => step(ctx, "move", "pass") && Boolean(subject(ctx)?.shutdown),
    tip: (ctx) => own(subject(ctx), "It is shut down. It stays where it is and cannot shoot."),
  },
  {
    needs: ["heatScale"],
    audience: "actor",
    when: (ctx) => step(ctx, "combat", "overheat") && ov(subject(ctx)) >= 3,
    tip: (ctx) => {
      const mech = subject(ctx)
      const extra = ov(mech)
      return own(
        mech,
        `It can add ${extra} overheat. 1 or 2 is safe. ${extra} shuts you down next turn, and a still mech is easy to hit.`,
      )
    },
  },
  {
    needs: ["heatScale"],
    audience: "actor",
    when: (ctx) => step(ctx, "combat", "overheat") && ov(subject(ctx)) > 0,
    tip: (ctx) => {
      const extra = ov(subject(ctx))
      return own(
        subject(ctx),
        `You can add up to ${extra}. Each point is one extra bubble now and one heat at the end of the turn. Heat 4 shuts the mech down.`,
      )
    },
  },
  {
    audience: "actor",
    when: (ctx) => step(ctx, "combat", "range") && box(subject(ctx), "medium") === 0,
    tip: (ctx) =>
      own(subject(ctx), "Your medium box is 0. A 0 or a dash there means get within 6 inches to hurt anything."),
  },
  {
    audience: "actor",
    when: (ctx) => step(ctx, "combat", "range") && box(subject(ctx), "long") === 0,
    tip: (ctx) =>
      own(subject(ctx), "Your long box is 0. A 0 or a dash there means get within 24 inches to hurt anything."),
  },
  {
    needs: ["realRange"],
    audience: "actor",
    when: (ctx) => {
      const long = box(subject(ctx), "long")
      return step(ctx, "combat", "range") && typeof long === "number" && long >= 4
    },
    tip: (ctx) => {
      const long = box(subject(ctx), "long")
      return own(
        subject(ctx),
        `Your long box is ${long}. You can hurt a mech from far away. Long range adds 4 to the number the dice need.`,
      )
    },
  },
  {
    needs: ["tmm"],
    audience: "actor",
    when: (ctx) => step(ctx, "move", "mode") && thin(subject(ctx)),
    tip: (ctx) => {
      const mech = subject(ctx)
      const card = face(mech)
      return own(
        mech,
        `It has ${card?.armor ?? 0} armor and ${card?.structure ?? 0} structure. One hit knocks it out. Its TMM is ${card?.tmm ?? 0}, so keep moving and never stand still.`,
      )
    },
  },
  {
    needs: ["teachingCover"],
    audience: "actor",
    when: (ctx) => step(ctx, "move", "mode") && thin(subject(ctx)),
    tip: (ctx) => {
      const mech = subject(ctx)
      const card = face(mech)
      return own(
        mech,
        `It has ${card?.armor ?? 0} armor and ${card?.structure ?? 0} structure. One hit knocks it out. Stay against a building or in the trees.`,
      )
    },
  },
  {
    audience: "actor",
    when: (ctx) => step(ctx, "move", "mode") && thin(subject(ctx)),
    tip: (ctx) => {
      const mech = subject(ctx)
      const card = face(mech)
      return own(
        mech,
        `It has ${card?.armor ?? 0} armor and ${card?.structure ?? 0} structure. One hit knocks it out. Keep it out of the open.`,
      )
    },
  },
  {
    needs: ["standstill"],
    audience: "actor",
    when: (ctx) => step(ctx, "move", "mode") && (face(subject(ctx))?.walk ?? 99) <= 6,
    tip: (ctx) => own(subject(ctx), "It is slow anyway. Standing still makes your shot 1 easier."),
  },
  {
    needs: ["realJump"],
    audience: "actor",
    when: (ctx) => step(ctx, "move", "mode") && Boolean(face(subject(ctx))?.jump),
    tip: (ctx) => {
      const inches = face(subject(ctx))?.jump
      return own(
        subject(ctx),
        `You can jump ${inches} inches. Jumping ignores trees and buildings. Your own shot is 2 harder, and you are 1 harder to hit.`,
      )
    },
  },
  {
    needs: ["teachingJump"],
    audience: "actor",
    when: (ctx) => step(ctx, "move", "mode") && Boolean(face(subject(ctx))?.jump),
    tip: (ctx) => {
      const inches = face(subject(ctx))?.jump
      return own(subject(ctx), `You can jump ${inches} inches. A mech that jumped is one harder to hit.`)
    },
  },
  {
    audience: "actor",
    when: (ctx) => step(ctx, "move", "mode") && coverOn(ctx.rules) && Boolean(longThreat(ctx)),
    tip: (ctx) => {
      const enemy = longThreat(ctx)
      return {
        title: `Watch the ${enemy?.name ?? "enemy"}`,
        text: `The ${enemy?.name ?? "enemy"} hits hard at long range. Use a building or the trees so it cannot see all of you.`,
      }
    },
  },
  {
    audience: "actor",
    when: (ctx) => step(ctx, "move", "mode") && Boolean(closeOnly(ctx)),
    tip: (ctx) => {
      const enemy = closeOnly(ctx)
      return {
        title: `Watch the ${enemy?.name ?? "enemy"}`,
        text: `The ${enemy?.name ?? "enemy"} hits hard inside 24 inches, and its long box is empty. Stay farther out if your guns can reach.`,
      }
    },
  },
  {
    needs: ["heatScale"],
    audience: "actor",
    when: (ctx) => step(ctx, "combat", "kind") && (subject(ctx)?.heat ?? 0) >= 1,
    tip: (ctx) => {
      const heat = subject(ctx)?.heat ?? 0
      return own(subject(ctx), `Your heat is ${heat}. This shot needs ${heat} more. Hold fire if you want the heat erased.`)
    },
  },
  {
    needs: ["teachingHeat"],
    audience: "actor",
    when: (ctx) => step(ctx, "combat", "kind") && Boolean(subject(ctx)?.hot),
    tip: (ctx) => own(subject(ctx), "You are Hot from the last shot. This shot needs one more. Hold fire to cool off."),
  },
  {
    needs: ["teachingHeat"],
    audience: "actor",
    when: (ctx) => step(ctx, "combat", "kind") && !subject(ctx)?.hot,
    tip: (ctx) => own(subject(ctx), "If you shoot, you are Hot next turn, and that next shot needs one more."),
  },
  {
    needs: ["physical"],
    audience: "actor",
    when: (ctx) => step(ctx, "combat", "kind"),
    tip: (ctx) => {
      const size = face(subject(ctx))?.size ?? 1
      return own(
        subject(ctx),
        `If the bases touch, you cannot shoot. A punch marks ${size} bubbles, equal to its size. You cannot punch and shoot in the same turn.`,
      )
    },
  },
  {
    needs: ["sprint"],
    audience: "actor",
    when: (ctx) => step(ctx, "move", "mode"),
    tip: (ctx) =>
      own(subject(ctx), "Sprint goes farther, one and a half times your walk, and that mech cannot shoot."),
  },
  {
    audience: "watcher",
    when: (ctx) => thin(ctx.acting),
    tip: (ctx) => {
      const card = face(ctx.acting)
      return {
        title: `Watch the ${ctx.acting?.name ?? "enemy"}`,
        text: `It has ${card?.armor ?? 0} armor and ${card?.structure ?? 0} structure. One hit knocks it out.`,
      }
    },
  },
  {
    needs: ["heatScale"],
    audience: "watcher",
    when: (ctx) => ov(ctx.acting) >= 3,
    tip: (ctx) => ({
      title: `Watch the ${ctx.acting?.name ?? "enemy"}`,
      text: `It can add ${ov(ctx.acting)} damage, and that much heat can shut it down.`,
    }),
  },
  {
    needs: ["realRange"],
    audience: "watcher",
    when: (ctx) => {
      const long = box(ctx.acting, "long")
      return typeof long === "number" && long >= 5
    },
    tip: (ctx) => ({
      title: `Watch the ${ctx.acting?.name ?? "enemy"}`,
      text: `It hits for ${box(ctx.acting, "long")} even at long range. Stay out of the open.`,
    }),
  },
  {
    needs: ["realJump"],
    audience: "watcher",
    when: (ctx) => Boolean(face(ctx.acting)?.jump),
    tip: (ctx) => ({
      title: `Watch the ${ctx.acting?.name ?? "enemy"}`,
      text: `It can jump ${face(ctx.acting)?.jump} inches. That makes it 1 harder to hit, and its own shot is 2 harder.`,
    }),
  },
  {
    needs: ["teachingJump"],
    audience: "watcher",
    when: (ctx) => Boolean(face(ctx.acting)?.jump),
    tip: (ctx) => ({
      title: `Watch the ${ctx.acting?.name ?? "enemy"}`,
      text: "It can jump. A mech that jumped is one harder to hit.",
    }),
  },
  {
    needs: ["beacon"],
    audience: "table",
    when: (ctx) => ctx.state.phase === "end" && ctx.state.step === "beacon",
    tip: (ctx) => ({
      title: "The beacon",
      text: `You score 1 only if your mech is touching the beacon and no enemy mech is. First to ${mustScenario(ctx.state.scenarioId).beaconGoal}.`,
    }),
  },
  {
    needs: ["retreat"],
    audience: "table",
    when: (ctx) => ctx.state.phase === "end",
    tip: () => ({
      title: "The duel",
      text: "One more turn after this, then both pilots pull back. Nobody loses.",
    }),
  },
  {
    needs: ["heatScale"],
    audience: "table",
    when: (ctx) => ctx.state.phase === "end" && ctx.state.step === "heat" && ctx.mine.some((mech) => mech.heat > 0 || mech.shutdown),
    tip: (ctx) => {
      const mech = ctx.mine.find((item) => item.shutdown) ?? ctx.mine.find((item) => item.heat > 0)
      if (mech?.shutdown) {
        return own(mech, "Heat 4 shuts it down. It skips its next turn. Erase the heat after that, and it wakes up.")
      }
      return own(
        mech,
        `Heat is ${mech?.heat ?? 0}. Walk drops by ${(mech?.heat ?? 0) * 2} inches. Hold fire next turn and the heat is erased.`,
      )
    },
  },
  {
    needs: ["teachingHeat"],
    audience: "table",
    when: (ctx) => ctx.state.phase === "end" && ctx.mine.some((mech) => mech.hot),
    tip: (ctx) => own(ctx.mine.find((mech) => mech.hot), "It shot, so it is Hot. The next shot needs one more."),
  },
  {
    audience: "table",
    when: (ctx) => ctx.state.phase === "gather" || (ctx.state.phase === "initiative" && ctx.state.turn === 1),
    tip: (ctx) => intro(ctx),
  },
  {
    audience: "actor",
    when: (ctx) => ctx.state.turn === 1 && (step(ctx, "move", "mode") || step(ctx, "combat", "kind")),
    tip: (ctx) => {
      const mech = subject(ctx)
      const lore = mech ? MECH_LORE[mech.name] : undefined
      const note = variantLine(face(mech), ctx.rules)
      return own(mech, [lore?.role, note].filter(Boolean).join(" "))
    },
  },
]

export function tipFor(state: GameState, playerId: string): Tip | undefined {
  const player = state.players.find((seat) => seat.id === playerId)
  if (!player) return undefined
  const ctx: TipContext = {
    state,
    player,
    rules: mustScenario(state.scenarioId).rules,
    mine: state.mechs.filter((mech) => mech.ownerId === playerId && !mech.knockedOut),
    acting: state.mechs.find((mech) => mech.id === state.activeMechId),
    mineActing: false,
  }
  ctx.mineActing = ctx.acting?.ownerId === playerId
  for (const rule of RULES) {
    if (rule.needs && rule.needs.some((key) => !ctx.rules[key])) continue
    if (!audienceOk(rule.audience, ctx)) continue
    if (!rule.when(ctx)) continue
    const tip = rule.tip(ctx)
    if (tip.text.trim().length === 0) continue
    return tip
  }
  return undefined
}

function audienceOk(audience: Audience, ctx: TipContext): boolean {
  if (audience === "table") return true
  if (!ctx.acting) return false
  if (audience === "actor") return ctx.mineActing
  return !ctx.mineActing
}

function step(ctx: TipContext, phase: GameState["phase"], name: string): boolean {
  return ctx.state.phase === phase && ctx.state.step === name
}

function subject(ctx: TipContext): Mech | undefined {
  if (ctx.mineActing) return ctx.acting
  return ctx.mine[0]
}

function face(mech: Mech | undefined): CardFace | undefined {
  if (!mech?.variant) return undefined
  return mustFace(mech.variant)
}

function box(mech: Mech | undefined, band: "medium" | "long"): CardFace["medium"] | undefined {
  const card = face(mech)
  if (!card) return undefined
  return band === "medium" ? card.medium : card.long
}

function ov(mech: Mech | undefined): number {
  return face(mech)?.ov ?? mech?.ov ?? 0
}

function thin(mech: Mech | undefined): boolean {
  const card = face(mech)
  if (!card) return false
  return card.armor + card.structure <= 2
}

function coverOn(rules: Rules): boolean {
  return rules.partialCover || rules.woods || rules.teachingCover
}

function longThreat(ctx: TipContext): Mech | undefined {
  return enemiesOf(ctx.state, ctx.player.id).find((mech) => {
    const long = face(mech)?.long
    return typeof long === "number" && long >= 5
  })
}

function closeOnly(ctx: TipContext): Mech | undefined {
  return enemiesOf(ctx.state, ctx.player.id).find((mech) => {
    const card = face(mech)
    return card != null && card.long === 0 && typeof card.medium === "number" && card.medium >= 4
  })
}

function own(mech: Mech | undefined, text: string): Tip {
  const name = mech?.name ?? "mech"
  return { title: `Tip for your ${name}`, text }
}

function variantLine(card: CardFace | undefined, rules: Rules): string | undefined {
  if (!card) return undefined
  const note = MECH_LORE[card.name]?.variants[card.id]
  if (!note) return undefined
  if (/overheat|\bOV\b|heat/i.test(note) && !rules.heatScale) return undefined
  if (/jump/i.test(note) && !rules.teachingJump && !rules.realJump) return undefined
  if (/\bTMM\b/.test(note) && !rules.tmm) return undefined
  return note
}

function intro(ctx: TipContext): Tip {
  const lines = ctx.mine.map((mech) => {
    const lore = MECH_LORE[mech.name]
    const card = face(mech)
    const bits = [lore?.lore, lore?.role, variantLine(card, ctx.rules)]
    if ((ctx.rules.teachingJump || ctx.rules.realJump) && card?.jump) {
      bits.push(`It can jump ${card.jump} inches.`)
    }
    if (ctx.rules.heatScale && (card?.ov ?? 0) >= 3) {
      bits.push(`The card shows OV ${card?.ov}.`)
    }
    return `${mech.name}. ${bits.filter(Boolean).join(" ")}`
  })
  const title = ctx.mine.length === 1 ? `Meet your ${ctx.mine[0].name}` : "Meet your mechs"
  return { title, text: lines.join(" ") }
}
