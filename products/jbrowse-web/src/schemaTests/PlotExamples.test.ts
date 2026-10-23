import fs from 'node:fs'
import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConfigurationSchemaMetadata,
  isBareConfigurationSchemaType,
  isSlotDefinitionEntry,
  liftPlot,
  parsePlot,
  plotKeysOf,
} from '@jbrowse/core/configuration'

import corePlugins from '../corePlugins.ts'

import type DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

// "Edit plot..." offers each display type's examples as buttons and links
// its page in the config reference, so both are checked over every
// registered display rather than a list of them.

const pluginManager = new PluginManager(
  corePlugins.map(P => new P()),
).createPluggableElements()

const CONFIG_DOCS = path.join(__dirname, '../../../../website/docs/config')

const displays = (
  pluginManager.getElementTypesInGroup('display') as DisplayType[]
).map(display => ({
  display,
  conf: display.configSchema.create({ displayId: 'plotExamples' }),
}))

const withPlot = displays.filter(({ conf }) => plotKeysOf(conf).length > 0)

test('the displays with a plot are the ones the grammar reaches', () => {
  expect(withPlot.map(({ display }) => display.name).sort()).toEqual([
    'ChordSyntenyDisplay',
    'ChordVariantDisplay',
    'LDTrackDisplay',
    'LGVSyntenyDisplay',
    'LinearAlignmentsDisplay',
    'LinearBasicDisplay',
    'LinearHicDisplay',
    'LinearMafDisplay',
    'LinearManhattanDisplay',
    'LinearMarkDisplay',
    'LinearMultiRowFeatureDisplay',
    'LinearMultiSampleVariantDisplay',
    'LinearVariantDisplay',
    'LinearWiggleDisplay',
    'MultiWaySyntenyDisplay',
  ])
})

test.each(withPlot.map(({ display, conf }) => [display.name, display, conf]))(
  '%s offers examples, each one its schema takes',
  (_name, display, conf) => {
    expect(display.plotExamples.length).toBeGreaterThan(0)
    for (const { plot } of display.plotExamples) {
      expect(() =>
        liftPlot(conf, parsePlot(plot, plotKeysOf(conf))),
      ).not.toThrow()
    }
  },
)

test.each(withPlot.map(({ display, conf }) => [display.name, conf]))(
  "%s's config reference page exists, with a row for each plot setting",
  (_name, conf) => {
    const name = getConfigurationSchemaMetadata(conf)!.name
    const page = path.join(CONFIG_DOCS, `${name}.md`)
    expect(fs.existsSync(page)).toBe(true)
    const text = fs.readFileSync(page, 'utf8')
    for (const key of plotKeysOf(conf)) {
      expect(text).toContain(`id="slot-${key.toLowerCase()}"`)
    }
  },
)

test("each display's plot settings", () => {
  expect(
    Object.fromEntries(
      withPlot.map(({ display, conf }) => [
        display.name,
        plotKeysOf(conf).toSorted(),
      ]),
    ),
  ).toEqual({
    ChordSyntenyDisplay: ['mark'],
    ChordVariantDisplay: ['encoding', 'mark'],
    LDTrackDisplay: ['encoding', 'legend'],
    LGVSyntenyDisplay: [
      'coverage',
      'encoding',
      'facet',
      'filter',
      'legend',
      'pileup',
      'readConnections',
      'scales',
      'sort',
      'unit',
    ],
    LinearAlignmentsDisplay: [
      'coverage',
      'encoding',
      'facet',
      'filter',
      'legend',
      'modifications',
      'pileup',
      'readConnections',
      'sashimi',
      'scales',
      'sort',
      'unit',
    ],
    LinearBasicDisplay: ['encoding', 'facet', 'filter', 'labels', 'legend'],
    LinearHicDisplay: ['encoding', 'legend'],
    LinearMafDisplay: [
      'alignments',
      'conservation',
      'coverage',
      'encoding',
      'legend',
      'rowColor',
      'rows',
      'scales',
      'y',
    ],
    LinearManhattanDisplay: [
      'facet',
      'filter',
      'legend',
      'marks',
      'origin',
      'rowColor',
      'rows',
      'scales',
      'transform',
    ],
    LinearMarkDisplay: [
      'facet',
      'filter',
      'legend',
      'marks',
      'origin',
      'rowColor',
      'rows',
      'scales',
      'transform',
    ],
    LinearMultiRowFeatureDisplay: [
      'encoding',
      'facet',
      'legend',
      'rowColor',
      'rows',
    ],
    LinearMultiSampleVariantDisplay: [
      'encoding',
      'facet',
      'filter',
      'legend',
      'rowColor',
      'rows',
      'unit',
      'variants',
    ],
    LinearVariantDisplay: ['encoding', 'facet', 'filter', 'labels', 'legend'],
    LinearWiggleDisplay: [
      'encoding',
      'extent',
      'legend',
      'mark',
      'origin',
      'rowColor',
      'rows',
      'scales',
      'size',
      'y',
    ],
    MultiWaySyntenyDisplay: [
      'encoding',
      'laneLayers',
      'legend',
      'ribbons',
      'rows',
      'text',
    ],
  })
})

// The flag travels with a shared slot, field table or sub-schema, so a key
// one display declares by hand can miss it while every other display has it.
test('a key is a plot setting on every display declaring it, or on none', () => {
  const flagged = new Map<string, string[]>()
  const unflagged = new Map<string, string[]>()
  for (const { display, conf } of displays) {
    const keys = new Set(plotKeysOf(conf))
    for (const key of Object.keys(
      getConfigurationSchemaMetadata(conf)!.definition,
    )) {
      const into = keys.has(key) ? flagged : unflagged
      into.set(key, [...(into.get(key) ?? []), display.name])
    }
  }
  const split = [...flagged.keys()]
    .filter(key => unflagged.has(key))
    .map(key => `${key}: unflagged on ${unflagged.get(key)!.join(', ')}`)
  expect(split).toEqual([])
})

// A plot word reads the same way on every display: a slot, one object, or a
// list of objects. An agent writing `filter` to a feature track and an
// alignments track writes one shape to both.
test('a plot setting is the same kind of entry on every display declaring it', () => {
  const kinds = new Map<string, Set<string>>()
  for (const { conf } of withPlot) {
    const { definition } = getConfigurationSchemaMetadata(conf)!
    for (const key of plotKeysOf(conf)) {
      const entry = definition[key]
      const kind = isSlotDefinitionEntry(entry)
        ? 'slot'
        : isBareConfigurationSchemaType(entry)
          ? 'object'
          : 'list'
      kinds.set(key, new Set([...(kinds.get(key) ?? []), kind]))
    }
  }
  const mixed = [...kinds]
    .filter(([, of]) => of.size > 1)
    .map(([key, of]) => `${key}: ${[...of].join(' and ')}`)
  expect(mixed).toEqual([])
})
