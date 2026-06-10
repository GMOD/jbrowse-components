import { createTestSession } from '@jbrowse/web/testUtils'

import { doSubmit } from './components/doSubmit.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function addAsm(session: ReturnType<typeof createTestSession>, name: string) {
  session.addAssemblyConf({
    name,
    sequence: {
      trackId: `ref-${name}`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctg',
            uniqueId: name,
            start: 0,
            end: 10,
            seq: 'acgtacgtac',
          },
        ],
      },
    },
  })
}

test('adding a track for an assembly not open in the view notifies the user', () => {
  const session = createTestSession()
  addAsm(session, 'asmA')
  addAsm(session, 'asmB')

  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'asmA', refName: 'ctg', start: 0, end: 10 },
    ],
  })

  const widget = session.addWidget('AddTrackWidget', 'addTrackWidget', {
    view: view.id,
  })
  widget.setTrackData({ uri: 'foo.bam', locationType: 'UriLocation' })
  widget.setAssembly('asmB')

  doSubmit({ model: widget })

  // track is still added to the session...
  expect(session.tracks.some(t => t.assemblyNames?.[0] === 'asmB')).toBe(true)
  // ...but not shown in the asmA view, and the user is told why
  expect(view.tracks.length).toBe(0)
  expect(
    session.snackbarMessages.some(
      m => m.level === 'warning' && m.message.includes('asmB'),
    ),
  ).toBe(true)
})
