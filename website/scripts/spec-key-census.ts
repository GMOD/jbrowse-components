// What the figure corpus actually writes into a session spec: every `session=`
// url in screenshot-specs.ts decoded, and the keys on its view and track
// entries tallied by the display type they land on.
//
// The two records this emits back agent-docs/reference/SESSION_SPEC_FORMAT.md,
// which is where the numbers are read. Run with `--write` to refresh them:
//
//   node --experimental-strip-types website/scripts/spec-key-census.ts --write
//
// A key is "shared" when at least two EXPLICIT display types carry it; an entry
// that names no `type` opens the track's default display, which the census
// cannot resolve without a config, so `(default)` never counts toward sharing.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { repoRoot } from './paths.ts'
import { specs } from './screenshot-specs.ts'

interface SpecView {
  type?: string
  tracks?: unknown[]
  views?: SpecView[]
  levels?: SpecView[]
}

interface SpecSession {
  views?: SpecView[]
  sessionTracks?: unknown[]
}

const ENTRY_META = new Set([
  'trackId',
  'type',
  'trackSnapshot',
  'displaySnapshot',
])
const DEFAULT = '(default)'

function bump<K>(m: Map<K, number>, k: K) {
  m.set(k, (m.get(k) ?? 0) + 1)
}

export function decodeSessions(): SpecSession[] {
  const out: SpecSession[] = []
  for (const spec of specs) {
    if (spec.mode !== 'url') {
      continue
    }
    const m = /[?&]session=([^&]*)/.exec(spec.url)
    if (!m) {
      continue
    }
    const raw = decodeURIComponent(m[1]!)
    if (raw.startsWith('spec-')) {
      out.push(JSON.parse(raw.slice(5)) as SpecSession)
    }
  }
  return out
}

export function census(sessions: SpecSession[]) {
  const viewTypes = new Map<string, number>()
  const viewKeys = new Map<string, number>()
  const keyUses = new Map<string, number>()
  const keyDisplays = new Map<string, Set<string>>()
  const displayTypes = new Set<string>()
  const keysPerEntry: number[] = []
  let views = 0
  let bareIds = 0
  let tupleEntries = 0
  let objectEntries = 0
  let sessionTracks = 0

  const walk = (list: SpecView[] | undefined) => {
    for (const view of list ?? []) {
      views++
      bump(viewTypes, view.type ?? DEFAULT)
      for (const key of Object.keys(view)) {
        bump(viewKeys, key)
      }
      for (const entry of view.tracks ?? []) {
        if (typeof entry === 'string') {
          bareIds++
          continue
        }
        if (Array.isArray(entry)) {
          tupleEntries++
          continue
        }
        objectEntries++
        const record = entry as Record<string, unknown>
        const display = typeof record.type === 'string' ? record.type : DEFAULT
        if (display !== DEFAULT) {
          displayTypes.add(display)
        }
        const keys = Object.keys(record).filter(k => !ENTRY_META.has(k))
        keysPerEntry.push(keys.length)
        for (const key of keys) {
          bump(keyUses, key)
          if (!keyDisplays.has(key)) {
            keyDisplays.set(key, new Set())
          }
          keyDisplays.get(key)!.add(display)
        }
      }
      walk(view.views)
      walk(view.levels)
    }
  }
  for (const session of sessions) {
    sessionTracks += session.sessionTracks?.length ?? 0
    walk(session.views)
  }

  const explicitDisplays = (key: string) =>
    [...keyDisplays.get(key)!].filter(d => d !== DEFAULT)
  const shared = [...keyUses.keys()]
    .filter(key => explicitDisplays(key).length >= 2)
    .sort((a, b) => keyUses.get(b)! - keyUses.get(a)!)
  keysPerEntry.sort((a, b) => a - b)
  const quantile = (p: number) =>
    keysPerEntry[Math.floor(p * (keysPerEntry.length - 1))] ?? 0

  return {
    sessions: sessions.length,
    views,
    viewTypes,
    viewKeys,
    sessionTracks,
    bareIds,
    tupleEntries,
    objectEntries,
    distinctKeys: keyUses.size,
    sharedKeys: shared.length,
    singleUseKeys: [...keyUses.values()].filter(n => n === 1).length,
    displayTypes: displayTypes.size,
    medianKeys: quantile(0.5),
    p90Keys: quantile(0.9),
    maxKeys: keysPerEntry.at(-1) ?? 0,
    shared: shared.map(key => ({
      key,
      uses: keyUses.get(key)!,
      displays: explicitDisplays(key).length,
    })),
  }
}

function records(c: ReturnType<typeof census>, measured: string) {
  const repro =
    'node --experimental-strip-types website/scripts/spec-key-census.ts --write'
  const corpus = {
    id: 'session-spec-corpus',
    measured,
    published: false,
    source: {
      kind: 'bench',
      repro,
      notes:
        'Every url-mode spec in website/scripts/screenshot-specs.ts whose session= carries a spec-… JSON. A track entry is a bare trackId, a one-element tuple (the synteny levels form) or an object; key counts are over the objects, excluding trackId, type and the two escape-hatch snapshots.',
    },
    columns: [
      { key: 'metric', label: '' },
      { key: 'value', label: 'value', format: 'int', align: 'right' },
    ],
    rows: [
      ['session specs', c.sessions],
      ['views, nested ones included', c.views],
      ['session tracks carried inline', c.sessionTracks],
      ['track entries: bare id', c.bareIds],
      ['track entries: tuple', c.tupleEntries],
      ['track entries: object', c.objectEntries],
      ['explicit display types named', c.displayTypes],
      ['distinct keys on object entries', c.distinctKeys],
      ['keys on two or more display types', c.sharedKeys],
      ['keys used exactly once', c.singleUseKeys],
      ['keys per object entry, median', c.medianKeys],
      ['keys per object entry, 90th percentile', c.p90Keys],
      ['keys per object entry, max', c.maxKeys],
    ].map(([metric, value]) => ({ values: { metric, value } })),
  }
  const vocabulary = {
    id: 'session-spec-vocabulary',
    measured,
    published: false,
    source: {
      kind: 'bench',
      repro,
      notes:
        'The keys at least two explicit display types carry, over the same corpus as session-spec-corpus. A key an entry sets without naming a display type is counted in uses but not toward the display-type count.',
    },
    columns: [
      { key: 'key', label: 'key' },
      { key: 'uses', label: 'entries', format: 'int', align: 'right' },
      {
        key: 'displays',
        label: 'display types',
        format: 'int',
        align: 'right',
      },
    ],
    rows: c.shared.map(({ key, uses, displays }) => ({
      values: { key, uses, displays },
    })),
  }
  return { corpus, vocabulary }
}

const c = census(decodeSessions())
const measured = new Date().toISOString().slice(0, 10)
const { corpus, vocabulary } = records(c, measured)

if (process.argv.includes('--write')) {
  const dir = join(repoRoot, 'agent-docs/measurements')
  for (const record of [corpus, vocabulary]) {
    writeFileSync(
      join(dir, `${record.id}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
    )
  }
  console.log(`wrote ${corpus.id}.json and ${vocabulary.id}.json`)
} else {
  console.log(JSON.stringify({ corpus, vocabulary }, null, 2))
  console.log(
    'view types:',
    [...c.viewTypes]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k}:${n}`)
      .join(' '),
  )
}
