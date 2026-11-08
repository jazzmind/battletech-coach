import type { Speaker } from "../game/script"

export type Casting = {
  heygen: string
  browser: { prefer: string[]; pitch: number; rate: number }
  portrait?: string
}

// `heygen` is a HeyGen voice_id picked with `npm run voices`. Changing one re-keys that speaker's
// recordings, so `npm run voice` renders them again and the old files stop being used.
export const CAST: Record<Speaker, Casting> = {
  narrator: {
    heygen: "83548de556df48ba8c09c42a57c51d85",
    browser: { prefer: ["Samantha", "Google US English", "Microsoft Aria", "Karen"], pitch: 1, rate: 0.95 },
  },
  lyran: {
    heygen: "41a6a6c0275c4fcea46cfb72d7dd8b35",
    browser: { prefer: ["Karen", "Serena", "Google UK English Female", "Microsoft Libby"], pitch: 1.05, rate: 1 },
    portrait: "/art/pilots/lyran.jpg",
  },
  falcon: {
    heygen: "aa9746e325ff46d482a54fe5bc87890f",
    browser: { prefer: ["Moira", "Tessa", "Google UK English Female", "Microsoft Sonia"], pitch: 0.85, rate: 0.95 },
    portrait: "/art/pilots/falcon.jpg",
  },
  garrison: {
    heygen: "9b71011176ac49ee8d0936c36566d665",
    browser: { prefer: ["Fred", "Ralph", "Microsoft Guy", "Google US English"], pitch: 0.8, rate: 1.05 },
    portrait: "/art/pilots/garrison.jpg",
  },
  galaxy: {
    heygen: "95fae2bb58b647c58ea32e6667f86b0e",
    browser: { prefer: ["Daniel", "Rishi", "Google UK English Male", "Microsoft Ryan"], pitch: 0.75, rate: 0.95 },
    portrait: "/art/pilots/galaxy.jpg",
  },
  coach: {
    heygen: "",
    browser: { prefer: ["Samantha", "Google US English", "Microsoft Jenny", "Victoria"], pitch: 1.1, rate: 0.95 },
  },
}
