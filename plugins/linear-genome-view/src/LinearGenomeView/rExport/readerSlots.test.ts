import fs from 'node:fs'
import path from 'node:path'

import { configManifest } from '../../../../../products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'
import { configJsonSchema } from '../../../../../products/jbrowse-cli/src/commands/validate/configSchema.generated.ts'
import { slotPathsByType } from '../../../../../scripts/configSlotPaths.ts'
import { GGJBROWSE_VERSION, READERS, SEQUENCE_ADAPTERS } from './rScript.ts'

const pathsByType = slotPathsByType(configJsonSchema)
const declares = (type: string, slot: string) =>
  pathsByType.get(type)?.has(slot) ?? false

test('every display a reader reads is one the schema declares', () => {
  expect(
    Object.keys(READERS).filter(type => !(type in configManifest.displays)),
  ).toEqual([])
})

test('every adapter a reader opens declares the file slot it is read by', () => {
  const missing = Object.values(READERS).flatMap(({ adapters }) =>
    Object.entries(adapters).flatMap(([type, { slot }]) =>
      !(type in configManifest.adapters)
        ? [`${type} is no adapter`]
        : slot && !declares(type, slot)
          ? [`${type}.${slot}`]
          : [],
    ),
  )
  expect(missing).toEqual([])
})

test('the index slots the file argument reads are declared', () => {
  expect(
    [
      'BamAdapter.index.location',
      'BamAdapter.index.indexType',
      'VcfTabixAdapter.index.location',
      'CramAdapter.craiLocation',
    ].filter(slot => {
      const [type = '', ...rest] = slot.split('.')
      return !declares(type, rest.join('.'))
    }),
  ).toEqual([])
})

test('every sequence adapter declares its file slot and the index slots beside it', () => {
  const missing = Object.entries(SEQUENCE_ADAPTERS).flatMap(
    ([type, { slot, beside }]) =>
      [slot, ...Object.keys(beside)]
        .filter(s => !declares(type, s))
        .map(s => `${type}.${s}`),
  )
  expect(missing).toEqual([])
})

test('R_EXPORT.md tables the displays the export reads', () => {
  const doc = fs.readFileSync(
    path.join(__dirname, '../../../../../agent-docs/reference/R_EXPORT.md'),
    'utf8',
  )
  const tabled = [...doc.matchAll(/^\| `(\w+)`\s*\| `(\w+)`/gm)].map(
    ([, display, call]) => `${display} ${call}`,
  )
  expect(tabled.sort()).toEqual(
    Object.entries(READERS)
      .map(([display, { call }]) => `${display} ${call}`)
      .sort(),
  )
})

test('the user guide pins the ggjbrowse release the script pins', () => {
  const guide = fs.readFileSync(
    path.join(__dirname, '../../../../../website/docs/user_guides/r_export.md'),
    'utf8',
  )
  expect(guide).toContain(`GMOD/ggjbrowse@v${GGJBROWSE_VERSION}`)
  expect(guide).toContain(`ggjbrowse) ${GGJBROWSE_VERSION} or later`)
})
