import { readConfObject } from '@jbrowse/core/configuration'
import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { autorun } from 'mobx'

import { handleRequest } from './generateReadBuffer.ts'
import { getPluginManager } from './util.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

jest.mock('../makeWorkerInstance', () => () => {})

const getFile = (url: string) => {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/volvox/${cleanUrl}`
  return new LocalFile(require.resolve(`../../${filePath}`))
}

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  return `${url}`.includes('jb2=true')
    ? new Response('{}')
    : handleRequest(() => getFile(`${url}`), args)
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  jest.restoreAllMocks()
})

async function setupView(trackIds: string[]) {
  const { rootModel } = getPluginManager()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    init: {
      assembly: 'volvox',
      loc: 'ctgA:1..1000',
      tracks: trackIds,
    },
  }) as LinearGenomeViewModel
  view.setWidth(800)
  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
      expect(view.tracks.length).toBe(trackIds.length)
    },
    { timeout: 30000 },
  )
  return { rootModel, session, view }
}

test('track.configuration returns the same MST instance across reads', async () => {
  const { view } = await setupView(['volvox_gc'])
  const track = view.tracks[0]!
  const a = track.configuration
  const b = track.configuration
  expect(a).toBe(b)
  expect(readConfObject(a, 'name')).toBe('GCContent')
}, 40000)

test('display.configuration returns the same MST instance across reads', async () => {
  const { view } = await setupView(['volvox_gc'])
  const display = view.tracks[0]!.displays[0]!
  const a = display.configuration
  const b = display.configuration
  expect(a).toBe(b)
  expect(a).toBeDefined()
}, 40000)

test('edits to a frozen track propagate through track.configuration', async () => {
  const { rootModel, view } = await setupView(['volvox_gc'])
  const track = view.tracks[0]!
  const before = track.configuration
  expect(readConfObject(before, 'name')).toBe('GCContent')

  rootModel.jbrowse.updateTrackConf({
    type: 'GCContentTrack',
    trackId: 'volvox_gc',
    assemblyNames: ['volvox'],
    name: 'GCContent (renamed)',
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: {
        uri: 'volvox.2bit',
        locationType: 'UriLocation',
      },
    },
  })

  const after = track.configuration
  expect(after).not.toBe(before)
  expect(readConfObject(after, 'name')).toBe('GCContent (renamed)')
}, 40000)

test('getConf is not re-evaluated when unrelated observable state changes', async () => {
  const { view } = await setupView(['volvox_gc'])
  const track = view.tracks[0]!

  let reads = 0
  const dispose = autorun(() => {
    readConfObject(track.configuration, 'name')
    reads++
  })
  const initial = reads

  view.setWidth(1000)
  view.setWidth(1200)
  track.setMinimized(true)
  track.setMinimized(false)

  expect(reads).toBe(initial)
  dispose()
}, 40000)

test('autorun fires exactly once when the track config is edited', async () => {
  const { rootModel, view } = await setupView(['volvox_gc'])
  const track = view.tracks[0]!

  const names: string[] = []
  const dispose = autorun(() => {
    names.push(readConfObject(track.configuration, 'name') as string)
  })
  expect(names).toEqual(['GCContent'])

  rootModel.jbrowse.updateTrackConf({
    type: 'GCContentTrack',
    trackId: 'volvox_gc',
    assemblyNames: ['volvox'],
    name: 'GCContent v2',
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: {
        uri: 'volvox.2bit',
        locationType: 'UriLocation',
      },
    },
  })

  expect(names).toEqual(['GCContent', 'GCContent v2'])
  dispose()
}, 40000)

test('unrelated tracks keep identity across edits to a sibling', async () => {
  const { rootModel, view } = await setupView(['volvox_gc', 'volvox_sv_test'])
  const [gc, sv] = view.tracks
  const svBefore = sv!.configuration

  rootModel.jbrowse.updateTrackConf({
    type: 'GCContentTrack',
    trackId: 'volvox_gc',
    assemblyNames: ['volvox'],
    name: 'GCContent v3',
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: {
        uri: 'volvox.2bit',
        locationType: 'UriLocation',
      },
    },
  })

  const svAfter = sv!.configuration
  expect(svAfter).toBe(svBefore)
  expect(readConfObject(gc!.configuration, 'name')).toBe('GCContent v3')
}, 40000)
