// Round-trip every ```json block tagged `addtrack` in the docs through the real
// CLI, asserting the derived command reproduces the shown config. The remark
// plugin (src/lib/remark-config-cli-tabs.ts) renders such a block as a
// Config/CLI tab pair, deriving the command from the JSON so the two can't
// drift; this is the CI gate that proves each derived command is actually
// runnable and faithful. A CLI-clean config (deriveAddTrackArgs) round-trips
// through `add-track`; anything else round-trips through the `add-track-json`
// fallback, which every valid track config satisfies.
//
// The same two commands are emitted from every figure's `sessionTracks`, for the
// CLI tab of its recipe dialog, so the bottom of this file runs that corpus too
// — including the fallback command's shell quoting, which is the recipes' own
// exposure (see jsonArgsAsShellSees).
//
// The comparison is semantic, not textual, and has to be: `add-track` writes
// the *legacy* adapter format, so the config it produces never matches the
// modern shorthand the docs show even when both describe the same track. A BAM
// tagged `{ "type": "BamAdapter", "uri": "..." }` comes back as
//
//   { "type": "BamAdapter",
//     "bamLocation": { "uri": "...", "locationType": "UriLocation" },
//     "index": { "location": {...}, "indexType": "BAI" } }
//
// which is why adapterUri() below looks through `*Location` slots. Don't
// "tighten" this into a deep-equal — it will fail on every block. (add-track-json
// has no such gap: it takes the config verbatim, which is the point of showing
// that tab, so roundTripJson can and does assert exact reproduction.)
//
// Load is forced to `inPlace` so no data file needs to exist: copy vs inPlace
// changes only where the file is placed, not the track's semantic identity
// (type / adapter / uri / name / assemblyNames), which is what we compare.
//
// Run: `pnpm check-config-cli` (needs products/jbrowse-cli built).
import { execFileSync, spawn } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import { join } from 'node:path'

import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { deriveAddAssemblyArgs } from '../src/lib/derive-add-assembly.ts'
import { asRecord, deriveAddTrackArgs } from '../src/lib/derive-add-track.ts'
import {
  FALLBACK_SESSION_NAME,
  defaultSessionObject,
  sessionStdin,
} from '../src/lib/derive-set-default-session.ts'
import {
  isAddassembly,
  isAddtrack,
  isSession,
} from '../src/lib/remark-config-cli-tabs.ts'
import { decodeSpecUrl } from '../src/lib/spec-recipe/decode.ts'
import { deriveCliRecipe } from '../src/lib/spec-recipe/recipe.ts'
import { docsMatching, reportProblems } from './check-utils.ts'
import { docsDir, repoRoot } from './paths.ts'
import { screenshotLiveUrls } from './screenshot-specs.ts'

import type { RawTrack } from '../src/lib/spec-recipe/configs.ts'

const cli = join(repoRoot, 'products', 'jbrowse-cli', 'dist', 'bin.js')

// Every block below shells out to that bin, so an unbuilt CLI fails all of them
// identically — its own fixtures included. That reads as a corpus-wide docs
// break (127 of them in a fresh worktree) when it means one build is missing, so
// say which it is before running anything.
if (!existsSync(cli)) {
  console.error(
    `${cli} not found — run \`pnpm build\` in products/jbrowse-cli first.`,
  )
  process.exit(1)
}

interface Block {
  file: string
  line: number
  json: string
  kind: 'track' | 'assembly' | 'session'
}

const parser = unified().use(remarkParse).use(remarkGfm)

// Every block the remark plugin would turn into a widget, selected with the
// plugin's own predicate over the same mdast it sees — so the gate can't check
// a different set than the site renders. The body stays text: invalid JSON is a
// problem to report against this file and line, not a crash.
function taggedBlocks(md: string, file: string): Block[] {
  const blocks: Block[] = []
  visit(parser.parse(md), 'code', node => {
    const kind = isAddtrack(node)
      ? 'track'
      : isAddassembly(node)
        ? 'assembly'
        : isSession(node)
          ? 'session'
          : undefined
    if (kind) {
      blocks.push({
        file,
        line: node.position?.start.line ?? 0,
        json: node.value,
        kind,
      })
    }
  })
  return blocks
}

// The main data-file uri the resulting adapter points at: an explicit `uri`, or
// the first `*Location` slot's uri.
function adapterUri(adapter: Record<string, unknown>) {
  return typeof adapter.uri === 'string'
    ? adapter.uri
    : Object.values(adapter)
        .map(v => asRecord(v).uri)
        .find(v => typeof v === 'string')
}

function basename(uri: unknown) {
  return typeof uri === 'string' ? uri.split('/').pop() : undefined
}

function diff(label: string, got: unknown, expected: unknown) {
  return got === expected ? '' : `${label} ${got} != ${expected}`
}

function firstLine(e: unknown) {
  return (e as Error).message.split('\n')[0]
}

// A minimal target config declaring the assemblies the track references, so
// add-track's assembly validation passes without any data file existing.
function targetConfig(assemblyNames: unknown) {
  const names = Array.isArray(assemblyNames) ? assemblyNames : []
  return {
    assemblies: names.map(name => ({
      name,
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ref`,
        adapter: { type: 'TwoBitAdapter', uri: `${name}.2bit` },
      },
    })),
    tracks: [],
  }
}

// V8's code cache for the CLI's own module graph, which every case below pays
// to compile from source otherwise. It is the larger half of a run that does
// almost no work — 0.51s to start the CLI cold against 0.24s warm, times the
// corpus. Nothing about what runs changes: a stale entry is recompiled, and a
// missing directory is written on the first run.
const compileCache = join(repoRoot, 'node_modules/.cache/node-compile')

// One CLI run. Every case below is one of these and they are independent of
// each other, so they go through the pool at the bottom rather than in
// sequence: the corpus is ~240 cases, each of them a node process that starts
// the CLI to do a few milliseconds of work, and serially that was the slowest
// thing in `pnpm check-docs` by a factor of four.
function runNode(args: string[], input: string | undefined) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('node', args, {
      stdio: ['pipe', 'ignore', 'pipe'],
      env: { ...process.env, NODE_COMPILE_CACHE: compileCache },
    })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(stderr.trim() || `jbrowse exited ${code}`))
      }
    })
    child.stdin.end(input ?? '')
  })
}

// Run the CLI against a throwaway config and return the config it wrote.
// `input` feeds stdin, which is how the emitted set-default-session command
// carries its session — running it any other way would check a command the
// docs don't show.
async function runCliConfig(
  target: object,
  argv: (dir: string) => string[],
  input?: string,
) {
  const dir = mkdtempSync(join(tmpdir(), 'cfgcli-'))
  try {
    const cfgPath = join(dir, 'config.json')
    writeFileSync(cfgPath, JSON.stringify(target))
    await runNode([cli, ...argv(dir), '--target', cfgPath], input)
    return JSON.parse(readFileSync(cfgPath, 'utf8')) as {
      tracks?: Record<string, unknown>[]
      assemblies?: Record<string, unknown>[]
      defaultSession?: Record<string, unknown>
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// Run the CLI against a throwaway config and return the track it added.
async function runCli(
  target: object,
  argv: (dir: string) => string[],
  trackId: unknown,
) {
  const { tracks } = await runCliConfig(target, argv)
  return tracks?.find(t => t.trackId === trackId)
}

// Run add-track for one block and return the mismatch reason, or '' on success.
async function roundTrip(
  config: Record<string, unknown>,
  args: string[],
): Promise<string> {
  try {
    // force `--load inPlace`; match on the flag rather than the literal 'copy',
    // which could equally be a track's name or id
    const argv = args.map((a, i) => (args[i - 1] === '--load' ? 'inPlace' : a))
    const track = await runCli(
      targetConfig(config.assemblyNames),
      () => argv,
      config.trackId,
    )
    const src = asRecord(config.adapter)
    const got = asRecord(track?.adapter)
    return track === undefined
      ? 'track not added'
      : [
          diff('type', track.type, config.type),
          diff('name', track.name, config.name),
          diff('adapter', got.type, src.type),
          diff('uri', basename(adapterUri(got)), basename(src.uri)),
          diff(
            'displayDefaults',
            JSON.stringify(track.displayDefaults ?? {}),
            JSON.stringify(config.displayDefaults ?? {}),
          ),
        ]
          .filter(Boolean)
          .join('; ')
  } catch (e) {
    return `add-track failed: ${firstLine(e)}`
  }
}

// The fallback path: `add-track-json` takes a track config verbatim, so this
// only has to prove the round trip reproduces it exactly rather than checking
// individual fields the way `roundTrip` does for `add-track`'s flags.
async function roundTripJson(config: Record<string, unknown>): Promise<string> {
  try {
    const track = await runCli(
      { tracks: [] },
      dir => {
        const trackPath = join(dir, 'track.json')
        writeFileSync(trackPath, JSON.stringify(config))
        return ['add-track-json', trackPath]
      },
      config.trackId,
    )
    return track === undefined
      ? 'track not added'
      : JSON.stringify(track) === JSON.stringify(config)
        ? ''
        : 'add-track-json did not reproduce the config verbatim'
  } catch (e) {
    return `add-track-json failed: ${firstLine(e)}`
  }
}

// The session path has no flags to check, so what this proves is the pair of
// things the tab exists to say: that the emitted heredoc reaches the CLI intact
// through `--session -`, and that what lands in `defaultSession` is the block's
// own session — the unwrapping is the step a reader would otherwise get wrong.
async function roundTripSession(
  config: Record<string, unknown>,
  json: string,
): Promise<string> {
  const session = defaultSessionObject(config)
  const stdin = sessionStdin(config, json)
  if (session === null || stdin === null) {
    return 'not a lone "defaultSession": leave this block untagged'
  }
  try {
    const result = await runCliConfig(
      { assemblies: [], tracks: [] },
      () => ['set-default-session', '--session', '-'],
      stdin,
    )
    // the command supplies a name when the session carries none, so that is
    // what a faithful round trip produces rather than the block verbatim
    const expected = { name: FALLBACK_SESSION_NAME, ...session }
    return JSON.stringify(result.defaultSession) === JSON.stringify(expected)
      ? ''
      : 'set-default-session did not reproduce the session'
  } catch (e) {
    return `set-default-session failed: ${firstLine(e)}`
  }
}

// Run add-assembly for one block and return the mismatch reason, or '' on
// success. Like the track path the comparison is semantic: add-assembly writes
// the legacy `*Location` slots plus the boilerplate ReferenceSequenceTrack the
// shorthand leaves implicit, so what is compared is the assembly's identity
// (name, aliases, sequence adapter type and file) and every slot the derived
// command claimed to set.
async function roundTripAssembly(
  config: Record<string, unknown>,
  args: string[],
): Promise<string> {
  try {
    // --force skips the file-existence checks, so no data file has to exist,
    // and inPlace keeps the config referencing the path as written
    const argv = args.map((a, i) => (args[i - 1] === '--load' ? 'inPlace' : a))
    const result = await runCliConfig({ assemblies: [], tracks: [] }, () => [
      ...argv,
      '--force',
    ])
    const got = result.assemblies?.find(a => a.name === config.name)
    if (got === undefined) {
      return 'assembly not added'
    }
    const src = asRecord(asRecord(config.sequence).adapter)
    const gotAdapter = asRecord(asRecord(got.sequence).adapter)
    const srcUri = nonEmptyString(config.uri) ?? nonEmptyString(src.uri)
    // slots with no dedicated flag ride in --config; each must come back as-is
    const passedThrough = Object.keys(config).filter(
      k =>
        ![
          'name',
          'uri',
          'aliases',
          'displayName',
          'refNameColors',
          'refNameAliases',
          'sequence',
        ].includes(k),
    )
    return [
      diff('name', got.name, config.name),
      diff(
        'aliases',
        JSON.stringify(got.aliases ?? []),
        JSON.stringify(config.aliases ?? []),
      ),
      diff('displayName', got.displayName, config.displayName),
      diff(
        'refNameColors',
        JSON.stringify(got.refNameColors ?? []),
        JSON.stringify(config.refNameColors ?? []),
      ),
      // an omitted adapter type is inferred by both the CLI and JBrowse, so
      // only a declared one is compared
      src.type === undefined
        ? ''
        : diff('sequence adapter', gotAdapter.type, src.type),
      diff('sequence uri', basename(adapterUri(gotAdapter)), basename(srcUri)),
      diff(
        'refNameAliases',
        basename(aliasFileUri(got.refNameAliases)),
        basename(aliasFileUri(config.refNameAliases)),
      ),
      ...passedThrough.map(k =>
        diff(k, JSON.stringify(got[k]), JSON.stringify(config[k])),
      ),
    ]
      .filter(Boolean)
      .join('; ')
  } catch (e) {
    return `add-assembly failed: ${firstLine(e)}`
  }
}

function nonEmptyString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined
}

// the aliases file, through either the uri shorthand or the adapter's location
function aliasFileUri(refNameAliases: unknown) {
  const slot = asRecord(refNameAliases)
  const adapter = asRecord(slot.adapter)
  return (
    nonEmptyString(slot.uri) ??
    nonEmptyString(adapter.uri) ??
    nonEmptyString(asRecord(adapter.location).uri)
  )
}

// Parse and round-trip one block; '' when it checks out.
async function checkBlock(json: string, kind: Block['kind']): Promise<string> {
  let config: Record<string, unknown>
  try {
    config = asRecord(JSON.parse(json))
  } catch (e) {
    return `not valid JSON: ${firstLine(e)}`
  }
  if (kind === 'session') {
    return roundTripSession(config, json)
  }
  if (kind === 'assembly') {
    const args = deriveAddAssemblyArgs(config)
    // no add-assembly-json exists, so an underivable assembly is a tagging
    // mistake rather than a fallback case, and the plugin warns on it too
    return args === null
      ? 'no add-assembly equivalent: leave this block untagged'
      : roundTripAssembly(config, args)
  }
  const args = deriveAddTrackArgs(config)
  return args === null ? roundTripJson(config) : roundTrip(config, args)
}

// Every case is `where it came from` plus the round trip that answers it. They
// are collected rather than run on the spot so the pool below can overlap the
// CLI processes; the report is still assembled in this order.
interface Case {
  where: string
  run: () => Promise<string>
}
const cases: Case[] = []

let checked = 0
// Weaker than the three predicates in taggedBlocks, which read the lang and
// meta off this same fence line.
const TAGGED_FENCE =
  /^\s*(?:```|~~~)json\b[^\n]*\b(?:addtrack|addassembly|session)\b/m

for (const { file, text } of docsMatching(docsDir, TAGGED_FENCE)) {
  for (const block of taggedBlocks(text, file)) {
    checked++
    cases.push({
      where: `  ${block.file.slice(repoRoot.length + 1)}:${block.line}`,
      run: () => checkBlock(block.json, block.kind),
    })
  }
}
// Every tagged doc block is currently CLI-clean, so the add-track-json fallback
// — and the plugin's "CLI (add-track-json)" tab with it — would otherwise ship
// with no coverage at all. These stand in for the two shapes that reach it.
const FALLBACK_FIXTURES: Record<string, unknown>[] = [
  {
    type: 'VariantTrack',
    trackId: 'fixture_multifile',
    name: 'Fixture multi-file',
    assemblyNames: ['hg19'],
    adapter: {
      type: 'BedpeAdapter',
      bed1Location: { uri: 'a.bed' },
      bed2Location: { uri: 'b.bed' },
    },
  },
  {
    type: 'FeatureTrack',
    trackId: 'fixture_displays',
    name: 'Fixture displays',
    assemblyNames: ['hg19'],
    adapter: { type: 'BedTabixAdapter', uri: 'x.bed.gz' },
    displays: [
      { type: 'LinearBasicDisplay', displayId: 'fixture-d', height: 80 },
    ],
  },
]
for (const fixture of FALLBACK_FIXTURES) {
  cases.push({
    where: `  fallback fixture (${fixture.trackId})`,
    run: async () =>
      deriveAddTrackArgs(fixture) === null
        ? roundTripJson(fixture)
        : 'expected this fixture to need the add-track-json fallback',
  })
}

// An assembly config the derivation refuses gets no CLI tab, so nothing in the
// docs exercises that branch. This fixture stands in for it: a legacy
// multi-location sequence, which add-assembly builds itself and no flag set
// reproduces.
const UNDERIVABLE_ASSEMBLY = {
  name: 'fixture_legacy',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'fixture_legacy-ReferenceSequenceTrack',
    adapter: {
      type: 'IndexedFastaAdapter',
      fastaLocation: { uri: 'g.fa' },
      faiLocation: { uri: 'g.fa.fai' },
    },
  },
}
cases.push({
  where: `  underivable assembly fixture (${UNDERIVABLE_ASSEMBLY.name})`,
  run: async () =>
    deriveAddAssemblyArgs(UNDERIVABLE_ASSEMBLY) === null
      ? ''
      : 'expected this fixture to have no add-assembly equivalent',
})

// The refusals that keep a session tab from claiming more than the command
// writes. Both shapes appear in the docs untagged, so nothing else here would
// notice if the derivation started accepting them: a whole config.json carries
// assemblies and tracks set-default-session does not write, and a block pairing
// the default session with preConfiguredSessions carries sessions it drops.
const UNDERIVABLE_SESSIONS: [string, unknown][] = [
  [
    'whole config.json',
    { assemblies: [], tracks: [], defaultSession: { name: 'S', views: [] } },
  ],
  [
    'with preConfiguredSessions',
    {
      defaultSession: { name: 'S', views: [] },
      preConfiguredSessions: [{ name: 'Other', views: [] }],
    },
  ],
]
for (const [label, config] of UNDERIVABLE_SESSIONS) {
  cases.push({
    where: `  underivable session fixture (${label})`,
    run: async () =>
      defaultSessionObject(config) === null
        ? ''
        : 'expected this fixture to have no set-default-session equivalent',
  })
}

// The same two commands, derived from a figure's `sessionTracks` for the CLI
// tab of its recipe dialog (src/lib/spec-recipe/recipe.ts). Nothing above
// reaches them: a tagged doc fence is hand-written and CLI-clean, where a
// session track is read off a live link and mostly isn't, so the recipes are
// where the add-track-json fallback actually ships. Checked once per DISTINCT
// track — the corpus is ~100 tracks over ~90 figures, and a figure reusing one
// would otherwise pay for it again.
const recipeTracks = new Map<string, RawTrack>()
for (const url of Object.values(screenshotLiveUrls)) {
  const spec = decodeSpecUrl(url)?.spec
  for (const track of (spec?.sessionTracks as RawTrack[] | undefined) ?? []) {
    recipeTracks.set(JSON.stringify(track), track)
  }
}

// A recipe's own risk, and not the fences': its command carries the whole
// config as one single-quoted shell word, and a dozen of these tracks hold a
// jexl filter with single quotes of their own. So the emitted text is run in a
// real shell, with `jbrowse` shadowed by a function that prints the argument the
// CLI would have received — what a reader pastes, checked as pasted. One shell
// for the whole corpus, since the cost here is the process, not the command.
function jsonArgsAsShellSees(commands: string): string[] | string {
  const script = `jbrowse() { printf '%s\\0' "$2"; }\n${commands}`
  try {
    return execFileSync('sh', ['-c', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).split('\0')
  } catch (e) {
    // quoting broken badly enough that the shell won't parse the script at all,
    // which is the loudest version of the bug and still has to name itself
    return `the emitted add-track-json commands don't parse in a shell: ${firstLine(e)}`
  }
}

// the tracks whose command is the verbatim-JSON fallback, taken together
// because that is also how a multi-track figure's own tab emits them
const quoted: RawTrack[] = []
for (const track of recipeTracks.values()) {
  const args = deriveAddTrackArgs(track)
  if (args === null) {
    quoted.push(track)
  } else {
    // the flag derivation, through the real CLI, exactly as a fence gets it
    cases.push({
      where: `  recipe track (${track.trackId})`,
      run: () => roundTrip(asRecord(track), args),
    })
  }
}

// One CLI process per core. The work is a child process each time, so the pool
// is bounded by cores rather than by anything this process does.
const errorLines: string[] = []
const queue = [...cases]
const reasons = new Map<Case, string>()
await Promise.all(
  Array.from({ length: Math.max(1, availableParallelism() - 1) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift()!
      reasons.set(next, await next.run())
    }
  }),
)
for (const item of cases) {
  const reason = reasons.get(item)
  if (reason) {
    errorLines.push(item.where, `    → ${reason}\n`)
  }
}
const emitted = deriveCliRecipe(quoted)
const asShellSees = emitted ? jsonArgsAsShellSees(emitted.commands) : []
if (typeof asShellSees === 'string') {
  errorLines.push('  figure recipe CLI tab', `    → ${asShellSees}\n`)
} else {
  for (const [i, track] of quoted.entries()) {
    if (asShellSees[i] !== JSON.stringify(track, null, 2)) {
      errorLines.push(
        `  recipe track (${track.trackId})`,
        `    → the shell reads a different config out of the emitted add-track-json command\n`,
      )
    }
  }
}

if (errorLines.length) {
  errorLines.unshift(
    `Found addtrack/addassembly/session blocks whose derived command doesn't round-trip:\n`,
  )
}
const fixtures = FALLBACK_FIXTURES.length + 1 + UNDERIVABLE_SESSIONS.length
reportProblems(
  errorLines,
  `All ${checked} addtrack/addassembly/session block(s) + ${fixtures} fixture(s) + ${recipeTracks.size} figure-recipe session track(s) round-trip through jbrowse add-track / add-track-json / add-assembly / set-default-session.`,
)
