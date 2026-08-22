import { createTestSession } from '@jbrowse/web/testUtils'

import { doSubmit } from './components/doSubmit.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const SEQ = (name: string) => ({
  trackId: `ref-${name}`,
  type: 'ReferenceSequenceTrack',
  adapter: {
    type: 'FromConfigSequenceAdapter',
    features: [
      { refName: 'ctg', uniqueId: name, start: 0, end: 10, seq: 'acgtacgtac' },
    ],
  },
})

// The widget takes its assembly from the containing view, and the read panel of
// a read-vs-ref view displays an assembly the launcher synthesized — so a user
// opening a file there chooses nothing and lands on a temporary assembly. Adding
// it to `sessionTracks` leaves an entry naming an assembly that no longer exists
// the moment the view closes, once per file, in the snapshot the user saves and
// shares: ADR-084's leak, reached through the widget instead of a launcher.
function readVsRefPanel() {
  const session = createTestSession()
  session.addAssemblyConf({ name: 'asmA', sequence: SEQ('asmA') })
  session.addTemporaryAssembly({
    name: 'readvsref',
    sequence: SEQ('readvsref'),
  })
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'readvsref', refName: 'ctg', start: 0, end: 10 },
    ],
  })
  const widget = session.addWidget('AddTrackWidget', 'addTrackWidget', {
    view: view.id,
  })
  widget.setTrackData({ uri: 'foo.bam', locationType: 'UriLocation' })
  return { session, view, widget }
}

test('the widget offers no choice of assembly here', () => {
  expect(readVsRefPanel().widget.assembly).toBe('readvsref')
})

test('a file opened in a synthesized-assembly panel leaves no session entry', async () => {
  const { session, view, widget } = readVsRefPanel()

  doSubmit({ model: widget })
  // the show goes through the async launchTrack path now
  await new Promise(resolve => setTimeout(resolve, 0))

  expect(session.sessionTracks).toHaveLength(0)
  expect(view.tracks).toHaveLength(1)
  // the config is on the track, so it goes out with the view
  expect(view.tracks[0]!.configuration.trackId).toContain('foo.bam')
  expect(session.getTrackById(view.tracks[0]!.configuration.trackId)).toBe(
    undefined,
  )
})

// The check the previous pass built reported this flow as a contract violation,
// telling a developer to reach for `inlineConf` — which is what the flow now
// does, so there is nothing left to report. A violation surviving here would
// fail this test through the jest gate rather than through an assertion.
test('and reports no contract violation', () => {
  doSubmit({ model: readVsRefPanel().widget })
  expect(takeContractReports()).toEqual([])
})

test('an ordinary assembly still goes to a session list', () => {
  const session = createTestSession()
  session.addAssemblyConf({ name: 'asmA', sequence: SEQ('asmA') })
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'asmA', refName: 'ctg', start: 0, end: 10 },
    ],
  })
  const widget = session.addWidget('AddTrackWidget', 'addTrackWidget', {
    view: view.id,
  })
  widget.setTrackData({ uri: 'foo.bam', locationType: 'UriLocation' })

  doSubmit({ model: widget })

  expect(session.sessionTracks).toHaveLength(1)
})
