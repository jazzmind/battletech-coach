import { MISSIONS } from "./missions"
import { rules } from "./rules"
import { falcon, garrison, lyran, narrator, tag, type Line } from "./script"
import type { Faction, Group, Rules } from "./types"
import { fixedLayout, pair, type Layout } from "../scenario-gen/layout"
import { stepsFor } from "../scenario-gen/scenario"

export const INNER_SPHERE = [
  "Wasp",
  "Wraith",
  "Locust",
  "Archer",
  "Blackjack",
  "Warhammer",
  "Phoenix Hawk",
  "Atlas",
] as const

export const CLAN = ["Fire Moth", "Timber Wolf", "Pouncer", "Warhawk", "Nova"] as const

export function rosterFor(faction: Faction): readonly string[] {
  return faction === "innerSphere" ? INNER_SPHERE : CLAN
}

export function factionLabel(faction: Faction): string {
  return faction === "innerSphere" ? "Inner Sphere" : "Clan"
}

export { rules }

export type TerrainStep = { who: "host" | "guest"; say: string; piece?: number }

export type SideBrief = {
  unit: string
  orders: string
  plan: string[]
}

export type Scenario = {
  id: string
  group: Group
  title: string
  summary: string
  chapter: string
  story: Line[]
  goal: string
  sides: Record<Faction, SideBrief>
  ending: Record<Faction | "draw", Line[]>
  lesson: string
  review?: string
  table: string
  rules: Rules
  skill: number
  forces: Record<Faction, string[]>
  extraPieces: string[]
  terrain: TerrainStep[]
  beaconGoal: number
  pickup?: boolean
  objectives?: { id: string; label: string; kind: "hold" | "exit" }[]
  layout?: Layout
  art?: { src: string; alt: string }
  // Radio chatter shown at the start of a turn, before initiative.
  interludes?: { turn: number; title: string; lines: Line[] }[]
}

const LYRAN = "Twycross Garrison, Lyran Commonwealth"
const FALCON = "Jade Falcon Star, Clan Jade Falcon"

export function speak(text: string, innerSphere: string, clan: string): string {
  return text.replaceAll("{is}", innerSphere).replaceAll("{clan}", clan)
}

const named = (who: "host" | "guest", say: string): TerrainStep => ({ who, say })

const BEACON_TOKEN = { id: "beacon", label: "the beacon", kind: "hold" as const, x: 24, y: 18 }

// 3 by 4 feet. The two large buildings sit in the middle, a hand's width apart.
const TOWN = fixedLayout(
  "town",
  [
    { kind: "largeBuilding", x: 14, y: 15, role: "center" },
    { kind: "largeBuilding", x: 27, y: 16, role: "center" },
    ...pair("smallBuilding", 6, 8),
    ...pair("smallBuilding", 30, 8),
    ...pair("tree", 4, 14),
    ...pair("tree", 16, 9),
    ...pair("tree", 36, 12),
  ],
  [],
)

const BEACON_TOWN = fixedLayout(
  "beacon-town",
  [
    { kind: "largeBuilding", x: 10, y: 12, role: "center" },
    { kind: "largeBuilding", x: 32, y: 12, role: "center" },
    ...pair("smallBuilding", 6, 8),
    ...pair("tree", 8, 20),
    ...pair("tree", 18, 8),
  ],
  [BEACON_TOKEN],
)

const ORCHARD = fixedLayout(
  "orchard",
  [
    { kind: "largeBuilding", x: 14, y: 15, role: "center" },
    { kind: "largeBuilding", x: 27, y: 16, role: "center" },
    ...pair("tree", 6, 10),
    ...pair("tree", 20, 9),
  ],
  [],
)

const WHOLE_TOWN = fixedLayout("whole-town", TOWN.pieces.map((piece) => ({ kind: piece.kind, x: piece.x, y: piece.y, role: piece.role })), [BEACON_TOKEN])

const JUMP_WALL = fixedLayout(
  "jump-wall",
  [
    { kind: "wall", x: 21, y: 17, role: "center" },
    { kind: "largeBuilding", x: 8, y: 12, role: "host" },
    { kind: "tree", x: 12, y: 22, role: "host" },
    { kind: "tree", x: 34, y: 20, role: "guest" },
  ],
  [],
)

export const SCENARIOS: Scenario[] = [
  {
    id: "first-steps",
    group: "teaching",
    title: "First Steps",
    summary: "One mech each. Two turns, then both pull back.",
    chapter: "Chapter 1: The Challenge",
    story: [
      narrator("Twycross, 3050. Clan Jade Falcon has landed. Open channel:"),
      falcon("\"I am Star Commander {clan} of Clan Jade Falcon. What warrior defends this world? Meet me, one against one.\""),
      narrator("That challenge is a batchall. Lieutenant {is} keys the radio:"),
      lyran("\"Twycross Garrison. One Warhammer. I will meet you.\""),
      narrator(
        "{clan} walks out in a Timber Wolf. Inner Sphere pilots call it a Mad Cat, because it looks like two of their mechs mashed together. Under zellbrigen, the Clan code of honor, the duel is one on one, and when it is done both pilots pull back. Nobody loses.",
      ),
    ],
    goal: "Play two turns, then both pilots pull back. Nobody loses. A shot that would knock a mech out ends the fight the same way.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: Answer the batchall. Learn the shot. Walk away when the two turns are done.",
        plan: [
          "Stay inside 24 inches so your guns can hit.",
          "Within 6 inches, use the short box. Past 6, use the medium box.",
          "After two turns you both leave. Zellbrigen holds the Falcon to that too.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: Issue the batchall. Show these Spheroids a Timber Wolf. Then walk away with your honor.",
        plan: [
          "The Timber Wolf shoots well past 6 inches. You can stay there.",
          "Mark the bubbles the coach names. Armor first, then the red ones.",
          "When two turns are done, pull back. Zellbrigen is kept.",
        ],
      },
    },
    ending: {
      innerSphere: [
        tag("Lieutenant {is}:"),
        lyran("\"Garrison, the Warhammer is still standing. The Falcon is pulling back.\""),
        narrator("Honor is kept, and nobody is called the loser."),
      ],
      clan: [
        tag("Star Commander {clan}:"),
        falcon("\"You fight well for a Spheroid, Lieutenant.\""),
        narrator("The Timber Wolf walks off still standing. Honor is kept, and nobody is called the loser."),
      ],
      draw: [
        tag("Open channel. Star Commander {clan}:", "Open channel."),
        falcon("\"Well fought, Lieutenant {is}. We will meet in the town.\"", "Well fought, Lieutenant. We will meet in the town."),
        narrator("Both pilots raise a hand and walk back. The batchall is answered."),
      ],
    },
    lesson:
      "Use the Warhammer side labeled 8R and the Timber Wolf side labeled Prime. The other sides are not an even match. The skill spot is blank, so both pilots are regular and the dice need 4. Count the armor bubbles and the red structure bubbles once. The coach keeps that count. Mark the same bubbles on the card. After two turns, both pilots pull back. Nobody loses.",
    table: "Clear a square about 3 feet on each side. The edges you sit on are the home edges.",
    rules: rules({ teachingRange: true, retreat: true }),
    skill: 4,
    forces: { innerSphere: ["WHM-8R"], clan: ["TW-Prime"] },
    extraPieces: ["both dice", "a tape measure"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "streets",
    group: "teaching",
    title: "Streets and Trees",
    summary: "Two mechs each. Buildings, trees, jumps, and cover.",
    chapter: "Chapter 2: The Town",
    story: [
      garrison("Garrison Command, all units: the duel is over and the Falcons are moving into town."),
      narrator("Buildings and trees break up the streets. Lieutenant {is} takes a Wasp and a Warhammer. Intercepted on the Clan channel:"),
      falcon(
        "\"Star Commander {clan}. Fire Moth, Timber Wolf, advance. The town will be ours by nightfall.\"",
        "Star Commander here. Fire Moth, Timber Wolf, advance. The town will be ours by nightfall.",
      ),
      narrator("A mech against a wall, or standing in the trees, is harder to hit. A mech that jumps is harder to hit too."),
    ],
    goal: "Knock out every enemy mech.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: Hold the town. Use the buildings and the trees.",
        plan: [
          "Put the Wasp against a building or in the trees. That makes it harder to hit.",
          "The Warhammer is your big gun. Keep it where it can see down a street.",
          "If the card has a jump move, a jump makes that mech harder to hit.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: Take the town. The Fire Moth is fast and thin. Give it a wall.",
        plan: [
          "Park the Fire Moth against a building or in the trees.",
          "The Timber Wolf can shoot from farther down the street.",
          "A mech that jumped is one harder to hit.",
        ],
      },
    },
    ending: {
      innerSphere: [garrison("Garrison Command, all units: the town stays Lyran. Lieutenant {is} holds the streets.")],
      clan: [tag("Star Commander {clan}:"), falcon("\"The streets are ours. Raise the Falcon over the town.\"")],
      draw: [narrator("Both sides pull out. The streets are empty, and every channel goes quiet.")],
    },
    lesson:
      "New choices: if the card has a jump move, you may jump. A mech that jumped is one harder to hit. A mech touching a building or standing in trees is one harder to hit. This is the teaching version of cover, not the full table.",
    table: "Clear a space about 3 feet by 4 feet. Sit on the long edges.",
    rules: rules({ teachingRange: true, teachingCover: true, teachingJump: true }),
    skill: 4,
    forces: {
      innerSphere: ["WSP-3W", "WHM-8R"],
      clan: ["FM-D", "TW-Prime"],
    },
    extraPieces: [
      "2 large buildings",
      "4 small buildings",
      "6 trees",
      "both dice",
      "a tape measure",
    ],
    terrain: [
      named("host", "{name}, take one large building and put it in the middle of the table. Not on a home edge."),
      named("guest", "{name}, take the other large building and put it in the middle too, a hand's width from the first."),
      named("host", "{name}, take two small buildings and put them on your half of the table."),
      named("guest", "{name}, take two small buildings and put them on your half."),
      named("host", "{name}, take three trees and put them on your half. Do not pile them on the buildings."),
      named("guest", "{name}, take three trees and put them on your half."),
    ],
    layout: TOWN,
    beaconGoal: 2,
  },
  {
    id: "beacon",
    group: "teaching",
    title: "Grab the Beacon",
    summary: "Hold the center token. Shooting makes you hot.",
    chapter: "Chapter 3: The Black Box",
    story: [
      garrison(
        "Garrison Command: our listening post in the middle of town is still transmitting. The token in the center is its beacon. Whoever holds it alone can call down help. For us that means reinforcements. For the Falcons it means their DropShips.",
      ),
      narrator("Lieutenant {is} has a Phoenix Hawk and a Wasp. Clan channel:"),
      falcon("\"Star Commander {clan}. Pouncer, Fire Moth, take that beacon.\"", "Star Commander here. Pouncer, Fire Moth, take that beacon."),
      narrator("Every shot makes a mech Hot, and a Hot mech's next shot needs one more."),
    ],
    goal: "Be the only one touching the beacon at the end of a turn to score 1. First to 2 wins. Knocking out every enemy mech also wins.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: Get a mech on the beacon and keep the Falcons off it.",
        plan: [
          "Jump the Phoenix Hawk onto the beacon, then hold fire so it cools.",
          "A mech that shoots is Hot next turn. That shot needs one more.",
          "You score only when no enemy mech is also touching the beacon.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: Take the beacon before the Lyrans can call for help.",
        plan: [
          "The Pouncer can jump onto the beacon.",
          "The Fire Moth is fast, and one hit knocks it out. Use it to grab the beacon.",
          "If you shoot, you are Hot next turn.",
        ],
      },
    },
    ending: {
      innerSphere: [
        narrator("The beacon gets through on the Lyran band:"),
        garrison("\"Garrison, we hear you. Help is coming, Lieutenant {is}.\"", "Garrison, we hear you. Help is coming, Lieutenant."),
      ],
      clan: [
        tag("The beacon calls the Falcon DropShips. Star Commander {clan}:", "The beacon calls the Falcon DropShips."),
        falcon("\"The listening post is ours.\""),
      ],
      draw: [narrator("The beacon goes quiet. Nobody held it long enough to be heard.")],
    },
    lesson:
      "Teaching heat: a mech that shoots is Hot next turn, and its shot needs one more. If it does not shoot, it cools off. A mech alone on the beacon at the end of the turn scores 1. First to 2, or the last side standing.",
    table: "Clear a space about 3 feet by 4 feet. Sit on the long edges.",
    rules: rules({
      teachingRange: true,
      teachingCover: true,
      teachingJump: true,
      teachingHeat: true,
      beacon: true,
    }),
    skill: 4,
    forces: {
      innerSphere: ["PXH-3K", "WSP-3W"],
      clan: ["POU-Prime", "FM-D"],
    },
    extraPieces: [
      "2 large buildings",
      "2 small buildings",
      "4 trees",
      "one punchboard token for the beacon",
      "both dice",
      "a tape measure",
    ],
    terrain: [
      named("host", "{name}, take one large building and put it in the middle, not on a home edge."),
      named("guest", "{name}, take the other large building and put it in the middle, a hand's width from the first."),
      named("host", "{name}, take one small building and put it on your half."),
      named("guest", "{name}, take one small building and put it on your half."),
      named("host", "{name}, take two trees and put them on your half."),
      named("guest", "{name}, take two trees and put them on your half."),
      named("host", "{name}, put one punchboard token in the exact center. That is the beacon."),
    ],
    layout: BEACON_TOWN,
    beaconGoal: 2,
  },
  {
    id: "how-far",
    group: "real",
    title: "How Far",
    summary: "The real range bands: short, medium, and long.",
    chapter: "Chapter 4: The Long Shot",
    story: [
      garrison("Garrison Command: Falcon assault contact on the open flats."),
      narrator(
        "There is nowhere to hide, so distance is the whole fight. Lieutenant {is} brings an Atlas. It is the biggest Lyran mech in the box, and its skull face was built to make enemies afraid. Clan channel:",
      ),
      falcon("\"Star Commander {clan}, in Warhawk. I will take that Atlas.\"", "Star Commander here, in Warhawk. I will take that Atlas."),
      narrator("The Inner Sphere calls that mech a Masakari."),
    ],
    goal: "Knock out every enemy mech.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: The Atlas is slow. Make the long ground work for you.",
        plan: [
          "Short, up to 6 inches, adds nothing to the number you need.",
          "Medium, past 6 and up to 24, adds 2. Long, past 24 and up to 42, adds 4.",
          "Past 42 is too far. Your Atlas hits hardest inside 24 inches.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: The Warhawk hits hard even far away. You choose the distance.",
        plan: [
          "Your long box is 6. You can shoot from across the flats.",
          "The Atlas is slow. You can walk away and keep the range you want.",
          "Long adds 4 to the number the dice need. Medium adds 2.",
        ],
      },
    },
    ending: {
      innerSphere: [
        tag("Lieutenant {is}:"),
        lyran("\"Masakari down. The Atlas is walking off the flats.\""),
        narrator("Twycross still has its giant."),
      ],
      clan: [
        tag("Star Commander {clan}:"),
        falcon("\"The Atlas has fallen. The flats are ours.\""),
        narrator("The Masakari outshot the Lyran giant."),
      ],
      draw: [narrator("Both giants fall. Nobody answers on either channel.")],
    },
    lesson:
      "From here on, the number to beat uses the real range bands. Short, up to 6 inches, adds nothing. Medium, past 6 and up to 24, adds 2. Long, past 24 and up to 42, adds 4. Past 42 is too far. Damage still comes from that box on the card.",
    review: "A mech that shoots is still Hot. That next shot needs one more.",
    table: "Clear a square about 4 feet on each side, so a long shot can exist. Sit on opposite edges.",
    rules: rules({ realRange: true, teachingCover: true, teachingJump: true, teachingHeat: true }),
    skill: 4,
    forces: { innerSphere: ["AS7-S"], clan: ["WHK-C"] },
    extraPieces: ["both dice", "a tape measure"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "they-moved",
    group: "real",
    title: "They Moved",
    summary: "Add the card's TMM. Standing still is easier.",
    chapter: "Chapter 5: The Fast Ones",
    story: [
      narrator("Garrison scout net:"),
      garrison("\"Contact. One Clan light, moving fast across the flats.\""),
      narrator(
        "Lieutenant {is} has a Wasp. Star Commander {clan} has a Fire Moth. The Clans call it a Dasher. It is the fastest mech in this box, and one good hit can knock it out. A mech that moves is harder to hit. A mech that stands still is easier to hit, and its own shot is easier.",
      ),
    ],
    goal: "Knock out every enemy mech.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: Catch the Dasher. Make it stand still if you can.",
        plan: [
          "Your Wasp is fast. Moving adds its TMM, so it is harder to hit.",
          "Standing still makes your own shot one easier, and your TMM drops to 0.",
          "The Fire Moth dies to one solid hit. A still Dasher is the shot you want.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: Stay moving. A still Dasher is a dead Dasher.",
        plan: [
          "Your TMM is 4 while you move. Standing still drops that to 0.",
          "You have 1 armor and 1 structure. One hit knocks you out.",
          "A move under 1 inch counts as standing still, and that shot is one easier.",
        ],
      },
    },
    ending: {
      innerSphere: [
        tag("Lieutenant {is}:"),
        lyran("\"Dasher down.\""),
        narrator("The Wasp caught it. Fast is not the same as safe."),
      ],
      clan: [tag("Star Commander {clan}:"), falcon("\"The Wasp is down.\""), narrator("The Dasher lives. Speed wins this race.")],
      draw: [narrator("Both scouts break off and go silent. The race ends even.")],
    },
    lesson:
      "TMM is the target movement modifier on the card. A mech that walked or sprinted adds its TMM to the number you need. A mech that moved less than 1 inch stood still: its TMM is 0, and its own shot is one easier.",
    table: "Clear a space about 3 feet by 4 feet. Sit on the long edges.",
    rules: rules({
      realRange: true,
      tmm: true,
      standstill: true,
      teachingCover: true,
      teachingJump: true,
      teachingHeat: true,
    }),
    skill: 4,
    forces: { innerSphere: ["WSP-3W"], clan: ["FM-D"] },
    extraPieces: ["both dice", "a tape measure"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "trees-and-walls",
    group: "real",
    title: "Trees and Walls",
    summary: "Movement cost, woods, and partial cover.",
    chapter: "Chapter 6: The Orchard",
    story: [
      garrison("Garrison Command: the Mad Cat from the duel is back, in the orchards outside town."),
      narrator("Lieutenant {is} takes the Warhammer in after it. Clan channel:"),
      falcon(
        "\"Star Commander {clan}. We finish what we began, Lieutenant.\"",
        "Star Commander here. We finish what we began, Lieutenant.",
      ),
      narrator(
        "Both pilots have to think about the ground, not just the guns. Trees cost extra inches to walk through. A building can hide most of a mech.",
      ),
    ],
    goal: "Knock out every enemy mech.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: Use the orchard. Make the Mad Cat pay for every inch.",
        plan: [
          "Clear ground costs 1 inch of move per inch you walk. Trees cost 2.",
          "If two-thirds of the enemy is behind a building, the shot is one harder.",
          "Trees in the way, or a target standing in trees, are also one harder.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: Cross the orchard without wasting your move in the trees.",
        plan: [
          "Walking through trees costs 2 inches for every inch you travel.",
          "Hide two-thirds of the Timber Wolf behind a building when you can.",
          "These mechs do not jump, so walk the open lane and pay the tree cost.",
        ],
      },
    },
    ending: {
      innerSphere: [tag("Lieutenant {is}:"), lyran("\"Mad Cat down in the trees.\""), narrator("The orchard stays Lyran.")],
      clan: [tag("Star Commander {clan}:"), falcon("\"The Warhammer lies in the orchard. This ground is ours.\"")],
      draw: [narrator("Both mechs fall among the trees. The orchard goes quiet.")],
    },
    lesson:
      "Clear ground costs 1 inch of move per inch you travel. Trees cost 2. A climb costs extra, and a step up steeper than 2 inches is not allowed. If two-thirds of the target is hidden by a building, a hill, or water, the shot is one harder. Trees in the way, or a target standing in trees, are also one harder. Trees do not count as that hiding cover.",
    review: "A mech that moved still adds its TMM. Standing still makes its own shot one easier.",
    table: "Clear a space about 3 feet by 4 feet. Sit on the long edges.",
    rules: rules({
      realRange: true,
      tmm: true,
      standstill: true,
      teachingJump: true,
      teachingHeat: true,
      partialCover: true,
      woods: true,
      terrainCost: true,
    }),
    skill: 4,
    forces: { innerSphere: ["WHM-8R"], clan: ["TW-Prime"] },
    extraPieces: ["2 large buildings", "4 trees", "both dice", "a tape measure"],
    terrain: [
      named("host", "{name}, take one large building and put it in the middle of the table."),
      named("guest", "{name}, take the other large building and put it in the middle, a hand's width from the first."),
      named("host", "{name}, take two trees and put them on your half."),
      named("guest", "{name}, take two trees and put them on your half."),
    ],
    layout: ORCHARD,
    beaconGoal: 2,
  },
  {
    id: "jump-jets",
    group: "real",
    title: "Jump Jets",
    summary: "Jumping ignores terrain and changes the shot.",
    chapter: "Chapter 7: Over the Wall",
    story: [
      garrison("Garrison Command: a town wall stands between our line and theirs."),
      narrator("Lieutenant {is} brings a Phoenix Hawk. Clan channel:"),
      falcon("\"Star Commander {clan}. Pouncer, over the wall.\"", "Star Commander here. Pouncer, over the wall."),
      narrator(
        "Both mechs can jump the wall. Jumping ignores trees and buildings. A jump makes your own shot harder, and it makes you a little harder to hit.",
      ),
    ],
    goal: "Knock out every enemy mech.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: Jump the wall when walking would take too long. Then decide if you shoot.",
        plan: [
          "A jump uses the inches next to the j. It ignores trees and buildings.",
          "A jump adds 2 to your own shot. Land first if you need an easier roll next turn.",
          "Someone shooting at you adds 1 on top of your TMM because you jumped.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: Jump the wall and make the Phoenix Hawk come to you.",
        plan: [
          "The Pouncer jumps 10 inches, over the wall and the trees.",
          "Your own shot is 2 harder in the turn you jump.",
          "You are 1 harder to hit, on top of your TMM, because you jumped.",
        ],
      },
    },
    ending: {
      innerSphere: [tag("Lieutenant {is}:"), lyran("\"The wall is held. The Pouncer is down on the far side.\"")],
      clan: [tag("Star Commander {clan}:"), falcon("\"Over the wall. The Phoenix Hawk could not hold it.\"")],
      draw: [narrator("Both jumpers fall. The wall stands empty.")],
    },
    lesson:
      "A jump move is the inches next to the j on the card. Jumping ignores trees and buildings. It cannot jump out of water. A mech that jumped adds 2 to its own shot, and 1 on top of its TMM when someone shoots it. Landing in the trees or against the building is still the one-harder cover shot.",
    review: "Trees and a building still make the shot one harder. A jump ignores the extra inches to cross them, not that cover.",
    table: "Clear a space about 3 feet by 4 feet. Sit on the long edges.",
    rules: rules({
      realRange: true,
      tmm: true,
      standstill: true,
      teachingHeat: true,
      realJump: true,
      partialCover: true,
      woods: true,
      terrainCost: true,
    }),
    skill: 4,
    forces: { innerSphere: ["PXH-3K"], clan: ["POU-Prime"] },
    extraPieces: ["1 wall", "1 large building", "2 trees", "both dice", "a tape measure"],
    terrain: stepsFor(JUMP_WALL),
    layout: JUMP_WALL,
    beaconGoal: 2,
  },
  {
    id: "heat-scale",
    group: "real",
    title: "The Heat Scale",
    summary: "Overheat adds damage now and heat at the end.",
    chapter: "Chapter 8: The Salt Flats",
    story: [
      garrison("Garrison Command: the Falcons have pushed us onto the salt flats. It is hot out here."),
      narrator(
        "Mechs carry fusion engines, and every shot makes them hotter. Star Commander {clan}'s Nova has more guns than it can keep cool. Lieutenant {is} answers in the Warhammer.",
      ),
    ],
    goal: "Knock out every enemy mech.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: Let the Nova cook. Make it walk to you.",
        plan: [
          "The Nova hits hard up close. Stay past 6 inches and make it walk to you.",
          "If it overheats, it gets slow. Heat takes inches off its walk.",
          "Your Warhammer can add 1 overheat. That is one extra bubble, and one heat.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: Spend the Nova's guns a little at a time. Do not let it shut down.",
        plan: [
          "Your Nova can add 4 overheat. 1 or 2 is safe.",
          "4 shuts you down next turn, and a still mech is easy to hit.",
          "If you do not shoot, erase the heat.",
        ],
      },
    },
    ending: {
      innerSphere: [
        tag("Lieutenant {is}:"),
        lyran("\"The Nova cooked itself.\""),
        narrator("The Warhammer still has heat to spare."),
      ],
      clan: [
        tag("Star Commander {clan}:"),
        falcon("\"The Warhammer is down.\""),
        narrator("The Nova's guns finished it before the heat could shut them down."),
      ],
      draw: [narrator("Both mechs go dark in the heat. The salt flats win.")],
    },
    lesson:
      "The OV on the card is how much extra damage you may add at short or medium range. You choose it before you roll. At the end of the turn, mark that much heat. Your heat is added to your next weapon shot. Twice your heat comes off your walk inches. At heat 2 or more, TMM drops by 1 unless you jump. Heat 4 shuts the mech down for a turn. If you do not shoot, erase the heat. Water cools one heat if you did shoot.",
    table: "Clear a square about 3 feet on each side. No buildings. Sit on opposite edges.",
    rules: rules({
      realRange: true,
      tmm: true,
      standstill: true,
      realJump: true,
      partialCover: true,
      woods: true,
      terrainCost: true,
      heatScale: true,
    }),
    skill: 4,
    forces: { innerSphere: ["WHM-8R"], clan: ["NOV-Prime"] },
    extraPieces: ["both dice", "a tape measure"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "breaks",
    group: "real",
    title: "Bubbles and Breaks",
    summary: "Rear hits and the critical hit table.",
    chapter: "Chapter 9: The Back Armor",
    story: [
      narrator("Garrison tech, before the drop:"),
      garrison("\"Armor is the metal skin. Structure is the bones underneath.\""),
      narrator(
        "Lieutenant {is}'s Atlas has a lot of both. Star Commander {clan}'s Warhawk does too. A hit in the back marks one extra bubble. When the red structure bubbles get marked, something inside can break. That is a critical hit.",
      ),
    ],
    goal: "Knock out every enemy mech.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: Get behind the Warhawk. The back is the soft part.",
        plan: [
          "A hit through the back of the base marks one extra bubble.",
          "Armor bubbles go first. Then the red structure bubbles.",
          "If structure is marked and the mech is still up, roll the critical hit table.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: Keep your back away from the Atlas. Crack its structure.",
        plan: [
          "Turn so the Atlas shoots your front. The back would add a bubble.",
          "The Atlas has 10 armor. You will need more than one hit.",
          "When structure is marked, the tables card says what broke.",
        ],
      },
    },
    ending: {
      innerSphere: [tag("Lieutenant {is}:"), lyran("\"Hit the Masakari in the back. Structure breached. It is down.\"")],
      clan: [tag("Star Commander {clan}:"), falcon("\"The Atlas is broken open. Even a giant has bones.\"")],
      draw: [narrator("Both assault mechs break. The crits take them together.")],
    },
    lesson:
      "A hit in the back of the base marks one extra bubble. Armor bubbles go first, then red structure bubbles. If structure is marked and the mech is still standing, roll two dice and read the critical hit table on the tables card in the box. A roll of 12 does that even if only armor was marked. The mech comes off the table when the last structure bubble is marked.",
    review: "Heat still comes off the walk, and heat 4 still shuts the mech down.",
    table: "Clear a square about 3 feet on each side. Keep the tables card next to the dice.",
    rules: rules({
      realRange: true,
      tmm: true,
      standstill: true,
      realJump: true,
      partialCover: true,
      woods: true,
      terrainCost: true,
      heatScale: true,
      rear: true,
      crits: true,
    }),
    skill: 4,
    forces: { innerSphere: ["AS7-S"], clan: ["WHK-C"] },
    extraPieces: ["both dice", "a tape measure", "the tables card from the box"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "up-close",
    group: "real",
    title: "Up Close",
    summary: "You punch when the bases are touching. You do not shoot.",
    chapter: "Chapter 10: Fist Range",
    story: [
      garrison("Garrison Command: the Falcons followed us into a narrow cut of the Great Gash, the huge canyon on Twycross."),
      narrator(
        "In here the mechs get too close to shoot. Lieutenant {is} brings a Wraith, a fast mech with fists. Star Commander {clan} brings the Nova. When the bases touch, you punch. You do not shoot.",
      ),
    ],
    goal: "Knock out every enemy mech.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: Get the Wraith in close. The Nova wants room to shoot.",
        plan: [
          "If the bases are touching, you cannot shoot that mech. Punch it.",
          "A punch reaches 1 inch and marks bubbles equal to your size.",
          "You cannot punch and shoot in the same turn.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: Keep a little space. Your guns are the fight.",
        plan: [
          "Leave a gap so the bases do not touch, and you can still shoot.",
          "If you do punch, the damage is your size.",
          "The Wraith jumps. It will try to land on you.",
        ],
      },
    },
    ending: {
      innerSphere: [tag("Lieutenant {is}:"), lyran("\"Got inside its guns. The Nova is down.\""), narrator("Fists win the canyon.")],
      clan: [
        tag("Star Commander {clan}:"),
        falcon("\"The Wraith never landed its punch.\""),
        narrator("The Nova kept just enough room to shoot."),
      ],
      draw: [narrator("They meet in the middle and both fall. The Gash keeps the wrecks.")],
    },
    lesson:
      "If the bases are touching, you cannot shoot that mech. A punch reaches 1 inch, hits on the skill number plus the usual movement and cover modifiers, and marks bubbles equal to the mech's size. If the card says MEL, that melee reach is 2 inches and the damage is size plus 1. You cannot punch and shoot in the same turn.",
    table: "Clear a square about 3 feet on each side so the mechs can reach each other.",
    rules: rules({
      realRange: true,
      tmm: true,
      standstill: true,
      realJump: true,
      partialCover: true,
      woods: true,
      terrainCost: true,
      heatScale: true,
      rear: true,
      crits: true,
      physical: true,
    }),
    skill: 4,
    forces: { innerSphere: ["TR1"], clan: ["NOV-Prime"] },
    extraPieces: ["both dice", "a tape measure"],
    terrain: [],
    beaconGoal: 2,
  },
  {
    id: "the-whole-turn",
    group: "graduation",
    title: "The Whole Turn",
    summary: "Every quick-start step, plus a beacon.",
    chapter: "Chapter 11: The Whole Star",
    story: [
      garrison("Garrison Command, all units: the edge of town, and the listening post beacon is back in the center."),
      narrator("Lieutenant {is} has the Warhammer and the Phoenix Hawk. Clan channel:"),
      falcon(
        "\"Star Commander {clan}. Timber Wolf, Pouncer. Take the beacon and Twycross falls.\"",
        "Star Commander here. Timber Wolf, Pouncer. Take the beacon and Twycross falls.",
      ),
      narrator(
        "Every lesson comes together here. This is a full quick-start turn: move, shoot, heat, the back armor, crits, punches, sprints, and charges.",
      ),
    ],
    goal: "Be the only one touching the beacon at the end of a turn to score 1. First to 2 wins. Knocking out every enemy mech also wins.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: The Phoenix Hawk takes the beacon. The Warhammer holds the lane.",
        plan: [
          "Jump the Phoenix Hawk to the beacon. The Warhammer shoots whoever comes close.",
          "Sprint is one and a half times your walk, and that mech cannot shoot.",
          "Read any special ability on the card out loud, then use the card.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: The Pouncer jumps for the beacon. The Timber Wolf shoots past it.",
        plan: [
          "Put the Pouncer on the beacon and the Timber Wolf where it can see.",
          "A charge must end touching a mech that already moved.",
          "First to 2 beacon points wins, even if both sides are still standing.",
        ],
      },
    },
    ending: {
      innerSphere: [
        tag("The beacon reaches the Lyran line. Lieutenant {is}:", "The beacon reaches the Lyran line."),
        lyran("\"Garrison, Twycross holds for one more day.\""),
      ],
      clan: [
        tag("The beacon calls the Falcons down. Star Commander {clan}:", "The beacon calls the Falcons down."),
        falcon("\"Twycross belongs to Clan Jade Falcon.\""),
      ],
      draw: [narrator("The beacon goes quiet. Neither side holds Twycross tonight.")],
    },
    lesson:
      "This is the whole quick-start turn from the box: initiative, move, the shot number, heat, rear, crits, punches, sprints, charges, and death from above. Sprint is one and a half times the walk inches, rounded up, and that mech cannot shoot. A charge is declared while moving, only at a mech that already moved, and you must end touching it. Read any special ability on the card out loud and use the card. The tables card still decides crits. Formations, pilot cards, and battlefield support stay in the box for another day.",
    table: "Clear a space about 3 feet by 4 feet. Sit on the long edges. Keep the tables card out.",
    rules: rules({
      realRange: true,
      tmm: true,
      standstill: true,
      realJump: true,
      partialCover: true,
      woods: true,
      terrainCost: true,
      heatScale: true,
      rear: true,
      crits: true,
      physical: true,
      charge: true,
      sprint: true,
      los: true,
      firingArc: true,
      beacon: true,
      specialsReminder: true,
    }),
    skill: 4,
    forces: {
      innerSphere: ["WHM-8R", "PXH-3K"],
      clan: ["TW-Prime", "POU-Prime"],
    },
    extraPieces: [
      "2 large buildings",
      "4 small buildings",
      "6 trees",
      "one punchboard token for the beacon",
      "both dice",
      "a tape measure",
      "the tables card from the box",
    ],
    terrain: [
      named("host", "{name}, take one large building and put it in the middle."),
      named("guest", "{name}, take the other large building and put it in the middle, a hand's width away."),
      named("host", "{name}, take two small buildings and put them on your half."),
      named("guest", "{name}, take two small buildings and put them on your half."),
      named("host", "{name}, take three trees and put them on your half."),
      named("guest", "{name}, take three trees and put them on your half."),
      named("host", "{name}, put one punchboard token in the exact center. That is the beacon."),
    ],
    layout: WHOLE_TOWN,
    beaconGoal: 2,
  },
]

// Every scenario with a fixed script: the box chapters, then the mission pack.
export const CATALOG: Scenario[] = [...SCENARIOS, ...MISSIONS]

const byId = new Map(CATALOG.map((scenario) => [scenario.id, scenario]))

export function getScenario(id: string): Scenario | undefined {
  return byId.get(id)
}

export function mustScenario(id: string): Scenario {
  const scenario = byId.get(id)
  if (!scenario) throw new Error(`Unknown scenario ${id}`)
  return scenario
}

export function scenarioOf(state: { scenarioId: string; customScenario?: Scenario }): Scenario {
  return state.customScenario ?? mustScenario(state.scenarioId)
}

export const GROUP_LABEL: Record<Group, string> = {
  teaching: "Basic training",
  real: "Field rules, one at a time",
  graduation: "Full engagement",
  missions: "Twycross missions, solo or with a friend",
}
