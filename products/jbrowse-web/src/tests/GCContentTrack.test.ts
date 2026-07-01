import { readConfObject } from '@jbrowse/core/configuration'

import { createTestSession } from '../rootModel/index.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

jest.mock('../makeWorkerInstance', () => () => {})

// The "Add GC content track" menu action (on both the
// LinearReferenceSequenceDisplay and the gccontent LinearGCContentDisplay)
// spins up a standalone GCContentTrack session track whose GCContentAdapter
// wraps the reference track's own sequence adapter.
function makeSession(displays: { id: string; type: string }[]) {
  return createTestSession({
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
                {
                  refName: 'ctgA',
                  uniqueId: 'firstId',
                  start: 0,
                  end: 100,
                  seq: 'A'.repeat(100),
                },
              ],
            },
          },
        },
      ],
    },
    sessionSnapshot: {
      views: [
        {
          id: 'view1',
          type: 'LinearGenomeView',
          tracks: [
            {
              id: 'track1',
              type: 'ReferenceSequenceTrack',
              configuration: 'volvox_refseq',
              displays,
            },
          ],
        },
      ],
    },
  })
}

function findGCTrack(session: ReturnType<typeof makeSession>) {
  const added = session.tracks.find(
    t => readConfObject(t, 'type') === 'GCContentTrack',
  )
  if (!added) {
    throw new Error('no GCContentTrack was added')
  }
  return added
}

test('LinearReferenceSequenceDisplay adds a standalone GCContentTrack', () => {
  const session = makeSession([
    { id: 'display1', type: 'LinearReferenceSequenceDisplay' },
  ])
  const display = session.views[0].tracks[0].displays[0]
  display.addGCContentTrack()

  const added = findGCTrack(session)
  expect(readConfObject(added, 'assemblyNames')).toEqual(['volvox'])
  expect(readConfObject(added, ['adapter', 'type'])).toBe('GCContentAdapter')
  // the GCContentAdapter wraps the reference track's own sequence adapter
  expect(readConfObject(added, ['adapter', 'sequenceAdapter', 'type'])).toBe(
    'FromConfigSequenceAdapter',
  )
  // and it is shown in the view
  expect(
    session.views[0].tracks.some(
      (t: { configuration: AnyConfigurationModel }) =>
        readConfObject(t.configuration, 'type') === 'GCContentTrack',
    ),
  ).toBe(true)
})

test('LinearGCContentDisplay carries its current params onto the new track', () => {
  const session = makeSession([
    { id: 'display1', type: 'LinearReferenceSequenceDisplay' },
    { id: 'display2', type: 'LinearGCContentDisplay' },
  ])
  const display = session.views[0].tracks[0].displays[1]
  display.setGCContentParams({ windowSize: 50, windowDelta: 10 })
  display.setGCMode('skew')
  display.addGCContentTrack()

  const added = findGCTrack(session)
  expect(readConfObject(added, 'name')).toBe('GC skew')
  const trackDisplay = added.displays[0]
  expect(readConfObject(trackDisplay, 'type')).toBe(
    'LinearGCContentTrackDisplay',
  )
  expect(readConfObject(trackDisplay, 'windowSize')).toBe(50)
  expect(readConfObject(trackDisplay, 'windowDelta')).toBe(10)
  expect(readConfObject(trackDisplay, 'gcMode')).toBe('skew')
})

test('hierarchical track selector menu offers "Add GC content track" on refseq', () => {
  const session = makeSession([
    { id: 'display1', type: 'LinearReferenceSequenceDisplay' },
  ])
  // the track selector sources the refseq config from the assembly, not from
  // session.tracks
  const refseqConf =
    session.assemblyManager.get('volvox')!.configuration.sequence
  const items = session.getTrackListMenuItems(refseqConf, session.views[0])
  const addGc = items.find(
    item => 'label' in item && item.label === 'Add GC content track',
  )
  expect(addGc).toBeTruthy()
  if (addGc && 'onClick' in addGc) {
    addGc.onClick()
  }
  const added = findGCTrack(session)
  expect(readConfObject(added, 'assemblyNames')).toEqual(['volvox'])
  expect(readConfObject(added, ['adapter', 'sequenceAdapter', 'type'])).toBe(
    'FromConfigSequenceAdapter',
  )
})

test('in-view track menu offers "Add GC content track" on refseq', () => {
  const session = makeSession([
    { id: 'display1', type: 'LinearReferenceSequenceDisplay' },
  ])
  const refseqConf =
    session.assemblyManager.get('volvox')!.configuration.sequence
  const items = session.getTrackActionMenuItems({
    config: refseqConf,
    effectiveConfig: {},
    view: session.views[0],
  })
  const trackActions = items.find(
    item => 'label' in item && item.label === 'Track actions',
  )
  const subMenu = trackActions && 'subMenu' in trackActions ? trackActions.subMenu : []
  expect(
    subMenu.some(
      item => 'label' in item && item.label === 'Add GC content track',
    ),
  ).toBe(true)
})

test('standalone GCContentTrack display does not double-wrap its adapter', () => {
  const session = makeSession([
    { id: 'display1', type: 'LinearReferenceSequenceDisplay' },
  ])
  // addGCContentTrack already shows the new track in the view
  session.views[0].tracks[0].displays[0].addGCContentTrack()

  const shown = session.views[0].tracks.find(
    (t: { configuration: AnyConfigurationModel }) =>
      readConfObject(t.configuration, 'type') === 'GCContentTrack',
  )!
  // the LinearGCContentTrackDisplay's adapterConfig must apply display params
  // to the track's existing GCContentAdapter, not wrap it in another one
  const { adapterConfig } = shown.displays[0]
  expect(adapterConfig.type).toBe('GCContentAdapter')
  expect(adapterConfig.sequenceAdapter.type).toBe('FromConfigSequenceAdapter')
})
