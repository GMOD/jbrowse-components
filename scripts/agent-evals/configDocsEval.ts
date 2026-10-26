// Can an agent write a color or facet config from the docs alone? Each task
// runs `claude -p` in a sandbox holding a copy of website/docs and the
// published JSON Schema, with file tools only: no shell, no web, no
// `jbrowse validate`. The agent writes track.json; the grader runs
// `jbrowse validate` over it inside a volvox config, then checks what the
// task asked for. A run scores the docs, not the validator.
//
// Usage: node scripts/agent-evals/configDocsEval.ts [--model m] [--runs N]
//        [--filter name] [--out dir] [--source dir] [--self-check]
// --source reads docs and schema from another tree, such as a `git archive`
// of the baseline commit, so the worktree can change while a run is going.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)
const args = process.argv.slice(2)
function flag(name: string, fallback: string) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : (args[i + 1] ?? fallback)
}
const model = flag('model', 'sonnet')
const filter = flag('filter', '')
const runs = Number(flag('runs', '1'))
const source = path.resolve(flag('source', repoRoot))
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim()
const outDir = path.resolve(
  flag(
    'out',
    path.join(
      os.homedir(),
      'agent-evals',
      `${new Date().toISOString().replaceAll(':', '-')}-${commit}-${model}-config-docs`,
    ),
  ),
)

type Json = Record<string, unknown>

interface Task {
  name: string
  prompt: string
  solution: Json
  check: (track: Json) => string[]
}

const ALIGNMENTS = `an AlignmentsTrack with trackId "reads", name "Reads", on assembly "volvox", reading volvox-sorted.bam with its .bai index, whose LinearAlignmentsDisplay`
const BED = `a FeatureTrack with trackId "peaks", name "Peaks", on assembly "volvox", reading volvox-bed12.bed.gz with its .tbi index, whose LinearBasicDisplay`

const lower = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : v)
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a, (_k, v: unknown) => lower(v)) ===
  JSON.stringify(b, (_k, v: unknown) => lower(v))
const asStrings = (v: unknown) => (Array.isArray(v) ? v.map(x => String(x)) : v)
const asNumbers = (v: unknown) => (Array.isArray(v) ? v.map(x => Number(x)) : v)

// The display's settings, whether written as a displays entry or under
// displayDefaults; a displays entry wins member by member.
function display(track: Json, type: string) {
  const entries = Array.isArray(track.displays)
    ? (track.displays as Json[])
    : []
  const own = entries.find(d => d.type === type) ?? {}
  const defaults = (track.displayDefaults ?? {}) as Json
  return { ...defaults, ...own }
}

// A bare string is the field (`encoding.color: 'strand'`).
function color(track: Json, type: string) {
  const encoding = (display(track, type).encoding ?? {}) as Json
  const c = encoding.color
  return (typeof c === 'string' ? { field: c } : (c ?? {})) as Json
}

function expect(problems: string[], ok: boolean, what: string) {
  if (!ok) {
    problems.push(what)
  }
}

const tasks: Task[] = [
  {
    name: 'hp-tag',
    prompt: `Write ${ALIGNMENTS} colors each read by its HP (haplotype) SAM tag: HP 1 in #d95f02 labelled "Maternal" in the key, HP 2 in #1b9e77 labelled "Paternal", and reads carrying any other HP value in #999999.`,
    solution: {
      type: 'AlignmentsTrack',
      trackId: 'reads',
      name: 'Reads',
      assemblyNames: ['volvox'],
      uri: 'volvox-sorted.bam',
      displays: [
        {
          type: 'LinearAlignmentsDisplay',
          encoding: {
            color: {
              field: 'tags.HP',
              scale: {
                domain: ['1', '2'],
                range: ['#d95f02', '#1b9e77'],
                names: ['Maternal', 'Paternal'],
                unknown: '#999999',
              },
            },
          },
        },
      ],
    },
    check: track => {
      const c = color(track, 'LinearAlignmentsDisplay')
      const s = (c.scale ?? {}) as Json
      const p: string[] = []
      expect(p, c.field === 'tags.HP', `field ${JSON.stringify(c.field)}`)
      expect(p, same(asStrings(s.domain), ['1', '2']), 'domain')
      expect(p, same(s.range, ['#d95f02', '#1b9e77']), 'range')
      expect(p, same(s.names, ['Maternal', 'Paternal']), 'names')
      expect(p, same(s.unknown, '#999999'), 'unknown')
      return p
    },
  },
  {
    name: 'pair-orientation',
    prompt: `Write ${ALIGNMENTS} colors reads by their pair orientation, with RR-oriented pairs in #d95f02 and every other orientation keeping JBrowse's default color.`,
    solution: {
      type: 'AlignmentsTrack',
      trackId: 'reads',
      name: 'Reads',
      assemblyNames: ['volvox'],
      uri: 'volvox-sorted.bam',
      displays: [
        {
          type: 'LinearAlignmentsDisplay',
          encoding: {
            color: {
              field: 'pairOrientation',
              scale: { domain: ['RR'], range: ['#d95f02'] },
            },
          },
        },
      ],
    },
    check: track => {
      const c = color(track, 'LinearAlignmentsDisplay')
      const s = (c.scale ?? {}) as Json
      const p: string[] = []
      expect(
        p,
        c.field === 'pairOrientation',
        `field ${JSON.stringify(c.field)}`,
      )
      expect(p, same(s.domain, ['RR']), 'domain')
      expect(p, same(s.range, ['#d95f02']), 'range')
      return p
    },
  },
  {
    name: 'mapq-cuts',
    prompt: `Write ${ALIGNMENTS} colors reads by mapping quality in three bins: below 20 in #fee0d2, 20 up to 40 in #fc9272, and 40 or more in #de2d26.`,
    solution: {
      type: 'AlignmentsTrack',
      trackId: 'reads',
      name: 'Reads',
      assemblyNames: ['volvox'],
      uri: 'volvox-sorted.bam',
      displays: [
        {
          type: 'LinearAlignmentsDisplay',
          encoding: {
            color: {
              field: 'mapq',
              scale: {
                type: 'threshold',
                domain: [20, 40],
                range: ['#fee0d2', '#fc9272', '#de2d26'],
              },
            },
          },
        },
      ],
    },
    check: track => {
      const c = color(track, 'LinearAlignmentsDisplay')
      const s = (c.scale ?? {}) as Json
      const p: string[] = []
      expect(p, c.field === 'mapq', `field ${JSON.stringify(c.field)}`)
      expect(
        p,
        s.type === undefined || s.type === 'threshold',
        `type ${JSON.stringify(s.type)}`,
      )
      expect(p, same(asNumbers(s.domain), [20, 40]), 'domain')
      expect(p, same(s.range, ['#fee0d2', '#fc9272', '#de2d26']), 'range')
      return p
    },
  },
  {
    name: 'nm-log',
    prompt: `Write ${ALIGNMENTS} colors reads by their NM tag along a color ramp on a log scale. If a log scale is not available for reads, use the closest supported scale instead.`,
    solution: {
      type: 'AlignmentsTrack',
      trackId: 'reads',
      name: 'Reads',
      assemblyNames: ['volvox'],
      uri: 'volvox-sorted.bam',
      displays: [
        {
          type: 'LinearAlignmentsDisplay',
          encoding: { color: { field: 'tags.NM', scale: { type: 'linear' } } },
        },
      ],
    },
    check: track => {
      const c = color(track, 'LinearAlignmentsDisplay')
      const s = (c.scale ?? {}) as Json
      const p: string[] = []
      expect(p, c.field === 'tags.NM', `field ${JSON.stringify(c.field)}`)
      expect(p, s.type === 'linear', `type ${JSON.stringify(s.type)}`)
      return p
    },
  },
  {
    name: 'bed-threshold',
    prompt: `Write ${BED} colors each feature by its score: below 500 in #c6dbef, 500 up to 900 in #6baed6, and 900 or more in #08519c.`,
    solution: {
      type: 'FeatureTrack',
      trackId: 'peaks',
      name: 'Peaks',
      assemblyNames: ['volvox'],
      uri: 'volvox-bed12.bed.gz',
      displays: [
        {
          type: 'LinearBasicDisplay',
          encoding: {
            color: {
              field: 'score',
              scale: {
                type: 'threshold',
                domain: [500, 900],
                range: ['#c6dbef', '#6baed6', '#08519c'],
              },
            },
          },
        },
      ],
    },
    check: track => {
      const c = color(track, 'LinearBasicDisplay')
      const s = (c.scale ?? {}) as Json
      const p: string[] = []
      expect(p, c.field === 'score', `field ${JSON.stringify(c.field)}`)
      expect(p, s.type === 'threshold', `type ${JSON.stringify(s.type)}`)
      expect(p, same(asNumbers(s.domain), [500, 900]), 'domain')
      expect(p, same(s.range, ['#c6dbef', '#6baed6', '#08519c']), 'range')
      return p
    },
  },
  {
    name: 'bed-ramp',
    prompt: `Write ${BED} colors each feature by its score along the viridis color ramp, fixed to run from 0 to 1000 whatever the loaded scores are.`,
    solution: {
      type: 'FeatureTrack',
      trackId: 'peaks',
      name: 'Peaks',
      assemblyNames: ['volvox'],
      uri: 'volvox-bed12.bed.gz',
      displays: [
        {
          type: 'LinearBasicDisplay',
          encoding: {
            color: {
              field: 'score',
              scale: { scheme: 'viridis', domainMin: 0, domainMax: 1000 },
            },
          },
        },
      ],
    },
    check: track => {
      const c = color(track, 'LinearBasicDisplay')
      const s = (c.scale ?? {}) as Json
      const p: string[] = []
      expect(p, c.field === 'score', `field ${JSON.stringify(c.field)}`)
      expect(
        p,
        s.type === undefined || s.type === 'linear',
        `type ${JSON.stringify(s.type)}`,
      )
      expect(p, s.scheme === 'viridis', 'scheme')
      expect(p, s.domainMin === 0 && s.domainMax === 1000, 'domainMin/Max')
      return p
    },
  },
  {
    name: 'facet-hp',
    prompt: `Write ${ALIGNMENTS} splits the reads into one section per HP (haplotype) SAM tag value, and colors reads by strand.`,
    solution: {
      type: 'AlignmentsTrack',
      trackId: 'reads',
      name: 'Reads',
      assemblyNames: ['volvox'],
      uri: 'volvox-sorted.bam',
      displays: [
        {
          type: 'LinearAlignmentsDisplay',
          facet: 'tags.HP',
          encoding: { color: 'strand' },
        },
      ],
    },
    check: track => {
      const d = display(track, 'LinearAlignmentsDisplay')
      const f = d.facet
      const field = typeof f === 'string' ? f : (f as Json | undefined)?.field
      const c = color(track, 'LinearAlignmentsDisplay')
      const p: string[] = []
      expect(p, field === 'tags.HP', `facet ${JSON.stringify(f)}`)
      expect(p, c.field === 'strand', `field ${JSON.stringify(c.field)}`)
      return p
    },
  },
]

const SYSTEM = `You are configuring JBrowse 2, a genome browser. Its documentation is in ./docs (the generated config reference is ./docs/config, the guides ./docs/config_guides) and its JSON Schema is ./schema/config.json. Use only these files. Write the one track configuration object the task asks for, as JSON, to ./track.json: the track object itself, not a whole config.json. Do not ask questions; when done, reply with one line.`

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-docs-eval-'))
  fs.cpSync(path.join(source, 'website/docs'), path.join(dir, 'docs'), {
    recursive: true,
    filter: src => !/\.(png|jpe?g|gif|svg|webp|mp4|webm)$/i.test(src),
  })
  fs.mkdirSync(path.join(dir, 'schema'))
  fs.copyFileSync(
    path.join(source, 'website/static/schema/v5/config.json'),
    path.join(dir, 'schema/config.json'),
  )
  return dir
}

interface ResultEvent {
  type: string
  api_error?: string
  num_turns?: number
  total_cost_usd?: number
  duration_ms?: number
  result?: string
}

function claude(prompt: string, cwd: string) {
  const events: ResultEvent[] = []
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !k.startsWith('CLAUDE') || k === 'CLAUDE_CONFIG_DIR',
    ),
  )
  const child = spawn(
    'claude',
    [
      '-p',
      prompt,
      '--model',
      model,
      '--output-format',
      'stream-json',
      '--verbose',
      '--tools',
      'Read,Grep,Glob,Write',
      '--allowedTools',
      'Read,Grep,Glob,Write',
      '--setting-sources',
      'project',
      '--strict-mcp-config',
      '--append-system-prompt',
      SYSTEM,
      '--max-turns',
      '40',
    ],
    { cwd, env, stdio: ['ignore', 'pipe', 'inherit'] },
  )
  readline.createInterface({ input: child.stdout }).on('line', line => {
    try {
      events.push(JSON.parse(line) as ResultEvent)
    } catch {
      // not an event line
    }
  })
  return new Promise<ResultEvent[]>(resolve => {
    child.on('close', () => {
      resolve(events)
    })
  })
}

function validate(track: Json, dir: string) {
  const file = path.join(dir, 'graded-config.json')
  fs.writeFileSync(
    file,
    JSON.stringify({
      assemblies: [{ name: 'volvox', uri: 'volvox.fa' }],
      tracks: [track],
    }),
  )
  let out: string
  try {
    out = execFileSync(
      'node',
      [
        path.join(repoRoot, 'products/jbrowse-cli/src/bin.ts'),
        'validate',
        file,
        '--json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
  } catch (e) {
    out = (e as { stdout: string }).stdout
  }
  const report = JSON.parse(out) as {
    problems: { level: string; where: string; message: string }[]
  }
  return report.problems
    .filter(p => p.level === 'error')
    .map(p => `${p.where}: ${p.message}`)
}

const selected = tasks.filter(t => !filter || t.name.includes(filter))

// Each grader passes its solution and fails a track that sets nothing.
if (args.includes('--self-check')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-docs-check-'))
  let bad = 0
  for (const task of selected) {
    const solved = [
      ...task.check(task.solution),
      ...validate(task.solution, dir),
    ]
    const unsolved = task.check({ ...task.solution, displays: [] })
    const ok = solved.length === 0 && unsolved.length > 0
    bad += ok ? 0 : 1
    console.log(`${ok ? 'ok ' : 'BAD'} ${task.name}`, solved.join('; '))
  }
  fs.rmSync(dir, { recursive: true, force: true })
  process.exit(bad ? 1 : 0)
}

fs.mkdirSync(outDir, { recursive: true })
const records = []
let stopped: string | undefined
scoring: for (const task of selected) {
  for (let run = 1; run <= runs; run++) {
    const dir = sandbox()
    const events = await claude(task.prompt, dir)
    const result = events.find(ev => ev.type === 'result')
    const apiError = events.find(ev => ev.api_error)?.api_error
    if (apiError) {
      stopped = `${task.name}#${run}: ${apiError}`
      console.log(`STOP ${stopped}, not scored`)
      fs.rmSync(dir, { recursive: true, force: true })
      break scoring
    }
    const trackFile = path.join(dir, 'track.json')
    let track: Json | undefined
    let problems: string[] = []
    let validateErrors: string[] = []
    try {
      track = JSON.parse(fs.readFileSync(trackFile, 'utf8')) as Json
      validateErrors = validate(track, dir)
      problems = task.check(track)
    } catch (e) {
      problems = [`no readable track.json: ${String(e)}`]
    }
    const record = {
      task: task.name,
      run,
      pass: problems.length === 0 && validateErrors.length === 0,
      problems,
      validateErrors,
      turns: result?.num_turns ?? 0,
      seconds: Math.round((result?.duration_ms ?? 0) / 1000),
      usd: Number((result?.total_cost_usd ?? 0).toFixed(3)),
      answer: result?.result ?? '',
      track,
    }
    records.push(record)
    fs.writeFileSync(
      path.join(outDir, `${task.name}-${run}.json`),
      JSON.stringify({ record, events }, null, 2),
    )
    console.log(
      `${record.pass ? 'PASS' : 'FAIL'} ${task.name}#${run} turns=${record.turns} $${record.usd}`,
      [...problems, ...validateErrors].join('; '),
    )
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
const summary = {
  commit,
  model,
  client: execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim(),
  passed: records.filter(r => r.pass).length,
  total: records.length,
  stopped,
  usd: Number(records.reduce((a, r) => a + r.usd, 0).toFixed(3)),
  turns: records.reduce((a, r) => a + r.turns, 0),
  records: records.map(({ track: _track, ...r }) => r),
}
fs.writeFileSync(
  path.join(outDir, 'summary.json'),
  JSON.stringify(summary, null, 2),
)
console.log(
  `${summary.passed}/${summary.total} passed, $${summary.usd} -> ${outDir}`,
)
