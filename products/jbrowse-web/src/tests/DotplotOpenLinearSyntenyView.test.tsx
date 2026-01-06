import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { configure } from 'mobx'

import { handleRequest } from './generateReadBuffer'
import { getPluginManager, setup } from './util'
import configSnapshot from '../../test_data/grape_peach_synteny/config.json'

setup()

console.warn = jest.fn()
console.error = jest.fn()

configure({ disableErrorBoundaries: true })

const getFile = (url: string) => {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/grape_peach_synteny/${cleanUrl}`
  return new LocalFile(require.resolve(`../../${filePath}`))
}

jest.mock('../makeWorkerInstance', () => () => {})

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  return `${url}`.includes('jb2=true')
    ? new Response('{}')
    : handleRequest(() => getFile(`${url}`), args)
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

test('Open linear synteny view from dotplot view', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  // Create a DotplotView with a synteny track
  const dotplotView = session.addView('DotplotView', {
    init: {
      views: [{ assembly: 'peach' }, { assembly: 'grape' }],
      tracks: ['subset'],
    },
  })
  dotplotView.setWidth(800)

  // Wait for the dotplot view to initialize
  await waitFor(
    () => {
      expect(dotplotView.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(dotplotView.tracks.length).toBe(1)
  expect(session.views.length).toBe(1)

  // Simulate coordinates for a selection (mousedown and mouseup positions)
  // The onDotplotView action takes pixel coordinates as [x, y] tuples
  // The selection needs to be > 3 pixels in both dimensions
  const mousedown: [number, number] = [100, 100]
  const mouseup: [number, number] = [300, 300]

  // Call the action that "Open linear synteny view" triggers
  // This is the fix we're testing - it should not throw
  // "Cannot add an object to a state tree if it is already part of the same or another state tree"
  dotplotView.onDotplotView(mousedown, mouseup)

  // Verify that a LinearSyntenyView was created
  await waitFor(
    () => {
      expect(session.views.length).toBe(2)
    },
    { timeout: 10000 },
  )

  const syntenyView = session.views[1]!
  expect(syntenyView.type).toBe('LinearSyntenyView')

  // Verify the synteny view has the tracks from the dotplot
  expect(syntenyView.levels[0]?.tracks.length).toBe(1)
}, 50000)

test('Open linear synteny view from dotplot preserves track configuration', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  // Create a DotplotView with a synteny track
  const dotplotView = session.addView('DotplotView', {
    init: {
      views: [{ assembly: 'peach' }, { assembly: 'grape' }],
      tracks: ['subset'],
    },
  })
  dotplotView.setWidth(800)

  await waitFor(
    () => {
      expect(dotplotView.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  // Simulate selection coordinates as [x, y] tuples
  const mousedown: [number, number] = [150, 150]
  const mouseup: [number, number] = [350, 350]

  // This should not throw the MST error about nodes already in tree
  expect(() => {
    dotplotView.onDotplotView(mousedown, mouseup)
  }).not.toThrow()

  await waitFor(
    () => {
      expect(session.views.length).toBe(2)
    },
    { timeout: 10000 },
  )

  const syntenyView = session.views[1]!
  expect(syntenyView.type).toBe('LinearSyntenyView')

  const syntenyTrack = syntenyView.levels[0]?.tracks[0]
  expect(syntenyTrack).toBeDefined()
  expect(syntenyTrack.type).toBe('SyntenyTrack')
}, 50000)
