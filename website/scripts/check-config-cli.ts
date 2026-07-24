// Round-trip every ```json block tagged `addtrack` in the docs through the real
// `jbrowse add-track` CLI, asserting the derived command reproduces the shown
// config. The remark plugin (src/lib/remark-config-cli-tabs.ts) renders such a
// block as a Config/CLI tab pair, deriving the command from the JSON so the two
// can't drift; this is the CI gate that proves each derived command is actually
// runnable and faithful. A tagged block that isn't CLI-clean (deriveAddTrackArgs
// returns null) is an authoring mistake — remove the tag — and fails here too.
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

import { deriveAddTrackArgs } from '../src/lib/derive-add-track.ts'
import { reportProblems, walkFiles } from './check-utils.ts'

const root = join(import.meta.dirname, '..', '..')
const docsDir = join(import.meta.dirname, '..', 'docs')
const cli = join(root, 'products', 'jbrowse-cli', 'dist', 'bin.js')

interface Block {
  file: string
  line: number
  config: Record<string, unknown>
}

// Yield every ```json block whose info string carries the `addtrack` flag,
// paired with the 1-based line of its opening fence.
function addtrackBlocks(md: string, file: string): Block[] {
  const lines = md.split('\n')
  const blocks: Block[] = []
  let start = -1
  let buf: string[] = []
  lines.forEach((line, i) => {
    const opening = /^```json\b.*\baddtrack\b/.test(line)
    const closing = start >= 0 && /^```\s*$/.test(line)
    if (start >= 0 && !closing) {
      buf.push(line)
    }
    if (opening) {
      start = i
      buf = []
    } else if (closing) {
      blocks.push({
        file,
        line: start + 1,
        config: JSON.parse(buf.join('\n')) as Record<string, unknown>,
      })
      start = -1
    }
  })
  return blocks
}

// The main data-file uri the resulting adapter points at: an explicit `uri`, or
// the first `*Location` slot's uri.
function adapterUri(adapter: Record<string, unknown>) {
  const direct = typeof adapter.uri === 'string' ? adapter.uri : undefined
  const located = Object.values(adapter)
    .map(v =>
      v &&
      typeof v === 'object' &&
      typeof (v as Record<string, unknown>).uri === 'string'
        ? ((v as Record<string, unknown>).uri as string)
        : undefined,
    )
    .find(Boolean)
  return direct ?? located
}

function basename(uri: string) {
  return uri.split('/').pop()
}

// Run add-track for one block and return the mismatch reason, or '' on success.
function roundTrip(config: Record<string, unknown>): string {
  const args = deriveAddTrackArgs(config)
  const dir = mkdtempSync(join(tmpdir(), 'cfgcli-'))
  try {
    const assemblies = (config.assemblyNames as string[]).map(name => ({
      name,
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ref`,
        adapter: { type: 'TwoBitAdapter', uri: `${name}.2bit` },
      },
    }))
    const cfgPath = join(dir, 'config.json')
    writeFileSync(cfgPath, JSON.stringify({ assemblies, tracks: [] }))
    const runArgs = args!.map(a => (a === 'copy' ? 'inPlace' : a))
    execFileSync('node', [cli, ...runArgs, '--target', cfgPath], {
      stdio: 'pipe',
    })
    const result = JSON.parse(readFileSync(cfgPath, 'utf8')) as {
      tracks: Record<string, unknown>[]
    }
    const track = result.tracks.find(t => t.trackId === config.trackId)
    const srcAdapter = config.adapter as Record<string, unknown>
    const gotAdapter = track?.adapter as Record<string, unknown> | undefined
    const mismatches = [
      track === undefined && 'track not added',
      track &&
        track.type !== config.type &&
        `type ${track.type} != ${config.type}`,
      track && track.name !== config.name && `name mismatch`,
      gotAdapter &&
        gotAdapter.type !== srcAdapter.type &&
        `adapter ${gotAdapter.type} != ${srcAdapter.type}`,
      gotAdapter &&
        basename(adapterUri(gotAdapter) ?? '') !==
          basename(srcAdapter.uri as string) &&
        `uri ${adapterUri(gotAdapter)} != ${srcAdapter.uri}`,
      track &&
        JSON.stringify(track.displayDefaults ?? {}) !==
          JSON.stringify(config.displayDefaults ?? {}) &&
        `displayDefaults mismatch`,
    ].filter((x): x is string => typeof x === 'string')
    return mismatches.join('; ')
  } catch (e) {
    return `add-track failed: ${(e as Error).message.split('\n')[0]}`
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const errorLines: string[] = []
let checked = 0
for (const file of walkFiles(docsDir, n => n.endsWith('.md'))) {
  for (const block of addtrackBlocks(readFileSync(file, 'utf8'), file)) {
    const rel = block.file.slice(root.length + 1)
    const reason =
      deriveAddTrackArgs(block.config) === null
        ? 'block is not CLI-clean; remove the `addtrack` tag'
        : roundTrip(block.config)
    checked++
    if (reason) {
      errorLines.push(
        `  ${rel}:${block.line}  (${block.config.trackId})`,
        `    → ${reason}\n`,
      )
    }
  }
}
if (errorLines.length) {
  errorLines.unshift(
    `Found addtrack blocks whose derived command doesn't round-trip:\n`,
  )
}
reportProblems(
  errorLines,
  `All ${checked} addtrack block(s) round-trip through jbrowse add-track.`,
)
