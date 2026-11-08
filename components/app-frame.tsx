"use client"

import type { ReactNode } from "react"
import { AppNav } from "./app-nav"
import { Mark } from "./mark"

export function AppFrame({
  title,
  lede,
  nav = true,
  children,
}: {
  title: string
  lede?: string
  nav?: boolean
  children: ReactNode
}) {
  return (
    <div className={`app-frame${nav ? "" : " bare"}`}>
      {nav ? <AppNav /> : null}
      <main className="wrap">
        <header className="top">
          <div className="brand">
            <Mark />
            <div>
              <h1>{title}</h1>
              {lede ? <p>{lede}</p> : null}
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}
