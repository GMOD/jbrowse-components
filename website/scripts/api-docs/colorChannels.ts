import fs from 'fs'

import { UNIVERSAL_FIELD_PRESETS } from '../../../packages/core/src/util/colorScale.ts'
import { rewriteMarkerBlock } from '../markerDocs.ts'
import { configManifest, configManifestTables } from './configManifest.ts'
import { markdownTable, section, tableCell } from './markdown.ts'

import type { FieldPresets } from '../../../packages/core/src/util/colorScale.ts'
import type { ManifestSlot } from './configManifest.ts'

let presetsBySchema: Map<string, FieldPresets<string>> | undefined

function fieldPresetsOf(schema: string) {
  if (!presetsBySchema) {
    const found = new Map<string, FieldPresets<string>>()
    const visit = (slots: ManifestSlot[] = []) => {
      for (const slot of slots) {
        if (slot.schema && slot.fieldPresets) {
          found.set(slot.schema, slot.fieldPresets)
        }
        visit(slot.subSlots)
      }
    }
    for (const entry of Object.values(configManifest())) {
      visit(entry.slots)
    }
    presetsBySchema = found
  }
  return presetsBySchema.get(schema)
}

const levelList = (levels: readonly string[] = []) =>
  levels.map(level => `\`${level === '' ? "''" : level}\``).join(', ')

// A color channel's named fields and what each paints while the config
// leaves its scale unwritten, from the manifest `jbrowse validate` reads. A
// channel whose other fields are categories lists the universal fields too,
// unless it spells one of them its own way, as reads spell strand.
function presetEntries(
  presets: FieldPresets<string>,
): [string, FieldPresets<string>[string]][] {
  const universal =
    presets['*']?.scale.type === 'ordinal' &&
    !Object.keys(UNIVERSAL_FIELD_PRESETS).some(f => Object.hasOwn(presets, f))
  return Object.entries({
    ...(universal ? UNIVERSAL_FIELD_PRESETS : {}),
    ...presets,
  }).filter(([field]) => field !== '*')
}

export function presetFieldsSection(name: string) {
  const presets = fieldPresetsOf(name)
  if (!presets) {
    return ''
  }
  const rows = presetEntries(presets).map(([field, { scale, legend }]) => {
    const { type, domain, names, range, ...rest } = scale
    const defaults = [
      ...Object.entries(rest).map(([k, v]) => `\`${k}: ${String(v)}\``),
      ...(range ? [`\`range\`: ${levelList(range)}`] : []),
      ...(legend?.title ? [`key "${legend.title}"`] : []),
    ]
    return `| \`${field}\` | ${type} | ${levelList(domain)} | ${tableCell(names?.join(', '))} | ${defaults.join('; ')} |`
  })
  if (rows.length === 0) {
    return ''
  }
  return section(
    '## Preset fields',
    `A \`field\` named here paints through its own scale while \`scale.type\` is unset, and \`range\` and \`names\` index its levels in order while \`domain\` is unwritten.${presets['*'] ? ` Any other field is ${presets['*'].scale.type}.` : ''}`,
    markdownTable(
      ['Field', 'Scale', 'Levels', 'Names', 'Other defaults'],
      rows,
    ),
  )
}

// Where generateConfigManifest.ts writes the published schema: under the
// web app's major version
export function schemaJsonPath(
  version = (
    JSON.parse(
      fs.readFileSync('products/jbrowse-web/package.json', 'utf8'),
    ) as {
      version: string
    }
  ).version,
) {
  return `website/static/schema/v${version.split('.')[0]}/config.json`
}
let schemaDefs: Record<string, { properties?: Record<string, unknown> }>

function scaleTypesOf(scaleSchema: string | undefined) {
  schemaDefs ??= (
    JSON.parse(fs.readFileSync(schemaJsonPath(), 'utf8')) as {
      $defs: typeof schemaDefs
    }
  ).$defs
  const type = scaleSchema
    ? (schemaDefs[scaleSchema]?.properties?.type as
        | { else?: { enum?: string[]; const?: string } }
        | undefined)
    : undefined
  const { enum: types, const: only } = type?.else ?? {}
  return types?.join(', ') ?? only ?? 'fixed by the field'
}

// Each color channel a display holds, at any depth, as table cells: where it
// sits, its page, the scale types it takes and its preset fields.
function colorChannelCells(display: string) {
  const cells: string[][] = []
  const visit = (slots: ManifestSlot[] = [], path: string[]) => {
    for (const slot of slots) {
      const at = [...path, slot.name]
      if (slot.fieldPresets && slot.schema) {
        const scale = slot.subSlots?.find(s => s.name === 'scale')?.schema
        const fields = presetEntries(slot.fieldPresets).map(([field]) => field)
        const anchor = fields.length ? '#preset-fields' : ''
        cells.push([
          `\`${at.join('.')}\``,
          `[](/docs/config/${slot.schema.toLowerCase()}${anchor})`,
          scaleTypesOf(scale),
          levelList(fields),
        ])
      } else {
        visit(slot.subSlots, at)
      }
    }
  }
  visit(configManifest()[display]?.slots, [])
  return cells
}

const CHANNEL_HEADERS = ['Setting', 'Page', '`scale.type`', 'Preset fields']
const row = (cells: string[]) => `| ${cells.join(' | ')} |`

// What a display can paint, so a reader choosing one sees it without
// following the encoding pages down.
export function colorChannelsSection(name: string) {
  const cells =
    configManifest()[name]?.category === 'displays'
      ? colorChannelCells(name)
      : []
  return cells.length
    ? section(
        '## Color channels',
        markdownTable(CHANNEL_HEADERS, cells.map(row)),
      )
    : ''
}

// Every display's color channels in one table, for the config index.
export function writeColorChannelDocs() {
  const rows = Object.keys(configManifestTables().displays ?? {})
    .sort((a, b) => a.localeCompare(b, 'en'))
    .flatMap(display =>
      colorChannelCells(display).map(cells =>
        row([`[](/docs/config/${display.toLowerCase()})`, ...cells]),
      ),
    )
  return rewriteMarkerBlock(
    'COLOR_CHANNELS',
    markdownTable(['Display', ...CHANNEL_HEADERS], rows),
  )
}
