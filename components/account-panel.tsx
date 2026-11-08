"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"

export function AccountPanel({ compact = false }: { compact?: boolean }) {
  const { data: session, isPending } = authClient.useSession()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function sendLink() {
    setBusy(true)
    setError(null)
    const result = await authClient.signIn.magicLink({
      email: email.trim(),
      callbackURL: window.location.href,
    })
    setBusy(false)
    if (result.error) {
      setError(result.error.message || "The sign-in email did not send.")
      return
    }
    setSent(true)
  }

  async function addPasskey() {
    setBusy(true)
    setError(null)
    const result = await authClient.passkey.addPasskey({ name: "This iPad" })
    setBusy(false)
    if (result.error) setError(result.error.message || "This device did not save a passkey.")
  }

  async function usePasskey() {
    setBusy(true)
    setError(null)
    const result = await authClient.signIn.passkey()
    setBusy(false)
    if (result.error) setError(result.error.message || "This device has no passkey yet.")
  }

  if (isPending) return <p className="kit">Checking sign-in.</p>
  if (session?.user) {
    return (
      <section className="account" data-testid="account">
        <p>Signed in as {session.user.email}.</p>
        <button type="button" disabled={busy} onClick={() => void addPasskey()}>
          Use this iPad next time
        </button>
        <button className="ghost" type="button" disabled={busy} onClick={() => void authClient.signOut()}>
          Sign out
        </button>
        {error ? <p className="error">{error}</p> : null}
      </section>
    )
  }
  return (
    <section className="account" data-testid="account">
      {compact ? <p>Sign in with your email to check the table.</p> : <p>Sign in if you want the camera to check the table.</p>}
      <label>
        Email
        <input
          type="email"
          value={email}
          autoComplete="email"
          data-testid="sign-in-email"
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <button type="button" disabled={busy || !email.includes("@")} onClick={() => void sendLink()}>
        Email me a link
      </button>
      <button className="ghost" type="button" disabled={busy} onClick={() => void usePasskey()}>
        Use the passkey on this device
      </button>
      {sent ? <p>Check your email. The link works once.</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  )
}
