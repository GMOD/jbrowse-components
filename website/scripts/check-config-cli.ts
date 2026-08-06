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

import { deriveAddAssemblyArgs } from '../src/lib/derive-add-assembly.ts'
import { asRecord, deriveAddTrackArgs } from '../src/lib/derive-add-track.ts'
import { isAddassembly, isAddtrack } from '../src/lib/remark-config-cli-tabs.ts'
import { reportProblems, walkFiles } from './check-utils.ts'
import { docsDir, repoRoot } from './paths.ts'

const cli = join(repoRoot, 'products', 'jbrowse-cli', 'dist', 'bin.js')

interface Block {
  file: string
  line: number
  json: string
  kind: 'track' | 'assembly'
}

const parser = unified().use(remarkParse).use(remarkGfm)

// Every block the remark plugin would turn into a widget, selected with the
// plugin's own predicate over the same mdast it sees — so the gate can't check
// a different set than the site renders. The body stays text: invalid JSON is a
// problem to report against this file and line, not a crash.
function taggedBlocks(md: string, file: string): Block[] {
  const blocks: Block[] = []
  visit(parser.parse(md), 'code', node => {
    const assembly = isAddassembly(node)
    if (isAddtrack(node) || assembly) {
      blocks.push({
        file,
        line: node.position?.start.line ?? 0,
        json: node.value,
        kind: assembly ? 'assembly' : 'track',
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

// Run the CLI against a throwaway config and return the config it wrote.
function runCliConfig(target: object, argv: (dir: string) => string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'cfgcli-'))
  try {
    const cfgPath = join(dir, 'config.json')
    writeFileSync(cfgPath, JSON.stringify(target))
    execFileSync('node', [cli, ...argv(dir), '--target', cfgPath], {
      stdio: 'pipe',
    })
    return JSON.parse(readFileSync(cfgPath, 'utf8')) as {
      tracks?: Record<string, unknown>[]
      assemblies?: Record<string, unknown>[]
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// Run the CLI against a throwaway config and return the track it added.
function runCli(
  target: object,
  argv: (dir: string) => string[],
  trackId: unknown,
) {
  return runCliConfig(target, argv).tracks?.find(t => t.trackId === trackId)
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

// Run add-assembly for one block and return the mismatch reason, or '' on
// success. Like the track path the comparison is semantic: add-assembly writes
// the legacy `*Location` slots plus the boilerplate ReferenceSequenceTrack the
// shorthand leaves implicit, so what is compared is the assembly's identity
// (name, aliases, sequence adapter type and file) and every slot the derived
// command claimed to set.
function roundTripAssembly(
  config: Record<string, unknown>,
  args: string[],
): string {
  try {
    // --force skips the file-existence checks, so no data file has to exist,
    // and inPlace keeps the config referencing the path as written
    const argv = args.map((a, i) => (args[i - 1] === '--load' ? 'inPlace' : a))
    const result = runCliConfig({ assemblies: [], tracks: [] }, () => [
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
function checkBlock(json: string, kind: 'track' | 'assembly'): string {
  let config: Record<string, unknown>
  try {
    config = asRecord(JSON.parse(json))
  } catch (e) {
    return `not valid JSON: ${firstLine(e)}`
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

const errorLines: string[] = []
let checked = 0
for (const file of walkFiles(docsDir, n => n.endsWith('.md'))) {
  for (const block of taggedBlocks(readFileSync(file, 'utf8'), file)) {
    checked++
    const reason = checkBlock(block.json, block.kind)
    if (reason) {
      errorLines.push(
        `  ${block.file.slice(repoRoot.length + 1)}:${block.line}`,
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
if (deriveAddAssemblyArgs(UNDERIVABLE_ASSEMBLY) !== null) {
  errorLines.push(
    `  underivable assembly fixture (${UNDERIVABLE_ASSEMBLY.name})`,
    `    → expected this fixture to have no add-assembly equivalent\n`,
  )
}

if (errorLines.length) {
  errorLines.unshift(
    `Found addtrack/addassembly blocks whose derived command doesn't round-trip:\n`,
  )
}
reportProblems(
  errorLines,
  `All ${checked} addtrack/addassembly block(s) + ${FALLBACK_FIXTURES.length + 1} fixture(s) round-trip through jbrowse add-track / add-track-json / add-assembly.`,
)
