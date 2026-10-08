import { waitFor } from '@testing-library/react'
import { observable, runInAction } from 'mobx'

import { ConfigurationSchema } from '../configuration/index.ts'
import {
  doAnalytics,
  writeAWSAnalytics,
  writeGAAnalytics,
} from './analytics.ts'

// A rejected analytics promise nobody catches trips the webpack-dev-server
// overlay (it listens for unhandledrejection) with a full-screen error in dev,
// so both writers absorb their own failures. Every call site floats them.
const rootModel = {
  jbrowse: {
    tracks: [],
    assemblies: [],
    plugins: [],
    configuration: {},
  },
  version: '0.0.0-test',
}

let warn: jest.SpyInstance

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
})

test('writeAWSAnalytics resolves when the ping fails', async () => {
  fetchMock.mockRejectOnce(new Error('blocked by client'))

  await expect(
    writeAWSAnalytics(rootModel, Date.now(), undefined),
  ).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalledWith(
    'Failed to write analytics to AWS.',
    expect.any(Error),
  )
})

test('writeAWSAnalytics encodes stat values in the query string', async () => {
  fetchMock.mockResponseOnce('{}')

  await writeAWSAnalytics(
    {
      ...rootModel,
      jbrowse: {
        ...rootModel.jbrowse,
        plugins: [{ name: 'Foo & Bar' }],
      },
    },
    Date.now(),
  )

  const requestedUrl = fetchMock.mock.calls.at(-1)?.[0] as string
  const params = new URL(requestedUrl).searchParams
  expect(params.get('plugin-names')).toBe('Foo & Bar')
})

test('writeAWSAnalytics resolves when reading the model throws', async () => {
  const dead = {
    ...rootModel,
    get jbrowse(): never {
      throw new Error('no longer part of a state tree')
    },
  }

  await expect(writeAWSAnalytics(dead, Date.now())).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()
})

test('writeGAAnalytics injects the tracker script and sends the pageview', async () => {
  const ga = jest.fn()
  window.ga = ga

  await writeGAAnalytics(rootModel, Date.now() - 1000)

  const script = document.head.lastElementChild
  expect(script?.tagName).toBe('SCRIPT')
  expect(ga).toHaveBeenCalledWith(
    'create',
    'UA-7115575-5',
    'auto',
    'jbrowseTracker',
  )
  expect(ga).toHaveBeenCalledWith(
    'jbrowseTracker.send',
    'pageview',
    expect.objectContaining({ metric1: expect.any(Number) }),
  )
  expect(warn).not.toHaveBeenCalled()

  delete window.ga
})

test('writeGAAnalytics resolves when reading the model throws', async () => {
  const dead = {
    ...rootModel,
    get jbrowse(): never {
      throw new Error('no longer part of a state tree')
    },
  }

  await expect(writeGAAnalytics(dead, Date.now())).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalledWith(
    'Failed to write analytics to GA.',
    expect.any(Error),
  )
})

test('doAnalytics pings only once the app reports ready', async () => {
  fetchMock.resetMocks()
  fetchMock.mockResponse('{}')
  const marker = document.createElement('span')
  marker.dataset.appPhase = 'loading'
  document.body.append(marker)

  const configuration = ConfigurationSchema('AnalyticsTest', {
    disableAnalytics: { type: 'boolean', defaultValue: false },
  }).create()
  doAnalytics(
    { ...rootModel, jbrowse: { ...rootModel.jbrowse, configuration } },
    Date.now(),
    undefined,
  )
  await new Promise(resolve => setTimeout(resolve, 100))
  expect(fetchMock).not.toHaveBeenCalled()

  marker.dataset.appPhase = 'ready'
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalled()
  })
  marker.remove()
})

function lastPing() {
  const requestedUrl = fetchMock.mock.calls.at(-1)?.[0] as string
  return new URL(requestedUrl).searchParams
}

function hideTab(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

test('the start report says which view and track types are open', async () => {
  fetchMock.resetMocks()
  fetchMock.mockResponse('{}')

  await writeAWSAnalytics(
    {
      ...rootModel,
      session: {
        sessionTracks: [],
        views: [
          {
            type: 'LinearGenomeView',
            tracks: [{ type: 'FeatureTrack' }, { type: 'FeatureTrack' }],
          },
        ],
      },
    },
    Date.now(),
  )

  const params = lastPing()
  expect(params.get('event')).toBe('start')
  expect(params.get('sid')).toBeTruthy()
  expect(params.get('view-types')).toBe('LinearGenomeView:1')
  expect(params.get('open-track-types')).toBe('FeatureTrack:2')
})

test('hiding the tab reports what the session held, under the start report’s sid', async () => {
  fetchMock.resetMocks()
  fetchMock.mockResponse('{}')
  const configuration = ConfigurationSchema('AnalyticsEndTest', {
    disableAnalytics: { type: 'boolean', defaultValue: false },
  }).create()
  const session = observable({
    sessionTracks: [] as { type: string }[],
    views: [] as { type: string; tracks?: { type: string }[] }[],
  })
  const model = {
    ...rootModel,
    jbrowse: { ...rootModel.jbrowse, configuration },
    session,
  }
  await writeAWSAnalytics(model, Date.now())
  const sid = lastPing().get('sid')

  doAnalytics(model, Date.now(), undefined)
  runInAction(() => {
    session.views.push({
      type: 'LinearGenomeView',
      tracks: [{ type: 'AlignmentsTrack' }],
    })
    session.sessionTracks.push({ type: 'VariantTrack' })
  })
  runInAction(() => {
    session.views[0]!.tracks = []
  })
  hideTab('hidden')

  await waitFor(() => {
    expect(lastPing().get('event')).toBe('end')
  })
  const params = lastPing()
  expect(params.get('sid')).toBe(sid)
  expect(params.get('seq')).toBe('1')
  expect(params.get('seen-track-types')).toBe('AlignmentsTrack')
  expect(params.get('open-track-types')).toBe('')
  expect(params.get('view-types')).toBe('LinearGenomeView:1')
  expect(params.get('session-tracks-count')).toBe('1')
  expect(params.get('sessionTrack-types-VariantTrack')).toBe('1')
  expect(params.get('jb2')).toBe('true')

  // nothing changed and under a minute passed, so a second hide stays quiet
  const calls = fetchMock.mock.calls.length
  hideTab('visible')
  hideTab('hidden')
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(fetchMock.mock.calls.length).toBe(calls)
})

test('a config that disables analytics stops the end reports', async () => {
  fetchMock.resetMocks()
  fetchMock.mockResponse('{}')
  const configuration = ConfigurationSchema('AnalyticsOptOutTest', {
    disableAnalytics: { type: 'boolean', defaultValue: true },
  }).create()

  doAnalytics(
    {
      ...rootModel,
      jbrowse: { ...rootModel.jbrowse, configuration },
      session: { sessionTracks: [], views: [{ type: 'CircularView' }] },
    },
    Date.now(),
    undefined,
  )
  hideTab('visible')
  hideTab('hidden')
  await new Promise(resolve => setTimeout(resolve, 50))

  expect(fetchMock).not.toHaveBeenCalled()
})
