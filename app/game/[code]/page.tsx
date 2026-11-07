import { CoachScreen } from "@/components/coach-screen"

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <CoachScreen code={code.toUpperCase()} />
}
