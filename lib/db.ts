import { Pool } from 'pg'

// Serverless-friendly singleton pool. Connects as the schema-scoped `augur_app`
// role through the Supabase transaction pooler (see .env.local). The role can ONLY
// touch the `augur` schema — sibling apps' data is unreachable.
const g = globalThis as unknown as { _augurPool?: Pool }

export function pool(): Pool {
  if (!g._augurPool) {
    g._augurPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 20_000,
    })
  }
  return g._augurPool
}

export async function q<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await pool().query(text, params)
      return res.rows as T[]
    } catch (e) {
      lastErr = e
      const msg = String((e as Error)?.message ?? '')
      const transient =
        /timeout|ETIMEDOUT|ECONNRESET|Connection terminated|terminating connection|connect/i.test(
          msg,
        )
      if (attempt === 0 && transient) {
        await new Promise((r) => setTimeout(r, 400))
        continue
      }
      throw e
    }
  }
  throw lastErr
}

export async function q1<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await q<T>(text, params)
  return rows[0] ?? null
}
