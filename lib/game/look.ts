import type { Screen } from "./types"

export function lookPrompt(screen: Screen, playerName: string): string {
  const mine = screen.hud.rows.filter((row) => row.mine).map((row) => row.name)
  const mechs = mine.length > 0 ? mine.join(", ") : "no mechs on this side yet"
  return [
    `This photo is from ${playerName}'s side of the table.`,
    `The game is ${screen.hud.scenario}.`,
    `The coach just said: ${screen.say}`,
    `${playerName}'s mechs are ${mechs}.`,
    "Write a few short sentences a child can hear.",
    "Say what you can see on this side of the table.",
    "Give one or two pointers for the step the coach just described.",
    "Say what the picture does not show.",
    "If the photo is too dark, too close, or missing the miniatures, say that plainly.",
    "This is a look, not a referee. The cards, the dice, and the tape still decide.",
    "Do not invent numbers from a card.",
  ].join(" ")
}

export function checkPrompt(mech: string): string {
  return [
    `Look for the ${mech} miniature on the table.`,
    "Say whether you can see it, and whether it is sitting on a marked ring.",
    "If the photo is too dark, too close, or the miniature is missing, say that plainly.",
    "If you cannot tell, say so. The ring on the diagram is still the spot.",
  ].join(" ")
}
