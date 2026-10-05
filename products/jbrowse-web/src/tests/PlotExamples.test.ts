import fs from 'node:fs'
import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConfigurationSchemaMetadata,
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
  "%s's config reference page exists",
  (_name, conf) => {
    const name = getConfigurationSchemaMetadata(conf)!.name
    expect(fs.existsSync(path.join(CONFIG_DOCS, `${name}.md`))).toBe(true)
  },
)
