import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { CATALOG, SCENARIOS, speak } from "./scenarios"
import { spokenText, toText } from "./script"
import { PICKUP_ENDING, PICKUP_STORY } from "../scenario-gen/scenario"
import { MANIFEST } from "../voice/manifest"
import { briefingLines, everyLine, toVoice } from "../voice/lines"

const prose = JSON.parse(readFileSync(path.join(__dirname, "fixtures/prose.json"), "utf8")) as Record<
  string,
  { story: string; ending: Record<string, string> }
>

const ALL = [...CATALOG, { ...SCENARIOS[0], id: "pickup", story: PICKUP_STORY, ending: PICKUP_ENDING }]

describe("scenario scripts", () => {
  it("shows the same prose as before the scripts were split into lines", () => {
    for (const scenario of SCENARIOS) {
      const before = prose[scenario.id]
      assert.ok(before, `${scenario.id} is in the fixture`)
      assert.equal(toText(scenario.story), before.story, `${scenario.id} story`)
      for (const outcome of ["innerSphere", "clan", "draw"] as const) {
        assert.equal(toText(scenario.ending[outcome]), before.ending[outcome], `${scenario.id} ${outcome} ending`)
      }
    }
  })

  it("still reads a story saved as one string", () => {
    assert.equal(toText("Old save."), "Old save.")
  })

  it("never puts a name slot, a quote mark, or an awkward callsign in a recording", () => {
    for (const { spoken, line } of everyLine(ALL)) {
      assert.doesNotMatch(spoken, /[{}"]/, `${line.who}: ${spoken}`)
      assert.doesNotMatch(spoken, /, the (Lieutenant|Star Commander)/, `${line.who}: ${spoken}`)
      assert.doesNotMatch(spoken, /\b(The|the) (Lieutenant|Star Commander)\. /, `${line.who}: ${spoken}`)
    }
  })

  it("gives every story a narrator and at least one radio voice", () => {
    for (const scenario of CATALOG) {
      const voices = new Set(scenario.story.map((line) => line.who))
      assert.ok(voices.has("narrator"), scenario.id)
      assert.ok(voices.size > 1, scenario.id)
    }
  })

  it("speaks the real names in the browser and callsigns in recordings", () => {
    const first = SCENARIOS[0]
    const names = { innerSphere: "Sam", clan: "Wes" }
    const lines = toVoice(briefingLines(first, "innerSphere"), names)
    const falcon = lines.find((line) => line.who === "falcon")
    assert.ok(falcon)
    assert.match(falcon.say, /I am Star Commander Wes of Clan Jade Falcon/)
    const spoken = spokenText(first.story[1])
    assert.equal(spoken, "I am the Star Commander of Clan Jade Falcon. What warrior defends this world? Meet me, one against one.")
    assert.ok(lines.every((line) => !line.say.includes('"')))
    assert.equal(speak("{is}", "Sam", "Wes"), "Sam")
  })

  it("points every recording and clip at a file or URL that exists", () => {
    for (const [key, recording] of Object.entries(MANIFEST.lines)) {
      assert.ok(existsSync(path.join(__dirname, "../../public", recording.file)), `${key} ${recording.file}`)
    }
    for (const [id, clip] of Object.entries(MANIFEST.clips)) {
      assert.match(clip.url, /^https:\/\//, id)
      assert.ok(clip.captions.length > 0, id)
    }
  })
})
