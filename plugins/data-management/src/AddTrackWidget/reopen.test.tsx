// @ts-expect-error
import { createTestSession } from '@jbrowse/web/src/rootModel/index.js'

jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

function addAsm(session: ReturnType<typeof createTestSession>, name: string) {
  session.addAssemblyConf({
    name,
    sequence: {
      trackId: `ref-${name}`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctg', uniqueId: name, start: 0, end: 10, seq: 'acgtacgtac' },
        ],
      },
    },
  })
}

test('reopening add-track widget for a different view resets stale assembly', () => {
  const session = createTestSession()
  addAsm(session, 'asmA')
  addAsm(session, 'asmB')

  const viewA = session.addView('LinearGenomeView', {
    displayedRegions: [{ assemblyName: 'asmA', refName: 'ctg', start: 0, end: 10 }],
  })
  const viewB = session.addView('LinearGenomeView', {
    displayedRegions: [{ assemblyName: 'asmB', refName: 'ctg', start: 0, end: 10 }],
  })

  // open from view A and enter some data, then close without submitting
  const w1 = session.addWidget('AddTrackWidget', 'addTrackWidget', {
    view: viewA.id,
  })
  expect(w1.assembly).toBe('asmA')
  w1.setTrackData({ uri: 'foo.bam', locationType: 'UriLocation' })
  w1.setAssembly('asmA')
  session.showWidget(w1)
  session.hideWidget(w1)

  // reopen from view B: form must reset so the track targets view B's assembly
  const w2 = session.addWidget('AddTrackWidget', 'addTrackWidget', {
    view: viewB.id,
  })
  expect(w2.assembly).toBe('asmB')
  expect(w2.altAssemblyName).toBe('')
  expect(w2.trackData).toBeUndefined()
})

test('reopening add-track widget for the same view preserves entered data', () => {
  const session = createTestSession()
  addAsm(session, 'asmA')

  const viewA = session.addView('LinearGenomeView', {
    displayedRegions: [{ assemblyName: 'asmA', refName: 'ctg', start: 0, end: 10 }],
  })

  const w1 = session.addWidget('AddTrackWidget', 'addTrackWidget', {
    view: viewA.id,
  })
  w1.setTrackData({ uri: 'foo.bam', locationType: 'UriLocation' })
  session.showWidget(w1)
  session.hideWidget(w1)

  const w2 = session.addWidget('AddTrackWidget', 'addTrackWidget', {
    view: viewA.id,
  })
  expect(w2.trackData).toEqual({ uri: 'foo.bam', locationType: 'UriLocation' })
})
