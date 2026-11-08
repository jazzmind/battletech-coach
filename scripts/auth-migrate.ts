import path from "node:path"
import { pathToFileURL } from "node:url"
import { authOptions } from "../lib/auth"
import { ROOT, loadEnv } from "./heygen"

async function main() {
  loadEnv()
  const secret = process.env.BETTER_AUTH_SECRET
  const databaseUrl = process.env.DATABASE_URL
  if (!secret || !databaseUrl) throw new Error("BETTER_AUTH_SECRET and DATABASE_URL must be set in .env.local.")

  const file = pathToFileURL(path.join(ROOT, "node_modules/better-auth/dist/db/get-migration.mjs")).href
  const { getMigrations } = (await import(file)) as {
    getMigrations: (config: ReturnType<typeof authOptions>, options?: { throwOnUnsafe?: boolean }) => Promise<{
      toBeCreated: { table: string }[]
      toBeAdded: { table: string; fields: Record<string, unknown> }[]
      toBeAddedIndexes: { table: string; name: string }[]
      unsafeChanges: string[]
      schemaProblems: string[]
      runMigrations: () => Promise<void>
    }>
  }
  // Sessions and verification tokens live in Redis at runtime. The database
  // schema still needs the tables, so plan the migration without secondary storage.
  const options = authOptions(secret, databaseUrl)
  options.secondaryStorage = undefined
  const plan = await getMigrations(options, { throwOnUnsafe: true })
  if (plan.unsafeChanges.length > 0 || plan.schemaProblems.length > 0) {
    throw new Error(
      `Refusing to migrate.\nUnsafe:\n${plan.unsafeChanges.join("\n")}\nProblems:\n${plan.schemaProblems.join("\n")}`,
    )
  }

  console.log("Tables to create:")
  for (const item of plan.toBeCreated) console.log(`  create ${item.table}`)
  console.log("Columns to add:")
  for (const item of plan.toBeAdded) console.log(`  add ${item.table}: ${Object.keys(item.fields).join(", ")}`)
  console.log("Indexes to add:")
  for (const item of plan.toBeAddedIndexes) console.log(`  index ${item.table}.${item.name}`)

  await plan.runMigrations()
  console.log("Migration finished.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
