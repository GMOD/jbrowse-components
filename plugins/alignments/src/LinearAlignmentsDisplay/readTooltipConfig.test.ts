import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { preprocessTrackConfigSnapshot } from '@jbrowse/core/pluggableElementTypes/models'

import AlignmentsPlugin from '../index.ts'

function pluginManagerWithAlignments() {
  const pluginManager = new PluginManager([new AlignmentsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

function tooltipFieldOf(display: Record<string, unknown>) {
  const pluginManager = pluginManagerWithAlignments()
  const track = preprocessTrackConfigSnapshot(pluginManager, {
    type: 'AlignmentsTrack',
    trackId: 't',
    name: 't',
    assemblyNames: ['volvox'],
    adapter: { type: 'BamAdapter', uri: 'a.bam' },
    displays: [{ displayId: 'd', ...display }],
  })
  const [entry] = track.displays as Record<string, unknown>[]
  const conf = pluginManager
    .getDisplayType('LinearAlignmentsDisplay')
    .configSchema.create(entry)
  return readConfObject(conf, ['tooltip', 'field'])
}

test('unset, the field is empty', () => {
  expect(tooltipFieldOf({ type: 'LinearAlignmentsDisplay' })).toBe('')
})

test('a bare string is the field', () => {
  expect(
    tooltipFieldOf({ type: 'LinearAlignmentsDisplay', tooltip: 'tags.HP' }),
  ).toBe('tags.HP')
})

test("v4's mouseover is the field", () => {
  expect(
    tooltipFieldOf({ type: 'LinearAlignmentsDisplay', mouseover: 'tags.HP' }),
  ).toBe('tags.HP')
})

test('a written tooltip wins over a mouseover beside it', () => {
  expect(
    tooltipFieldOf({
      type: 'LinearAlignmentsDisplay',
      mouseover: 'tags.HP',
      tooltip: 'tags.PS',
    }),
  ).toBe('tags.PS')
})

test("the v4 container's pileup mouseover is the field", () => {
  expect(
    tooltipFieldOf({
      type: 'LinearAlignmentsDisplay',
      pileupDisplay: {
        type: 'LinearPileupDisplay',
        displayId: 'p',
        mouseover: 'tags.HP',
      },
    }),
  ).toBe('tags.HP')
})

// the display's own setting over its v4 sub-display's: the base display's
// retired map declares `mouseover` before this one's `pileupDisplay`
test("a top-level mouseover wins over the v4 container's pileup one", () => {
  expect(
    tooltipFieldOf({
      type: 'LinearAlignmentsDisplay',
      mouseover: 'tags.PS',
      pileupDisplay: {
        type: 'LinearPileupDisplay',
        displayId: 'p',
        mouseover: 'tags.HP',
      },
    }),
  ).toBe('tags.PS')
})

test("a coverage display's mouseover, a bin's hover, titles no read", () => {
  expect(
    tooltipFieldOf({
      type: 'LinearAlignmentsDisplay',
      snpCoverageDisplay: {
        type: 'LinearSNPCoverageDisplay',
        displayId: 'c',
        mouseover: 'jexl:get(feature,"score")',
      },
    }),
  ).toBe('')
  expect(
    tooltipFieldOf({
      type: 'LinearSNPCoverageDisplay',
      mouseover: 'jexl:get(feature,"score")',
    }),
  ).toBe('')
})
