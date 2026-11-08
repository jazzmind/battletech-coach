import { Suspense } from "react"
import { PilotScreen } from "@/components/pilot-screen"

export default function Page() {
  return (
    <Suspense fallback={<main className="wrap"><p>Opening the pilot page…</p></main>}>
      <PilotScreen />
    </Suspense>
  )
}
