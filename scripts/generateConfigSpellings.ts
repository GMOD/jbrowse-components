// Writes agent-docs/reference/CONFIG_SPELLINGS.md's tables: every display
// setting's spelling in one place, read off the committed config JSON schema,
// so a review of the v5 surface reads one page. Runs in
// `website/scripts/api-docs/markers.ts`, after the config schema manifest.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { markdownTableLines } from '../website/scripts/check-utils.ts'
import { rewriteMarkerBlock } from '../website/scripts/markerDocs.ts'
import { slotPathsByType } from './configSlotPaths.ts'
import { RULINGS } from './configSpellingRulings.ts'
import {
  byName,
  code,
  displayTypes,
  divergentShapes,
  rulingProblems,
  short,
} from './configSpellingShapes.ts'

import type { JsonSchema } from './configJsonSchema.ts'

const ROOT = path.resolve(import.meta.dirname, '..')

function readConfigSchema() {
  const { version } = JSON.parse(
    readFileSync(path.join(ROOT, 'products/jbrowse-web/package.json'), 'utf8'),
  ) as { version: string }
  const major = version.split('.')[0]
  const schema: JsonSchema = JSON.parse(
    readFileSync(
      path.join(ROOT, `website/static/schema/v${major}/config.json`),
      'utf8',
    ),
  )
  return schema
}

export function writeConfigSpellings() {
  const schema = readConfigSchema()
  const problems = rulingProblems(schema, RULINGS)
  if (problems.length > 0) {
    throw new Error(
      `scripts/configSpellingRulings.ts and the config schema disagree:\n${problems.join('\n')}`,
    )
  }
  const live = slotPathsByType(schema, { live: true })
  const all = slotPathsByType(schema)
  const displays = displayTypes(live)

  const divergentRows = () =>
    [...divergentShapes(schema)].flatMap(([slot, bySlot]) =>
      [...bySlot].map(([members, holders], variant) => [
        `\`${slot}\``,
        members ? code(members.split(' ')) : '(leaf)',
        holders.join(', '),
        variant === 0 ? (RULINGS[slot]?.why ?? '') : '',
      ]),
    )

  const topLevel = (lines: Iterable<string>) =>
    new Set([...lines].map(line => line.split(/[.=[{]/)[0]!).sort(byName))

  function wordRows() {
    const contexts = new Map<string, Map<string, Set<string>>>()
    for (const type of displays) {
      for (const line of live.get(type)!) {
        const slot = line.split('=')[0]!
        const segments = slot.split('.')
        const word = segments.at(-1)!.replace(/(\[\]|\{\})+$/, '')
        const parent = segments.slice(0, -1).join('.') || '(top)'
        const byParent = contexts.get(word) ?? new Map<string, Set<string>>()
        byParent.set(
          parent,
          (byParent.get(parent) ?? new Set()).add(short(type)),
        )
        contexts.set(word, byParent)
      }
    }
    return [...contexts]
      .sort(([a], [b]) => byName(a, b))
      .map(([word, byParent]) => [
        `\`${word}\``,
        String(
          new Set([...byParent.values()].flatMap(types => [...types])).size,
        ),
        [...byParent.keys()]
          .sort(byName)
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

  const openLines = Object.entries(RULINGS).flatMap(([slot, { open }]) =>
    open ? [`- \`${slot}\`: ${open}`] : [],
  )

  const tables = [
    [
      'CONFIG_SPELLINGS_DIVERGENT',
      ['Path', 'Members or values', 'Who', 'Why'],
      divergentRows(),
    ],
    ['CONFIG_SPELLINGS_TOP_LEVEL', ['Display', 'Settings'], ownWordRows()],
    ['CONFIG_SPELLINGS_WORDS', ['Word', 'Displays', 'Sits under'], wordRows()],
    ['CONFIG_SPELLINGS_RETIRED', ['Display', 'Retired keys'], retiredRows()],
  ] as const

  return [
    ...rewriteMarkerBlock(
      'CONFIG_SPELLINGS_OPEN',
      openLines.length > 0 ? openLines.join('\n') : 'None.',
    ),
    ...tables.flatMap(([marker, headers, rows]) =>
      rewriteMarkerBlock(
        marker,
        [
          '<!-- prettier-ignore -->',
          ...markdownTableLines([...headers], rows),
        ].join('\n'),
      ),
    ),
  ]
}
