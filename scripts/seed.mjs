// Seed the Augur calibration question bank.
// Run: node --env-file=.env.local scripts/seed.mjs
//
// Every answer here is intended to be HIGHLY confident, verifiable, and TIMELESS
// (no facts that drift year to year). A wrong key poisons the product, so the bank
// is conservative: classic calibration-style questions with unambiguous answers.
import pg from 'pg'

const SOURCE = 'augur-seed'

// b = binary true/false claim.  answer { value: boolean }
const b = (prompt, value, domain, difficulty) => ({
  kind: 'binary',
  prompt,
  answer: { value },
  domain,
  difficulty,
})
// n = numeric (user gives a 90% interval).  answer { value, unit? }
const n = (prompt, value, unit, domain, difficulty) => ({
  kind: 'numeric',
  prompt,
  answer: unit ? { value, unit } : { value },
  domain,
  difficulty,
})

const QUESTIONS = [
  // ── Science ────────────────────────────────────────────────────────────────
  b('Sound travels faster through water than through air.', true, 'science', 2),
  b('Lightning never strikes the same place twice.', false, 'science', 1),
  b('Diamond and graphite are both made entirely of carbon.', true, 'science', 2),
  b('Helium is lighter than hydrogen.', false, 'science', 2),
  b('Absolute zero is approximately −273 degrees Celsius.', true, 'science', 2),
  b('Glass is actually a slow-moving liquid at room temperature.', false, 'science', 3),
  b('The Great Wall of China is visible to the naked eye from the Moon.', false, 'science', 1),
  b('Mercury is the closest planet to the Sun.', true, 'science', 1),

  // ── History ────────────────────────────────────────────────────────────────
  b('The Western Roman Empire fell before the year 600 AD.', true, 'history', 2),
  b('World War II ended in 1945.', true, 'history', 1),
  b('Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid of Giza.', true, 'history', 3),
  b('The printing press was in use in Europe before Columbus reached the Americas.', true, 'history', 2),
  b('Oxford University was teaching students before the Aztec Empire was founded.', true, 'history', 3),
  b('Napoleon Bonaparte was notably shorter than the average Frenchman of his era.', false, 'history', 3),

  // ── Geography ────────────────────────────────────────────────────────────────
  b('Africa is the largest continent by land area.', false, 'geography', 1),
  b('Russia is the largest country in the world by area.', true, 'geography', 1),
  b('Australia is both a country and a continent.', true, 'geography', 1),
  b('Antarctica is the largest desert on Earth.', true, 'geography', 3),
  b('Measured from base to peak, Mount Everest is the tallest mountain on Earth.', false, 'geography', 3),
  b('The city of Istanbul lies on two continents.', true, 'geography', 2),
  b('The Equator passes through Brazil.', true, 'geography', 2),
  b('Canada has the longest coastline of any country in the world.', true, 'geography', 3),

  // ── The body ─────────────────────────────────────────────────────────────────
  b('The adult human body has more than 250 bones.', false, 'the body', 2),
  b('The human liver can regenerate lost tissue.', true, 'the body', 2),
  b('Arteries always carry oxygen-rich blood.', false, 'the body', 3),
  b('A full set of adult teeth, including wisdom teeth, is 32 teeth.', true, 'the body', 2),
  b('The skin is the largest organ of the human body.', true, 'the body', 1),
  b('The fastest nerve signals in the human body travel faster than 100 km/h.', true, 'the body', 3),

  // ── Tech ─────────────────────────────────────────────────────────────────────
  b('A byte consists of 8 bits.', true, 'tech', 1),
  b('"HTTP" stands for HyperText Transfer Protocol.', true, 'tech', 2),
  b('RAM retains its data after the computer loses power.', false, 'tech', 2),
  b('The ENIAC, the first general-purpose electronic computer, was built before 1950.', true, 'tech', 3),
  b("Moore's Law describes transistor counts on a chip roughly doubling about every two years.", true, 'tech', 2),
  b('The "G" in "5G" stands for gigabyte.', false, 'tech', 2),
  b('An IPv4 address is written as four numbers separated by dots.', true, 'tech', 2),

  // ── Numeric: science ─────────────────────────────────────────────────────────
  n('At what temperature, in degrees Celsius, does water boil at sea level?', 100, '°C', 'science', 1),
  n('Roughly how many minutes does light from the Sun take to reach Earth?', 8.3, 'minutes', 'science', 2),
  n('What is the speed of light in a vacuum, in kilometers per second?', 299792, 'km/s', 'science', 2),
  n('How many chemical elements are officially named on the periodic table?', 118, 'elements', 'science', 2),
  n('How many planets are in our solar system?', 8, 'planets', 'science', 1),
  n('At what temperature, in degrees Fahrenheit, does water freeze?', 32, '°F', 'science', 2),
  n('How many hearts does an octopus have?', 3, 'hearts', 'science', 2),
  n('How many bones are in a giraffe’s neck?', 7, 'bones', 'science', 3),

  // ── Numeric: the body ─────────────────────────────────────────────────────────
  n('How many chromosomes does a typical human cell contain?', 46, 'chromosomes', 'the body', 2),
  n('About how many liters of blood are in the average adult human body?', 5, 'liters', 'the body', 2),

  // ── Numeric: geography ────────────────────────────────────────────────────────
  n('How tall is the Eiffel Tower, to the tip, in meters?', 330, 'm', 'geography', 2),
  n('How many time zones does the contiguous United States (the lower 48 states) span?', 4, 'time zones', 'geography', 2),
  n('How deep is the deepest point of the ocean (the Mariana Trench), in meters?', 10935, 'm', 'geography', 3),
  n('How many countries are on the continent of Africa?', 54, 'countries', 'geography', 3),

  // ── Numeric: history ──────────────────────────────────────────────────────────
  n('In what year did the first humans land on the Moon?', 1969, null, 'history', 1),
  n('The Great Pyramid of Giza was originally about how many meters tall?', 146, 'm', 'history', 3),

  // ── Numeric: everyday estimation ──────────────────────────────────────────────
  n('How many keys are on a standard full-size piano?', 88, 'keys', 'everyday estimation', 2),
  n('How many players from one team are on the field in a standard soccer match?', 11, 'players', 'everyday estimation', 1),
  n('What do the interior angles of any triangle sum to, in degrees?', 180, 'degrees', 'everyday estimation', 1),
  n('How long is a marathon, in kilometers?', 42.2, 'km', 'everyday estimation', 2),
  n('How many strings does a standard violin have?', 4, 'strings', 'everyday estimation', 1),
]

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
})
await client.connect()

// Idempotent: clear our own seeded rows, then re-insert.
await client.query(`delete from augur.questions where source = $1`, [SOURCE])

let count = 0
for (const item of QUESTIONS) {
  await client.query(
    `insert into augur.questions (kind, prompt, answer, domain, difficulty, source)
     values ($1,$2,$3,$4,$5,$6)`,
    [item.kind, item.prompt, JSON.stringify(item.answer), item.domain, item.difficulty, SOURCE],
  )
  count++
}

const summary = await client.query(
  `select kind, count(*)::int as c from augur.questions where source = $1 group by kind order by kind`,
  [SOURCE],
)
console.log('seeded', count, 'questions:', summary.rows)
await client.end()
console.log('done')
