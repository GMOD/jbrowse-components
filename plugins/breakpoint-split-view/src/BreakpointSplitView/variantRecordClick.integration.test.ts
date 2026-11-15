import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import { variantWidgetOpener } from './components/overlayUtils.tsx'

import type { BreakpointViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'volvox-ctgA',
          start: 0,
          end: 10_000,
          seq: 'a'.repeat(10_000),
        },
      ],
    },
  },
}

const callsConf = {
  trackId: 'calls',
  type: 'VariantTrack',
  name: 'calls',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'FromConfigAdapter',
    features: [
      {
        uniqueId: 'bnd1',
        refName: 'ctgA',
        start: 99,
        end: 100,
        type: 'breakend',
        REF: 'A',
        ALT: ['A[ctgA:5000['],
        QUAL: 60,
        samples: { S1: { GT: ['0/1'] } },
      },
    ],
  },
}

test.each(['LinearVariantDisplay', 'LinearMarkDisplay'])(
  'a breakpoint click on a call drawn by a %s opens the widget on the full record',
  async displayType => {
    const session = createTestSession()
    session.addAssemblyConf(assembly)
    session.addTrackConf(callsConf)
    const view = (await session.launchView('BreakpointSplitView', {
      views: [
        { assembly: 'volvox', loc: 'ctgA:1-1000' },
        { assembly: 'volvox', loc: 'ctgA:4500-5500' },
      ],
    })) as BreakpointViewModel
    view.setWidth(800)
    await when(() => view.initialized, { timeout: 20000 })
    const row = view.views[0]!
    await row.launchTrack('calls', {}, { type: displayType })
    const display = row.tracks[0]!.displays[0]!
    expect(display.type).toBe(displayType)
    const [slim] = await session.rpcManager.call(
      'test',
      'BreakpointGetFeatures',
      {
        adapterConfig: callsConf.adapter,
        regions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
        ],
      },
    )
    expect(slim!.get('REF')).toBeUndefined()

    variantWidgetOpener(display, slim!)()
    await when(() => session.widgets.has('variantFeature'), { timeout: 20000 })
    expect(session.widgets.get('variantFeature')).toHaveProperty(
      'featureData',
      expect.objectContaining({
        uniqueId: 'bnd1',
        REF: 'A',
        QUAL: 60,
        samples: { S1: { GT: ['0/1'] } },
      }),
    )
  },
  60000,
)
