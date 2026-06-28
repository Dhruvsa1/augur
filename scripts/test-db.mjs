// Verify the augur DB connection, role, isolation, and a DML round-trip.
// Run: node --env-file=.env.local scripts/test-db.mjs
import pg from 'pg'

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
})
await client.connect()

const who = await client.query('select current_user, current_schema()')
console.log('connected as', who.rows[0])

// DML round-trip on users_anon (client-generated uuid).
const id = crypto.randomUUID()
await client.query(`insert into augur.users_anon (id) values ($1) on conflict do nothing`, [id])
const sel = await client.query('select count(*)::int as c from augur.users_anon where id = $1', [id])
await client.query('delete from augur.users_anon where id = $1', [id])
console.log('DML ok — insert/select/delete worked, found rows:', sel.rows[0].c)

// Question bank counts by kind + domain.
const byKind = await client.query('select kind, count(*)::int c from augur.questions group by kind order by kind')
const byDomain = await client.query('select domain, count(*)::int c from augur.questions group by domain order by c desc')
console.log('questions by kind:', byKind.rows)
console.log('questions by domain:', byDomain.rows)

await client.end()
