"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/learn", label: "Learn" },
  { href: "/join", label: "Join" },
  { href: "/create", label: "Create" },
  { href: "/history", label: "History" },
  { href: "/pilot", label: "Pilot" },
]

export function AppNav() {
  const pathname = usePathname()
  return (
    <nav className="app-nav" aria-label="Main">
      {LINKS.map((link) => {
        const current = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined}>
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
