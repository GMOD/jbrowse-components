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

test('a locstring and an object without an assembly both land on the view assembly', async () => {
  const { session, view } = await setup()
  view.setHighlights([
    'ctgA:11..20',
    { refName: 'ctgA', start: 50, end: 60, label: 'mine' },
  ])
  expect(session.highlights.map((h: any) => ({ ...h }))).toEqual([
    { assemblyName: 'volvox', refName: 'ctgA', start: 10, end: 20 },
    {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 50,
      end: 60,
      label: 'mine',
    },
  ])
  expect(view.highlights).toHaveLength(2)
})

test('an entry naming no region writes none of them', async () => {
  const { session, view } = await setup()
  view.setHighlights(['ctgA:11..20'])
  expect(() => view.setHighlights(['ctgA:1..5', 'ctgA'])).toThrow(
    'not a region to highlight',
  )
  expect(session.highlights).toHaveLength(1)
})
