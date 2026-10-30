// Writes agent-docs/reference/CONFIG_SPELLINGS.md's tables: every display
// setting's spelling in one place, read off the committed config JSON schema,
// so a review of the v5 surface reads one page. Rides `pnpm autogen`, after
// the config schema manifest.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  checkOrWrite,
  markdownTableLines,
  spliceGeneratedBlock,
} from '../website/scripts/check-utils.ts'
import { slotPathsByType } from './configSlotPaths.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const docPath = path.join(ROOT, 'agent-docs/reference/CONFIG_SPELLINGS.md')
const { version } = JSON.parse(
  readFileSync(path.join(ROOT, 'products/jbrowse-web/package.json'), 'utf8'),
) as { version: string }
const major = version.split('.')[0]
const schema = JSON.parse(
  readFileSync(
    path.join(ROOT, `website/static/schema/v${major}/config.json`),
    'utf8',
  ),
)

const displayTypes = (byType: Map<string, Set<string>>) =>
  [...byType.keys()]
    .filter(type => type.endsWith('Display'))
    .sort((a, b) => a.localeCompare(b, 'en'))

const live = slotPathsByType(schema, { live: true })
const all = slotPathsByType(schema)
const displays = displayTypes(live)
const short = (type: string) => type.replace(/Display$/, '')
const code = (words: Iterable<string>) =>
  [...words].map(word => `\`${word}\``).join(' ')

// A field's values and the display type's aliases are each display's own by
// design.
const isDataWord = (slot: string) => slot === 'type' || slot.endsWith('field')

// A path's shape: the members below it, or for a leaf the values its enum
// admits. An object's shorthand values are left out, as the members say it.
function shapes(type: string) {
  const members = new Map<string, Set<string>>()
  const values = new Map<string, Set<string>>()
  const add = (
    byPath: Map<string, Set<string>>,
    slot: string,
    word?: string,
  ) => {
    const set = byPath.get(slot) ?? new Set<string>()
    if (word !== undefined) {
      set.add(word)
    }
    byPath.set(slot, set)
  }
  for (const line of live.get(type)!) {
    const eq = line.indexOf('=')
    const slot = eq === -1 ? line : line.slice(0, eq)
    add(members, slot)
    if (eq !== -1) {
      add(values, slot, `=${line.slice(eq + 1)}`)
    }
    const dot = slot.lastIndexOf('.')
    if (dot !== -1) {
      add(members, slot.slice(0, dot), slot.slice(dot + 1))
    }
  }
  return new Map(
    [...members]
      .filter(([slot]) => !isDataWord(slot))
      .map(([slot, words]) => [
        slot,
        words.size > 0 ? words : (values.get(slot) ?? words),
      ]),
  )
}

const shapeByDisplay = new Map(displays.map(type => [type, shapes(type)]))

function divergentRows() {
  const paths = new Set(
    [...shapeByDisplay.values()].flatMap(byPath => [...byPath.keys()]),
  )
  const rows: string[][] = []
  for (const slot of [...paths].sort((a, b) => a.localeCompare(b, 'en'))) {
    const groups = new Map<string, string[]>()
    for (const [type, byPath] of shapeByDisplay) {
      const members = byPath.get(slot)
      if (members) {
        const key = [...members]
          .sort((a, b) => a.localeCompare(b, 'en'))
          .join(' ')
        groups.set(key, [...(groups.get(key) ?? []), short(type)])
      }
    }
    if (groups.size > 1) {
      for (const [members, types] of groups) {
        rows.push([
          `\`${slot}\``,
          members ? code(members.split(' ')) : '(leaf)',
          types.join(', '),
        ])
      }
    }
  }
  return rows
}

const topLevel = (lines: Iterable<string>) =>
  new Set(
    [...lines]
      .map(line => line.split(/[.=[{]/)[0]!)
      .sort((a, b) => a.localeCompare(b, 'en')),
  )

function wordRows() {
  const contexts = new Map<string, Map<string, Set<string>>>()
  for (const type of displays) {
    for (const line of live.get(type)!) {
      const slot = line.split('=')[0]!
      const segments = slot.split('.')
      const word = segments.at(-1)!.replace(/(\[\]|\{\})+$/, '')
      const parent = segments.slice(0, -1).join('.') || '(top)'
      const byParent = contexts.get(word) ?? new Map<string, Set<string>>()
      byParent.set(parent, (byParent.get(parent) ?? new Set()).add(short(type)))
      contexts.set(word, byParent)
    }
  }
  return [...contexts]
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([word, byParent]) => [
      `\`${word}\``,
      String(new Set([...byParent.values()].flatMap(types => [...types])).size),
      [...byParent.keys()]
        .sort((a, b) => a.localeCompare(b, 'en'))
        .map(parent => (parent === '(top)' ? parent : `\`${parent}\``))
        .join(' '),
    ])
}

const ownWordRows = () =>
  displays.map(type => [short(type), code(topLevel(live.get(type)!))])

const retiredRows = () =>
  displays
    .map(type => {
      const current = topLevel(live.get(type)!)
      const retired = [...topLevel(all.get(type)!)].filter(
        word => !current.has(word),
      )
      return [short(type), code(retired)]
    })
    .filter(([, retired]) => retired)

let text = readFileSync(docPath, 'utf8')
for (const [marker, headers, rows] of [
  [
    'CONFIG_SPELLINGS_DIVERGENT',
    ['Path', 'Members or values', 'Displays'],
    divergentRows(),
  ],
  ['CONFIG_SPELLINGS_TOP_LEVEL', ['Display', 'Settings'], ownWordRows()],
  ['CONFIG_SPELLINGS_WORDS', ['Word', 'Displays', 'Sits under'], wordRows()],
  ['CONFIG_SPELLINGS_RETIRED', ['Display', 'Retired keys'], retiredRows()],
] as const) {
  text = spliceGeneratedBlock({
    path: docPath,
    marker,
    body: [
      '<!-- prettier-ignore -->',
      ...markdownTableLines([...headers], rows),
    ],
    text,
  })
}

checkOrWrite({
  path: docPath,
  label: 'CONFIG_SPELLINGS.md',
  content: text,
  staleHint: 'run `node scripts/generateConfigSpellings.ts`',
})
