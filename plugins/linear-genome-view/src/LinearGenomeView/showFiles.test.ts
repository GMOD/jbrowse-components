import { createTestSession } from '@jbrowse/web/testUtils'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function setup() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [{ type: 'LinearGenomeView', displayedRegions: [], tracks: [] }],
    },
  }) as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'ctgA', start: 0, end: 1000, seq: '' },
        ],
      },
    },
  })
  const view = session.views[0]
  await view.navToLocString('ctgA:1..100', 'volvox')
  return { session, view }
}

const bed = (name: string) => new File(['ctgA\t1\t10\tx\n'], name)

const shownIds = (view: { tracks: { configuration: { trackId: string } }[] }) =>
  view.tracks.map(t => t.configuration.trackId)

test('each data file becomes a shown session track on the view assembly', async () => {
  const { session, view } = await setup()
  const ids = await view.showFiles([bed('a.bed'), bed('b.bed')])
  expect(ids).toHaveLength(2)
  expect(shownIds(view)).toEqual(ids)
  expect(session.sessionTracks.map((t: any) => t.assemblyNames)).toEqual([
    ['volvox'],
    ['volvox'],
  ])
  for (const id of ids) {
    view.hideTrack(id)
  }
})

test('a file of no known type adds nothing from the selection', async () => {
  const { session, view } = await setup()
  await expect(
    view.showFiles([bed('a.bed'), bed('notes.unknownext')]),
  ).rejects.toThrow('could not infer a track type')
  expect(session.sessionTracks).toHaveLength(0)
})
