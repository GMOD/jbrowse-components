import { buildMultiTrackMenuItems } from '@jbrowse/core/ui/multiTrackMenuItems'
import { getEnv } from '@jbrowse/core/util'

import { createTestSessionAsync } from '../rootModel/test_util.ts'

import type { AnyTrackConfig } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

jest.mock('../makeWorkerInstance', () => () => {})

const seq = `${'C'.repeat(20)}GATTACA${'C'.repeat(30)}TTTAAA${'C'.repeat(37)}`

function makeSession() {
  return createTestSessionAsync({
    jbrowseConfig: {
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'FromConfigSequenceAdapter',
              features: [
                { refName: 'ctgA', uniqueId: 'ctgA', start: 0, end: 100, seq },
              ],
            },
          },
        },
      ],
    },
    sessionSnapshot: {
      views: [{ id: 'view1', type: 'LinearGenomeView' }],
    },
  })
}

type Session = Awaited<ReturnType<typeof makeSession>>

// what the sequence search panel's addReferenceScanTrack writes
function addScanTrack(session: Session, trackId: string, search: string) {
  session.addSessionTrackConf({
    trackId,
    name: trackId,
    assemblyNames: ['volvox'],
    type: 'FeatureTrack',
    adapter: { type: 'SequenceSearchAdapter', search, searchReverse: false },
  })
}

interface ConfirmProps {
  tracks: AnyTrackConfig[]
  onClose: (result?: {
    name: string
    tracks: AnyTrackConfig[]
    kind: 'feature' | 'quantitative'
  }) => void
}

async function stackFromTrackSelector() {
  const session = await makeSession()
  const { pluginManager } = getEnv(session)
  addScanTrack(session, 'gattaca', 'GATTACA')
  addScanTrack(session, 'tttaaa', 'TTTAAA')
  const selector = session.addWidget('HierarchicalTrackSelectorWidget', 'hts', {
    view: session.views[0],
  }) as unknown as Parameters<typeof buildMultiTrackMenuItems>[1]['model'] & {
    addToSelection: (ids: string[]) => void
  }
  selector.addToSelection(['gattaca', 'tttaaa'])
  const item = buildMultiTrackMenuItems(pluginManager, {
    session,
    model: selector,
  }).find(
    (i: MenuItem) => 'label' in i && i.label === 'Create multi-row track...',
  )
  if (!item || !('onClick' in item)) {
    throw new Error('no "Create multi-row track..." row')
  }
  item.onClick()
  const props = session.queueOfDialogs.at(-1)![1] as unknown as ConfirmProps
  expect(props.tracks.map(t => t.trackId)).toEqual(['gattaca', 'tttaaa'])
  props.onClose({ name: 'scans', tracks: props.tracks, kind: 'feature' })
  const stacked = session.tracks.find(t => t.name === 'scans')!
  return { session, adapterConfig: stacked.adapter as Record<string, unknown> }
}

test('a multi-row track stacked from sequence-search tracks lists the reference contigs', async () => {
  const { session, adapterConfig } = await stackFromTrackSelector()
  expect(adapterConfig.type).toBe('MultiWiggleAdapter')
  const map = await session.assemblyManager
    .get('volvox')!
    .getRefNameMapForAdapter(adapterConfig, { sessionId: 'scans' })
  expect(map).toMatchObject({ ctgA: 'ctgA' })
})

test('a multi-row track stacked from sequence-search tracks finds each member hit, under its row', async () => {
  const { session, adapterConfig } = await stackFromTrackSelector()
  const features = (await session.rpcManager.call('scans', 'CoreGetFeatures', {
    adapterConfig,
    regions: [{ refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' }],
  })) as { get: (k: string) => unknown }[]
  expect(
    features.map(f => [f.get('source'), f.get('start'), f.get('end')]),
  ).toEqual(
    expect.arrayContaining([
      ['gattaca', 20, 27],
      ['tttaaa', 57, 63],
    ]),
  )
})
