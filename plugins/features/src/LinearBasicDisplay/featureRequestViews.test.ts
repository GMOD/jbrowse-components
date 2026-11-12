import PluginManager from '@jbrowse/core/PluginManager'
import { setConf } from '@jbrowse/core/configuration'
import { isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { isObservable } from 'mobx'

import {
  FEATURE_DESCRIPTION_FIELD,
  FEATURE_NAME_FIELD,
} from '../RenderFeatureDataRPC/featureNameField.ts'
import { DEFAULT_TOOLTIP } from '../RenderFeatureDataRPC/featureTooltip.ts'
import {
  DEFAULT_FEATURE_HEIGHT,
  GENE_GLYPH_DEFAULTS,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import { createFeatureStaticHost } from '../shared/featureStaticHost.ts'
import { createTestEnvironment } from './testEnv.ts'

const UTR_COLOR = "jexl:get(feature,'strand')>0?'red':'blue'"
const COLOR = "jexl:get(feature,'type')=='gene'?'green':'purple'"
const TOOLTIP = "jexl:get(feature,'product')"
const NAME = "jexl:get(feature,'gene_name')"
const LENGTH_FILTER = 'jexl:feature.end - feature.start > 1000'

const DEFAULTS = {
  ...GENE_GLYPH_DEFAULTS,
  tooltip: DEFAULT_TOOLTIP,
  filter: [],
  featureHeight: DEFAULT_FEATURE_HEIGHT,
  color: { value: undefined, field: '' },
  labels: { name: FEATURE_NAME_FIELD, description: FEATURE_DESCRIPTION_FIELD },
}

const EVERY_WORKER_SLOT = {
  transcripts: {
    types: ['mRNA', 'ncRNA'],
    field: 'canonical',
    sort: ['MANE_Select'],
  },
  containers: { types: ['polyprotein'] },
  utrs: { encoding: { color: { value: UTR_COLOR } } },
  mark: { height: 7 },
  tooltip: { field: TOOLTIP },
  labels: {
    name: { field: NAME },
    description: { field: 'product' },
    subfeatures: { placement: 'below' },
  },
  filter: [{ field: 'score', gte: 100 }, LENGTH_FILTER],
  encoding: { color: { value: COLOR, field: 'biotype' } },
  facet: { field: 'biotype' },
}

const IDENTITY_COLOR = {
  encoding: { color: { field: 'itemRgb', scale: { type: 'identity' } } },
}

function staticHost(display: Record<string, unknown>) {
  const pluginManager = new PluginManager([])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return createFeatureStaticHost({ id: 'test', display, pluginManager })
}

function displayWith(slots: Record<string, unknown>) {
  const { display } = createTestEnvironment().createDisplay()
  for (const [slot, value] of Object.entries(slots)) {
    // a table of slot names, which setConf's narrowing cannot follow
    setConf(display, slot as 'filter', value as never)
  }
  return display
}

function observablesIn(value: unknown): unknown[] {
  return isObservable(value) || isStateTreeNode(value)
    ? [value]
    : typeof value === 'object' && value !== null
      ? Object.values(value).flatMap(observablesIn)
      : []
}

describe.each([
  ['the default config', {}, DEFAULTS],
  [
    'every slot the worker reads set, callbacks raw',
    EVERY_WORKER_SLOT,
    {
      subfeatureLabels: 'below',
      transcriptTypes: ['mRNA', 'ncRNA'],
      canonicalTranscriptField: 'canonical',
      canonicalTranscriptTags: ['MANE_Select'],
      containerTypes: ['polyprotein'],
      utrColor: UTR_COLOR,
      tooltip: TOOLTIP,
      filter: [
        { field: 'score', gte: 100 },
        { field: LENGTH_FILTER, equal: true },
      ],
      featureHeight: 7,
      color: { value: COLOR, field: 'biotype' },
      labels: { name: NAME, description: 'product' },
      facetField: 'biotype',
    },
  ],
  [
    'an identity color scale',
    IDENTITY_COLOR,
    {
      ...DEFAULTS,
      color: {
        value: undefined,
        field: 'itemRgb',
        itemRgbOn: true,
        identityField: 'itemRgb',
      },
    },
  ],
])('renderSettings under %s', (_, slots, expected) => {
  it('is each slot the worker reads, on the display', () => {
    expect(displayWith(slots).renderSettings).toEqual(expected)
  })

  it('is each slot the worker reads, on the static host', () => {
    expect(staticHost(slots).renderSettings).toEqual(expected)
  })

  it('is plain data that survives a structured clone', () => {
    for (const settings of [
      displayWith(slots).renderSettings,
      staticHost(slots).renderSettings,
    ]) {
      expect(observablesIn(settings)).toEqual([])
      expect(structuredClone(settings)).toEqual(settings)
    }
  })
})
