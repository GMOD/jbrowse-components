import { createJbApi } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from '../corePlugins.ts'
import rootModelFactory from '../rootModel/rootModel.ts'
import sessionModelFactory from '../sessionModel/sessionModel.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// What an agent reads off a mark display, as it reaches one through jb.
interface MarkPlotDisplay {
  configuration: AnyConfigurationModel
  markPlot: Record<string, unknown>
  autoscaleGroup: string | undefined
  plotProblems(plot: unknown): string[]
  applyDisplaySettings(settings: Record<string, unknown>): {
    failed: unknown[]
  }
}

jest.mock('../makeWorkerInstance.ts', () => ({
  __esModule: true,
  default: () => {},
}))
jest.mock('../ipc.ts', () => ({ invokeIpc: jest.fn() }))

function appWithTwoScoreTracks() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  const track = (trackId: string) => ({
    type: 'FeatureTrack',
    trackId,
    assemblyNames: ['volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  const root = rootModelFactory({ pluginManager, sessionModelFactory }).create(
    {
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
        assemblies: [
          {
            name: 'volvox',
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'volvox_refseq',
              adapter: {
                type: 'FromConfigSequenceAdapter',
                features: [
                  { refName: 'ctgA', uniqueId: 'ctgA', start: 0, end: 1000 },
                ],
              },
            },
          },
        ],
        tracks: [track('a'), track('b')],
      },
    },
    { pluginManager },
  )
  pluginManager.setRootModel(root)
  pluginManager.configure()
  root.setSession({ name: 'test' })
  root.session!.addView('LinearGenomeView', {})
  return createJbApi(pluginManager)
}

test('an agent reads a plot as JSON, checks a draft, and applies it to two tracks', async () => {
  const jb = appWithTwoScoreTracks()
  const view = jb.view() as LinearGenomeViewModel
  const settings = {
    type: 'LinearMarkDisplay',
    marks: [{ mark: 'bar', encoding: { y: 'score' } }],
  }
  await view.launchTrack('a', {}, settings)
  await view.launchTrack('b', {}, settings)
  const a = jb.trackModel('a').activeDisplay as unknown as MarkPlotDisplay
  const b = jb.trackModel('b').activeDisplay as unknown as MarkPlotDisplay

  const slots = jb.describeSlots(a.configuration)
  expect(slots.marks).toMatchObject({
    type: 'array',
    items: {
      type: 'Mark',
      slots: {
        mark: { type: 'stringEnum' },
        encoding: { type: 'MarkEncoding', slots: { y: {} } },
      },
    },
  })
  expect(Object.keys(slots.transform!.items!.oneOf!)).toEqual(
    expect.arrayContaining(['filter', 'bin', 'aggregate', 'coverage', 'mate']),
  )
  expect(slots.scales).toMatchObject({
    type: 'Scales',
    slots: { y: { type: 'ValueScale' } },
  })

  const plot = structuredClone(a.markPlot) as {
    marks: Record<string, unknown>[]
    scales?: unknown
  }
  plot.marks.push({
    mark: 'bar',
    transform: [
      { type: 'bin', step: 'auto' },
      { type: 'aggregate', ops: [{ op: 'count' }] },
    ],
    minBpPerPx: 100,
  })
  plot.scales = { y: { autoscaleGroup: 'shared', title: 'Score' } }
  expect(a.plotProblems(plot)).toEqual([])
  expect(a.applyDisplaySettings(plot).failed).toEqual([])
  expect(b.applyDisplaySettings(plot).failed).toEqual([])
  expect(b.markPlot).toEqual(a.markPlot)
  expect(a.markPlot).toMatchObject({
    marks: [{ encoding: { y: 'score' } }, { minBpPerPx: 100 }],
    scales: { y: { autoscaleGroup: 'shared', title: 'Score' } },
  })
  expect(a.autoscaleGroup).toBe('shared')
})
