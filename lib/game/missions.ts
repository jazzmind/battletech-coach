import { fixedLayout, pair, type Layout } from "../scenario-gen/layout"
import { extraPieces, stepsFor } from "../scenario-gen/scenario"
import { rules } from "./rules"
import type { Scenario } from "./scenarios"
import { falcon, galaxy, garrison, lyran, narrator, tag } from "./script"

const LYRAN = "Twycross Garrison, Lyran Commonwealth"
const FALCON = "Jade Falcon Star, Clan Jade Falcon"

// The whole quick-start turn, the same rules as Chapter 11.
const FULL = {
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
  specialsReminder: true,
}

const TABLE = "Clear a space about 4 feet by 3 feet. Sit on the long edges. The map shows where every piece goes."

function fromLayout(layout: Layout) {
  return {
    layout,
    terrain: stepsFor(layout),
    extraPieces: extraPieces(layout),
    objectives: layout.objectives.map((item) => ({ id: item.id, label: item.label, kind: item.kind })),
  }
}

const RIDGE = fixedLayout(
  "mission-ridge",
  [
    ...pair("largeBuilding", 6, 9),
    ...pair("smallBuilding", 30, 8),
    ...pair("smallBuilding", 20, 13),
    ...pair("tree", 4, 16),
    ...pair("tree", 14, 10),
    ...pair("tree", 40, 12),
  ],
  [],
)

const POST = fixedLayout(
  "mission-post",
  [
    ...pair("largeBuilding", 9, 12),
    ...pair("smallBuilding", 19, 8),
    ...pair("smallBuilding", 36, 9),
    ...pair("tree", 22, 14),
    ...pair("tree", 4, 18),
    ...pair("tree", 30, 15),
  ],
  [{ id: "hold-1", label: "the listening post", kind: "hold", x: 24, y: 18 }],
)

const DROP = fixedLayout(
  "mission-drop",
  [
    ...pair("largeBuilding", 20, 10),
    ...pair("smallBuilding", 5, 9),
    ...pair("smallBuilding", 38, 12),
    ...pair("tree", 10, 14),
    ...pair("tree", 30, 8),
    ...pair("tree", 44, 16),
  ],
  [
    { id: "hold-1", label: "the west crate", kind: "hold", x: 14, y: 18 },
    { id: "hold-2", label: "the east crate", kind: "hold", x: 34, y: 18 },
  ],
)

const GASH = fixedLayout(
  "mission-gash",
  [
    ...pair("largeBuilding", 4, 12),
    ...pair("smallBuilding", 16, 9),
    ...pair("smallBuilding", 30, 14),
    ...pair("tree", 24, 8),
    ...pair("tree", 40, 10),
    ...pair("tree", 20, 15),
  ],
  [{ id: "exit", label: "the far edge", kind: "exit", x: 24, y: 18 }],
)

export const MISSIONS: Scenario[] = [
  {
    id: "ridge-road",
    group: "missions",
    title: "The Ridge Road",
    summary: "Two mechs each on a full table. Knock out the other side.",
    chapter: "Mission 1: The Ridge Road",
    art: { src: "/art/missions/ridge-road.jpg", alt: "Two mechs trading fire across a ridge road at dusk" },
    story: [
      narrator("The beacon fight is over, but the Falcons are not done. A Clan star is walking the ridge road toward the spaceport."),
      garrison("Garrison Command: Lieutenant {is}, stop them on the ridge. Use the buildings. Do not let them reach the port.", "Garrison Command: Lieutenant, stop them on the ridge. Use the buildings. Do not let them reach the port."),
      tag("Clan channel:"),
      falcon(
        "\"Star Commander {clan}. Timber Wolf and Nova. We walk to the spaceport, and nobody stops us.\"",
        "Star Commander here. Timber Wolf and Nova. We walk to the spaceport, and nobody stops us.",
      ),
      narrator("No beacon tonight. This is a stand-up fight with every rule you know."),
    ],
    goal: "Knock out every enemy mech.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: Hold the ridge. Make every shot count.",
        plan: [
          "The Archer shoots far. Park it behind a building and fire over the open ground.",
          "The Phoenix Hawk jumps. Use it to get behind the Timber Wolf.",
          "Hits in the back mark an extra bubble.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: Walk through them. Your guns are better.",
        plan: [
          "The Timber Wolf hits hard at medium range. Keep it there.",
          "The Nova jumps. Use the trees so it is harder to hit.",
          "Do not let the Phoenix Hawk land behind you.",
        ],
      },
    },
    ending: {
      innerSphere: [tag("Lieutenant {is}:"), lyran("\"Ridge road is clear. The port is safe.\""), narrator("The Falcons turn back into the hills.")],
      clan: [tag("Star Commander {clan}:"), falcon("\"The road is open. On to the spaceport.\""), narrator("The Lyrans fall back to the city.")],
      draw: [narrator("Both stars lie broken on the ridge. Nobody reaches the port tonight.")],
    },
    lesson:
      "A full table changes the fight. Buildings block the line of sight, trees make a mech harder to hit, and walking through trees costs extra inches. Before you move, look at the map and pick the spot you want to end on.",
    table: TABLE,
    rules: rules(FULL),
    skill: 4,
    forces: { innerSphere: ["ARC-5R", "PXH-3K"], clan: ["TW-Prime", "NOV-Prime"] },
    beaconGoal: 2,
    ...fromLayout(RIDGE),
    interludes: [
      {
        turn: 2,
        title: "Radio, turn 2",
        lines: [
          garrison("Garrison Command: Lieutenant, the port crews are watching. Hold that ridge.", "Garrison Command: The port crews are watching. Hold that ridge."),
          galaxy("Galaxy Command: Star Commander, do not stop in the open. Keep walking."),
        ],
      },
      {
        turn: 3,
        title: "Radio, turn 3",
        lines: [lyran("\"Smoke on the ridge. Somebody is hurt.\""), falcon("\"A wounded Falcon still bites.\"")],
      },
    ],
  },
  {
    id: "listening-post",
    group: "missions",
    title: "The Listening Post",
    summary: "Hold the listening post in the middle of the map. First to 2 points wins.",
    chapter: "Mission 2: The Listening Post",
    art: { src: "/art/missions/listening-post.jpg", alt: "A radio tower between two buildings with mechs closing in" },
    story: [
      garrison("Garrison Command, all units: the listening post is back on the air. Whoever holds it hears every order on Twycross."),
      narrator("Lieutenant {is} brings a Warhammer and a Wasp. Clan channel:"),
      falcon("\"Star Commander {clan}. Pouncer and Fire Moth. The post is ours by sunrise.\"", "Star Commander here. Pouncer and Fire Moth. The post is ours by sunrise."),
      narrator("The post is the token in the middle. Be the only side touching it at the end of a turn to score."),
    ],
    goal: "Be the only one touching the listening post at the end of a turn to score 1. First to 2 wins. Knocking out every enemy mech also wins.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: The Wasp takes the post. The Warhammer guards it.",
        plan: [
          "Jump the Wasp onto the post. It is small, so keep it near cover.",
          "The Warhammer is slow. Put it where it can see the post.",
          "The Fire Moth is very fast. Shoot it when it stops.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: The Fire Moth runs to the post. The Pouncer clears it.",
        plan: [
          "The Fire Moth reaches the post first. Keep it moving so it is hard to hit.",
          "Jump the Pouncer onto anything touching the post.",
          "Two points wins, even if the Warhammer is still standing.",
        ],
      },
    },
    ending: {
      innerSphere: [tag("Lieutenant {is}:"), lyran("\"The post is ours. We hear everything now.\"")],
      clan: [tag("Star Commander {clan}:"), falcon("\"The Lyrans have gone quiet. The post belongs to the Falcons.\"")],
      draw: [narrator("The post goes silent. Neither side can use it tonight.")],
    },
    lesson:
      "Only one side touching the post scores. If both sides touch it, nobody scores that turn. A fast mech gets there first, but a slow mech with big guns can push it off.",
    table: TABLE,
    rules: rules({ ...FULL, beacon: true }),
    skill: 4,
    forces: { innerSphere: ["WHM-8R", "WSP-3W"], clan: ["POU-Prime", "FM-D"] },
    beaconGoal: 2,
    ...fromLayout(POST),
    interludes: [
      {
        turn: 2,
        title: "Radio, turn 2",
        lines: [narrator("The listening post crackles. Both sides can hear it."), galaxy("Galaxy Command: Star Commander, the Lyrans are listening. Take it now.")],
      },
      {
        turn: 3,
        title: "Radio, turn 3",
        lines: [garrison("Garrison Command: Lieutenant, one more point and Twycross can hear again.", "Garrison Command: One more point and Twycross can hear again.")],
      },
    ],
  },
  {
    id: "supply-drop",
    group: "missions",
    title: "Supply Drop",
    summary: "Two supply crates. Score each crate you hold alone. First to 2 points wins.",
    chapter: "Mission 3: Supply Drop",
    art: { src: "/art/missions/supply-drop.jpg", alt: "Two supply crates on parachutes landing between buildings" },
    story: [
      narrator("A cargo ship drops two supply crates over the town. Ammo, armor, and spare parts. Both sides saw them fall."),
      garrison("Garrison Command: Lieutenant {is}, those crates keep the garrison fighting. Get them.", "Garrison Command: Lieutenant, those crates keep the garrison fighting. Get them."),
      tag("Clan channel:"),
      falcon("\"Star Commander {clan}. The crates are a gift. Falcons take gifts.\"", "Star Commander here. The crates are a gift. Falcons take gifts."),
      narrator("There are two crates. At the end of each turn, check each crate. Whoever is alone touching it scores 1."),
    ],
    goal: "At the end of each turn, score 1 for each crate only your mechs touch. First to 2 wins. Knocking out every enemy mech also wins.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: Split up. One mech on each crate.",
        plan: [
          "The Wraith is fast. Send it to the far crate.",
          "The Blackjack jumps. It can hop onto the near crate and shoot.",
          "If you hold both crates in one turn, you win right away.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: Take one crate and hold it. Then take the other.",
        plan: [
          "The Nova and the Pouncer both jump. Land next to a building for cover.",
          "Two mechs on one crate is safe, but it only scores 1.",
          "Push the Lyrans off a crate and it is nobody's.",
        ],
      },
    },
    ending: {
      innerSphere: [tag("Lieutenant {is}:"), lyran("\"Both crates are home. The garrison eats tonight.\"")],
      clan: [tag("Star Commander {clan}:"), falcon("\"Lyran armor, on Falcon mechs. A good trade.\"")],
      draw: [narrator("The crates sit in the street, smoking. Nobody carries them home.")],
    },
    lesson:
      "With two objectives you have to choose. Split up to score both, or stay together and be safer. Check each crate on its own at the end of the turn.",
    table: TABLE,
    rules: rules({ ...FULL, beacon: true }),
    skill: 4,
    forces: { innerSphere: ["BJ-3", "TR1"], clan: ["NOV-Prime", "POU-Prime"] },
    beaconGoal: 2,
    ...fromLayout(DROP),
    interludes: [
      {
        turn: 2,
        title: "Radio, turn 2",
        lines: [lyran("\"I can see the west crate. Moving in.\""), falcon("\"The east crate is ours. Hold it.\"")],
      },
      {
        turn: 3,
        title: "Radio, turn 3",
        lines: [narrator("One crate has split open. Spare armor plates lie in the street.")],
      },
    ],
  },
  {
    id: "through-the-gash",
    group: "missions",
    title: "Through the Gash",
    summary: "Get one mech off the far edge, or knock out the other side.",
    chapter: "Mission 4: Through the Gash",
    art: { src: "/art/missions/through-the-gash.jpg", alt: "A fast mech running through a narrow canyon between ruined buildings" },
    story: [
      narrator("The Falcons have jammed the radio. The garrison needs one mech to run through the Great Gash and carry the message out."),
      garrison("Garrison Command: Lieutenant {is}, get a mech to the far edge. Everything depends on it.", "Garrison Command: Lieutenant, get a mech to the far edge. Everything depends on it."),
      tag("Clan channel:"),
      falcon("\"Star Commander {clan}. Nothing gets through the Gash. And we are going through them.\"", "Star Commander here. Nothing gets through the Gash. And we are going through them."),
      narrator("Both sides are trying to break through. A mech that walks off the other home edge scores, and one score wins."),
    ],
    goal: "Get a mech off the other side's home edge to win. Knocking out every enemy mech also wins.",
    sides: {
      innerSphere: {
        unit: LYRAN,
        orders: "Garrison Command: The Wasp runs. The Atlas blocks the road.",
        plan: [
          "The Wasp is fast and jumps. Send it around the buildings.",
          "The Atlas is slow but huge. Stand it where the Fire Moth wants to run.",
          "Sprint is one and a half times your walk, but that mech cannot shoot.",
        ],
      },
      clan: {
        unit: FALCON,
        orders: "Galaxy Command: The Fire Moth runs. The Warhawk stops the Wasp.",
        plan: [
          "The Fire Moth is the fastest mech in the box. Sprint it for the edge.",
          "The Warhawk shoots far. Watch the Wasp and shoot it when it lands.",
          "One mech off the far edge wins.",
        ],
      },
    },
    ending: {
      innerSphere: [tag("Lieutenant {is}:"), lyran("\"The Wasp is through. The message is out.\""), narrator("Help is coming to Twycross.")],
      clan: [tag("Star Commander {clan}:"), falcon("\"The Fire Moth is through. Twycross is cut off.\"")],
      draw: [narrator("Nobody gets through the Gash. The radio stays quiet one more night.")],
    },
    lesson:
      "When the goal is an edge, speed matters more than guns. A fast mech that sprints can reach the edge, but it cannot shoot that turn. Slow mechs win by standing in the way.",
    table: TABLE,
    rules: rules({ ...FULL, beacon: true }),
    skill: 4,
    forces: { innerSphere: ["AS7-S", "WSP-3W"], clan: ["WHK-C", "FM-D"] },
    beaconGoal: 1,
    ...fromLayout(GASH),
    interludes: [
      {
        turn: 2,
        title: "Radio, turn 2",
        lines: [narrator("Static on every channel. Only short range radios work in the Gash."), lyran("\"Keep running. Do not stop.\"")],
      },
      {
        turn: 3,
        title: "Radio, turn 3",
        lines: [galaxy("Galaxy Command: Star Commander, the edge is close. Sprint.")],
      },
    ],
  },
]
