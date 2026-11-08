"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"

export function AuthPanel({ compact = false, onSent }: { compact?: boolean; onSent?: (email: string) => void }) {
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
    onSent?.(email.trim())
  }

  async function addPasskey() {
    setBusy(true)
    setError(null)
    const result = await authClient.passkey.addPasskey({ name: "This iPad" })
    setBusy(false)
    if (result.error) setError("This device did not save a passkey.")
  }

  async function usePasskey() {
    setBusy(true)
    setError(null)
    const result = await authClient.signIn.passkey()
    setBusy(false)
    if (result.error) setError("This device has no passkey yet. Use the email link first.")
  }

  if (isPending) return <p className="kit">Checking sign-in.</p>
  if (session?.user) {
    return (
      <section className="account" data-testid="account">
        <p>Signed in as {session.user.email}.</p>
        <button type="button" disabled={busy} onClick={() => void addPasskey()}>
          Save a passkey on this device
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
      {compact ? <p>Sign in with your email to check the table.</p> : (
        <>
          <h3>Sign in or create an account</h3>
          <p>Needed for the camera check. No password: we email you a link, and a new email gets a new account.</p>
        </>
      )}
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
        Sign in with a passkey
      </button>
      {sent ? <p>Check your email. The link works once.</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  )
}

export const AccountPanel = AuthPanel
