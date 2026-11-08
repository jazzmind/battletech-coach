import { SPEAKER_LABEL, type Speaker } from "../game/script"

export type Credit = { what: string; who: string; how: string; image?: string }

export const VOICE_CREDITS: Record<Exclude<Speaker, "coach">, string> = {
  narrator: "Nadine (calm, gentle)",
  lyran: "Chloe (bright, clear)",
  falcon: "Meredith (serious, composed)",
  garrison: "Hugh (firm, measured)",
  galaxy: "Soren (firm, measured)",
}

export const CREDITS: Credit[] = [
  {
    what: "The Lyran lieutenant",
    who: "Original portrait made for this app",
    how: "AI image generation. Not a likeness of any real person or published character.",
    image: "/art/pilots/lyran.jpg",
  },
  {
    what: "The Jade Falcon star commander",
    who: "Original portrait made for this app",
    how: "AI image generation. Not a likeness of any real person or published character.",
    image: "/art/pilots/falcon.jpg",
  },
  {
    what: "Garrison Command",
    who: "Original portrait made for this app",
    how: "AI image generation. Animated for the briefing clips with HeyGen.",
    image: "/art/pilots/garrison.jpg",
  },
  {
    what: "Galaxy Command",
    who: "Original portrait made for this app",
    how: "AI image generation. Animated for the briefing clips with HeyGen.",
    image: "/art/pilots/galaxy.jpg",
  },
  {
    what: "Mission paintings",
    who: "Original art made for this app",
    how: "AI image generation, with made-up mech designs so no published mech is copied.",
    image: "/art/missions/ridge-road.jpg",
  },
  {
    what: "Recorded voices",
    who: "HeyGen public voices",
    how: (Object.keys(VOICE_CREDITS) as (keyof typeof VOICE_CREDITS)[])
      .map((speaker) => `${SPEAKER_LABEL[speaker]}: ${VOICE_CREDITS[speaker]}`)
      .join(". "),
  },
  {
    what: "The coach voice",
    who: "Your device",
    how: "The step-by-step coach lines use the speech voices built into your browser.",
  },
  {
    what: "BattleTech and Alpha Strike",
    who: "Catalyst Game Labs and Topps",
    how: "This is a free, non-commercial fan project for teaching the game at home. It is not affiliated with or endorsed by the owners of BattleTech. Mech names and unit stats belong to them.",
  },
]
