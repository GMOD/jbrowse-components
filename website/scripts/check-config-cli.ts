// Round-trip every ```json block tagged `addtrack` in the docs through the real
// CLI, asserting the derived command reproduces the shown config. The remark
// plugin (src/lib/remark-config-cli-tabs.ts) renders such a block as a
// Config/CLI tab pair, deriving the command from the JSON so the two can't
// drift; this is the CI gate that proves each derived command is actually
// runnable and faithful. A CLI-clean config (deriveAddTrackArgs) round-trips
// through `add-track`; anything else round-trips through the `add-track-json`
// fallback, which every valid track config satisfies.
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
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { asRecord, deriveAddTrackArgs } from '../src/lib/derive-add-track.ts'
import { isAddtrack } from '../src/lib/remark-config-cli-tabs.ts'
import { reportProblems, walkFiles } from './check-utils.ts'

const root = join(import.meta.dirname, '..', '..')
const docsDir = join(import.meta.dirname, '..', 'docs')
const cli = join(root, 'products', 'jbrowse-cli', 'dist', 'bin.js')

interface Block {
  file: string
  line: number
  json: string
}

const parser = unified().use(remarkParse).use(remarkGfm)

// Every block the remark plugin would turn into a widget, selected with the
// plugin's own predicate over the same mdast it sees — so the gate can't check
// a different set than the site renders. The body stays text: invalid JSON is a
// problem to report against this file and line, not a crash.
function addtrackBlocks(md: string, file: string): Block[] {
  const blocks: Block[] = []
  visit(parser.parse(md), 'code', node => {
    if (isAddtrack(node)) {
      blocks.push({
        file,
        line: node.position?.start.line ?? 0,
        json: node.value,
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

// Run the CLI against a throwaway config and return the track it added.
function runCli(
  target: object,
  argv: (dir: string) => string[],
  trackId: unknown,
) {
  const dir = mkdtempSync(join(tmpdir(), 'cfgcli-'))
  try {
    const cfgPath = join(dir, 'config.json')
    writeFileSync(cfgPath, JSON.stringify(target))
    execFileSync('node', [cli, ...argv(dir), '--target', cfgPath], {
      stdio: 'pipe',
    })
    const result = JSON.parse(readFileSync(cfgPath, 'utf8')) as {
      tracks: Record<string, unknown>[]
    }
    return result.tracks.find(t => t.trackId === trackId)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// Run add-track for one block and return the mismatch reason, or '' on success.
function roundTrip(config: Record<string, unknown>, args: string[]): string {
  try {
    // force `--load inPlace`; match on the flag rather than the literal 'copy',
    // which could equally be a track's name or id
    const argv = args.map((a, i) => (args[i - 1] === '--load' ? 'inPlace' : a))
    const track = runCli(
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
function roundTripJson(config: Record<string, unknown>): string {
  try {
    const track = runCli(
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

// Parse and round-trip one block; '' when it checks out.
function checkBlock(json: string): string {
  let config: Record<string, unknown>
  try {
    config = asRecord(JSON.parse(json))
  } catch (e) {
    return `not valid JSON: ${firstLine(e)}`
  }
  const args = deriveAddTrackArgs(config)
  return args === null ? roundTripJson(config) : roundTrip(config, args)
}

const errorLines: string[] = []
let checked = 0
for (const file of walkFiles(docsDir, n => n.endsWith('.md'))) {
  for (const block of addtrackBlocks(readFileSync(file, 'utf8'), file)) {
    checked++
    const reason = checkBlock(block.json)
    if (reason) {
      errorLines.push(
        `  ${block.file.slice(root.length + 1)}:${block.line}`,
        `    → ${reason}\n`,
      )
    }
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
  const reason =
    deriveAddTrackArgs(fixture) === null
      ? roundTripJson(fixture)
      : 'expected this fixture to need the add-track-json fallback'
  if (reason) {
    errorLines.push(
      `  fallback fixture (${fixture.trackId})`,
      `    → ${reason}\n`,
    )
  }
}

if (errorLines.length) {
  errorLines.unshift(
    `Found addtrack blocks whose derived command doesn't round-trip:\n`,
  )
}
reportProblems(
  errorLines,
  `All ${checked} addtrack block(s) + ${FALLBACK_FIXTURES.length} fallback fixture(s) round-trip through jbrowse add-track / add-track-json.`,
)
