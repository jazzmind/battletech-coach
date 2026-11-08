"use client"

import { CREDITS } from "@/lib/voice/credits"
import { AppFrame } from "./app-frame"

export function CreditsScreen() {
  return (
    <AppFrame title="Credits" lede="Who made the voices, faces and art in the missions.">
      <section className="panel credits" data-testid="credits">
        {CREDITS.map((credit) => (
          <article key={credit.what} className="credit">
            {credit.image ? <img src={credit.image} alt={credit.what} /> : null}
            <div>
              <strong>{credit.what}</strong>
              <small>{credit.who}</small>
              <p>{credit.how}</p>
            </div>
          </article>
        ))}
      </section>
    </AppFrame>
  )
}
