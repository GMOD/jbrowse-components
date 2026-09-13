import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'

type WebSession = ReturnType<typeof createTestSession>

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

let openViews: { session: WebSession; view: LinearSyntenyViewModel }[] = []

afterEach(() => {
  for (const { session, view } of openViews) {
    session.removeView(view)
  }
  openViews = []
  fetchMock.resetMocks()
})

const assembly = (name: string) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: `${name}-ctgA`,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        },
      ],
    },
  },
})

const remoteAssembly = (name: string) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'ChromSizesAdapter',
      chromSizesLocation: {
        uri: `${name}.chrom.sizes`,
        locationType: 'UriLocation',
      },
    },
  },
})

async function openStack() {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox0'))
  session.addAssemblyConf(assembly('volvox1'))
  session.addAssemblyConf(remoteAssembly('slow'))
  session.addAssemblyConf(remoteAssembly('gone'))
  session.addSessionTrackConf({
    type: 'SyntenyTrack',
    trackId: 'synteny0',
    name: 'synteny0',
    assemblyNames: ['volvox0', 'volvox1'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
      queryAssembly: 'volvox0',
      targetAssembly: 'volvox1',
    },
  })
  const view = (await session.launchView('LinearSyntenyView', {
    views: [{ assembly: 'volvox0' }, { assembly: 'volvox1' }],
    tracks: [['synteny0']],
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  openViews.push({ session, view })
  await when(() => view.pendingLaunch === undefined)
  await when(() => view.levels[0]!.linearSyntenyDisplays.length === 1)
  return view
}

const topBand = (view: LinearSyntenyViewModel) =>
  view.levels[0]!.linearSyntenyDisplays[0]!

// A row appended from a remote assembly — a GenArk hub genome — is loading for
// as long as its host takes. The bands between the rows that are already up
// have nothing to wait for.
test('a row still loading holds back only the band that touches it', async () => {
  jest.spyOn(console, 'error').mockImplementation()
  const view = await openStack()
  fetchMock.mockResponse(async req =>
    req.url.includes('slow.chrom.sizes') ? new Promise(() => {}) : '',
  )
  expect(topBand(view).connectedViews).toBeDefined()

  void view.appendRow({ assembly: 'slow' })

  expect(view.views[2]!.initialized).toBe(false)
  expect(topBand(view).connectedViews).toBeDefined()
  expect(view.showLoading).toBe(false)
  expect(view.showImportForm).toBe(false)
})

// A row whose assembly fails reports it in its own place in the stack. The
// view's import form is for a stack with nothing left to show.
test('a failed row leaves the stack on screen', async () => {
  jest.spyOn(console, 'error').mockImplementation()
  const view = await openStack()
  fetchMock.mockResponse(async req =>
    req.url.includes('gone.chrom.sizes')
      ? { status: 404, body: 'not found' }
      : '',
  )

  void view.appendRow({ assembly: 'gone' })
  await when(() => !!view.views[2]!.error)

  expect(view.showImportForm).toBe(false)
  expect(view.showLoading).toBe(false)
  expect(view.status).toEqual({ type: 'ready' })
  expect(topBand(view).connectedViews).toBeDefined()
  // an export still refuses a stack with a broken row rather than hanging
  expect(view.error).toBe(view.views[2]!.error)
})

test('every row failing is the import form', async () => {
  jest.spyOn(console, 'error').mockImplementation()
  const session = createTestSession()
  session.addAssemblyConf(remoteAssembly('gone'))
  session.addAssemblyConf(remoteAssembly('gone2'))
  fetchMock.mockResponse(async () => ({ status: 404, body: 'not found' }))
  const view = (await session.launchView('LinearSyntenyView', {
    views: [
      {
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'gone', refName: 'ctgA', start: 0, end: 100 },
        ],
      },
      {
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'gone2', refName: 'ctgA', start: 0, end: 100 },
        ],
      },
    ],
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  openViews.push({ session, view })

  await when(() => view.views.every(v => !!v.error))
  expect(view.showImportForm).toBe(true)
  expect(view.status).toMatchObject({ type: 'error' })
})
