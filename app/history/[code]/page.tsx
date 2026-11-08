import { RecapScreen } from "@/components/recap-screen"

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <RecapScreen code={code.toUpperCase()} />
}
