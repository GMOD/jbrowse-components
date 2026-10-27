// Runs `jbrowse validate`'s checker over every config the v4.3.0 tag shipped,
// and over the JSON fences in its tutorials and config guides, then tallies
// each finding by kind and by the v4 spelling it names. The kinds and what the
// tally settled: agent-docs/reference/V4_CONFIG_COVERAGE.md.
//
// Run: node scripts/measure-v4-config-coverage.ts [--tag v4.3.0] [--verbose]
// [--write]. --write refreshes agent-docs/measurements/v4-config-*.json, which
// `pnpm autogen` renders into that doc.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { trackTypeForAdapter } from '../packages/add-track-core/src/formats.ts'
import { validateConfig } from '../products/jbrowse-cli/src/commands/validate/validateConfig.ts'

import type { Problem } from '../products/jbrowse-cli/src/commands/validate/types.ts'

const { values } = parseArgs({
  options: {
    tag: { type: 'string', default: 'v4.3.0' },
    verbose: { type: 'boolean', short: 'v' },
    write: { type: 'boolean' },
  },
  strict: true,
})
const tag = values.tag

type Json = Record<string, unknown>

function git(...args: string[]) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
}

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const files = git('ls-tree', '-r', '--name-only', tag).split('\n')
const v4CoreTypes = new Set(
  files
    .map(f => /^website\/docs\/config\/(\w+)\.md$/.exec(f)?.[1])
    .filter(t => t !== undefined),
)

const STUB_SEQUENCE = {
  type: 'TwoBitAdapter',
  twoBitLocation: { uri: 'stub.2bit' },
}

function stubAssembly(name: string, adapter: unknown = STUB_SEQUENCE) {
  return {
    name,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${name}-ReferenceSequenceTrack`,
      adapter,
    },
  }
}

function asTrack(entry: unknown): Json | undefined {
  if (!isRecord(entry) || typeof entry.type !== 'string') {
    return undefined
  }
  if (isRecord(entry.adapter)) {
    return { assemblyNames: ['stub'], ...entry }
  }
  return entry.type.endsWith('Adapter')
    ? {
        type: trackTypeForAdapter(entry.type) ?? 'FeatureTrack',
        trackId: 'stub',
        assemblyNames: ['stub'],
        adapter: entry,
      }
    : undefined
}

const ROOT_KEYS = [
  'tracks',
  'configuration',
  'plugins',
  'aggregateTextSearchAdapters',
]

function wrap(snippet: unknown): Json | undefined {
  if (isRecord(snippet) && (snippet.assemblies || snippet.assembly)) {
    return snippet
  }
  const root =
    isRecord(snippet) && ROOT_KEYS.some(k => k in snippet)
      ? snippet
      : { tracks: Array.isArray(snippet) ? snippet : [snippet] }
  const entries = (Array.isArray(root.tracks) ? root.tracks : []).map(asTrack)
  if (entries.includes(undefined)) {
    return undefined
  }
  const sequence = entries.find(t => t!.type === 'ReferenceSequenceTrack')
  const tracks = entries.filter(t => t !== sequence) as Json[]
  const names = new Set(tracks.flatMap(t => t.assemblyNames as string[]))
  return {
    ...root,
    assemblies: [...(names.size ? names : ['stub'])].map(name =>
      stubAssembly(name, sequence?.adapter),
    ),
    tracks,
  }
}

const corpus: { name: string; doc: boolean; config: Json }[] = []
for (const file of files.filter(f => /(^|\/)config[^/]*\.json$/.test(f))) {
  corpus.push({
    name: file,
    doc: false,
    config: JSON.parse(git('show', `${tag}:${file}`)),
  })
}
let fences = 0
for (const page of files.filter(f =>
  /^website\/docs\/(tutorials\/.*|config_guide|config_guides\/.*)\.md$/.test(f),
)) {
  const text = git('show', `${tag}:${page}`)
  for (const [i, m] of [
    ...text.matchAll(/^```jsonc?[^\n]*\n([\s\S]*?)^```/gm),
  ].entries()) {
    fences++
    let config: Json | undefined
    try {
      config = wrap(JSON.parse(m[1]!))
    } catch {}
    if (config) {
      corpus.push({ name: `${page}#${i + 1}`, doc: true, config })
    }
  }
}

function walk(config: Json, where: string) {
  const path = where.match(/[^.[\]]+/g) ?? []
  const nodes: unknown[] = [config]
  for (const key of path) {
    const node = nodes.at(-1)
    nodes.push(
      typeof node === 'object' && node !== null
        ? (node as Json)[key]
        : undefined,
    )
  }
  return { path, nodes }
}

function typeOf(node: unknown) {
  return isRecord(node) && typeof node.type === 'string' ? node.type : undefined
}

// The key a finding names, under the type of the object holding it: the v4
// spelling, as `TrixTextSearchAdapter.metaFilePath` or `session.margin`.
function spelling(config: Json, where: string) {
  const { path, nodes } = walk(config, where)
  const session = path[0] === 'defaultSession'
  const keys = path.map(key => (/^\d+$/.test(key) ? '' : key))
  const last = keys.findLastIndex(Boolean)
  if (keys[last] === 'type') {
    return `${session ? 'session ' : ''}type ${String(nodes.at(-1))}`
  }
  let owner = last
  while (owner > 0 && !typeOf(nodes[owner])) {
    owner--
  }
  const head = owner
    ? `${session ? 'session ' : ''}${typeOf(nodes[owner])}`
    : session
      ? 'session'
      : 'config'
  const from = owner || (session ? 1 : 0)
  return [head, ...keys.slice(from, last + 1)].filter(Boolean).join('.')
}

function kindOf({ level, message }: Problem, typeName: unknown) {
  if (message.includes('not registered by the core plugins')) {
    return v4CoreTypes.has(String(typeName)) ? 'unmapped' : 'plugin'
  }
  if (/a plugin (it|this config) declares may/.test(message)) {
    return 'plugin'
  }
  if (
    /is not defined in this config|missing "assemblyNames"|no assemblies|duplicate trackId/.test(
      message,
    )
  ) {
    return 'reference'
  }
  if (level === 'error') {
    return message.startsWith('expected ') ? 'shape' : 'unmapped'
  }
  if (message.includes('never read')) {
    return 'dropped'
  }
  return /legacy|deprecated/.test(message) ? 'lifted' : 'lint'
}

const KINDS = [
  'unmapped',
  'shape',
  'dropped',
  'lifted',
  'plugin',
  'reference',
  'lint',
]
const FAILING = new Set(['unmapped', 'shape'])
const WARNING = new Set(['dropped', 'lifted'])

const table = new Map<
  string,
  { spelling: string; kind: string; configs: Set<string> }
>()
const verdicts = corpus.map(({ name, doc, config }) => {
  const { problems } = validateConfig(config)
  const kinds = new Set<string>()
  for (const p of problems) {
    const kind = kindOf(p, walk(config, p.where).nodes.at(-1))
    const key = spelling(config, p.where)
    const entry = table.get(`${kind} ${key}`) ?? {
      spelling: key,
      kind,
      configs: new Set(),
    }
    entry.configs.add(name)
    table.set(`${kind} ${key}`, entry)
    kinds.add(kind)
    if (values.verbose) {
      console.log(`${name}: ${kind} ${p.level} ${p.where}: ${p.message}`)
    }
  }
  const verdict = [...kinds].some(k => FAILING.has(k))
    ? 'fail'
    : [...kinds].some(k => WARNING.has(k))
      ? 'warn'
      : 'clean'
  return { name, doc, verdict, kinds }
})

const spellings = [...table.values()]
  .sort(
    (a, b) =>
      KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) ||
      b.configs.size - a.configs.size ||
      a.spelling.localeCompare(b.spelling, 'en'),
  )
  .map(({ spelling, kind, configs }) => ({
    spelling,
    kind,
    configs: configs.size,
  }))
const headline = (
  [
    ['config files', false],
    ['doc snippets', true],
  ] as const
).map(([corpus, doc]) => {
  const group = verdicts.filter(v => v.doc === doc)
  const count = (verdict: string) =>
    group.filter(v => v.verdict === verdict).length
  return {
    corpus,
    configs: group.length,
    clean: count('clean'),
    warn: count('warn'),
    fail: count('fail'),
  }
})

for (const { name, verdict, kinds } of verdicts) {
  const unresolved = ['plugin', 'reference'].filter(k => kinds.has(k))
  console.log(
    `${verdict.padEnd(5)} ${name}${unresolved.length ? `  (also ${unresolved.join(', ')})` : ''}`,
  )
}
console.log('\nspelling\tkind\tconfigs')
for (const { spelling, kind, configs } of spellings) {
  console.log(`${spelling}\t${kind}\t${configs}`)
}
console.log()
for (const { corpus, configs, clean, warn, fail } of headline) {
  console.log(
    `${corpus}: ${clean} of ${configs} clean, ${warn} warn, ${fail} fail`,
  )
}
console.log(`(${fences} JSON fences read, ${headline[1]!.configs} wrapped)`)

const intColumn = (key: string) => ({
  key,
  label: key,
  format: 'int',
  align: 'right',
})
function record(id: string, columns: object[], rows: object[]) {
  const file = new URL(`../agent-docs/measurements/${id}.json`, import.meta.url)
  const measurement = {
    id,
    measured: new Date().toISOString().slice(0, 10),
    published: false,
    source: {
      kind: 'bench',
      repro: `node scripts/measure-v4-config-coverage.ts --tag ${tag} --write`,
    },
    columns,
    rows: rows.map(values => ({ values })),
  }
  writeFileSync(file, `${JSON.stringify(measurement, null, 2)}\n`)
}
if (values.write) {
  record(
    'v4-config-coverage',
    [
      { key: 'corpus', label: `${tag} corpus` },
      intColumn('configs'),
      intColumn('clean'),
      intColumn('warn'),
      intColumn('fail'),
    ],
    headline,
  )
  record(
    'v4-config-spellings',
    [
      { key: 'spelling', label: `${tag} spelling` },
      { key: 'kind', label: 'kind' },
      intColumn('configs'),
    ],
    spellings,
  )
}
