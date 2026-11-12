import PluginManager from '@jbrowse/core/PluginManager'
import { fullConfSnapshot, setConf } from '@jbrowse/core/configuration'
import { isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { isObservable } from 'mobx'

import { createFeatureStaticHost } from '../shared/featureStaticHost.ts'
import { createTestEnvironment } from './testEnv.ts'
import { workerDisplayConfig } from './workerDisplayConfig.ts'

const UTR_COLOR = "jexl:get(feature,'strand')>0?'red':'blue'"
const COLOR = "jexl:get(feature,'type')=='gene'?'green':'purple'"
const TOOLTIP = "jexl:get(feature,'product')"
const NAME = "jexl:get(feature,'gene_name')"
const LENGTH_FILTER = 'jexl:feature.end - feature.start > 1000'

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
  ['the default config', {}],
  ['every slot the worker reads set', EVERY_WORKER_SLOT],
  ['an identity color scale', IDENTITY_COLOR],
])('renderSettings under %s', (_, slots) => {
  it('is what the snapshot picker sent, on the display', () => {
    const display = displayWith(slots)
    expect(display.renderSettings).toEqual(
      workerDisplayConfig(fullConfSnapshot(display.configuration), display),
    )
  })

  it('is what the snapshot picker sent, on the static host', () => {
    const host = staticHost(slots)
    expect(host.renderSettings).toEqual(
      workerDisplayConfig(fullConfSnapshot(host.configuration), host),
    )
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
