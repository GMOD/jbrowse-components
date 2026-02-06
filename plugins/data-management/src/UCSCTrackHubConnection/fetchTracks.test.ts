import path from 'path'

import { LocalFile } from 'generic-filehandle2'

import { fetchUCSCTrackHubTracks } from './fetchTracks.ts'

import type { GenericFilehandle } from 'generic-filehandle2'

function generateReadBuffer(getFile: (str: string) => GenericFilehandle) {
  return async (request: Request) => {
    const file = getFile(request.url)
    const text = await file.readFile('utf8')
    return { body: text, status: 200 }
  }
}

const root = 'https://jbrowse.org/volvoxhub/'
const hubDataDir = path.resolve(
  __dirname,
  '../../../../products/jbrowse-web/test_data/volvoxhub/hub1',
)

beforeEach(() => {
  // @ts-expect-error
  fetch.resetMocks()
  // @ts-expect-error
  fetch.mockResponse(
    generateReadBuffer(
      (url: string) => new LocalFile(path.join(hubDataDir, url.replace(root, ''))),
    ),
  )
})

test('fetches tracks from a UCSC track hub (multi-file)', async () => {
  const config = {
    hubTxtLocation: {
      uri: `${root}hub.txt`,
      locationType: 'UriLocation',
    },
    assemblyNames: ['volvox'],
  }

  const tracks = await fetchUCSCTrackHubTracks(config)

  expect(tracks.length).toBeGreaterThan(0)
  const trackNames = tracks.map(t => t.name)
  expect(trackNames).toContain('BAM - Volvox Sorted')
  expect(trackNames).toContain('CRAM - Volvox Sorted')

  for (const track of tracks) {
    expect(track.assemblyNames).toEqual(['volvox'])
  }
})

test('filters by assemblyNames when specified', async () => {
  const config = {
    hubTxtLocation: {
      uri: `${root}hub.txt`,
      locationType: 'UriLocation',
    },
    assemblyNames: ['nonExistentAssembly'],
  }

  const tracks = await fetchUCSCTrackHubTracks(config)
  expect(tracks.length).toBe(0)
})

test('returns all assemblies when assemblyNames is empty', async () => {
  const config = {
    hubTxtLocation: {
      uri: `${root}hub.txt`,
      locationType: 'UriLocation',
    },
    assemblyNames: [],
  }

  const tracks = await fetchUCSCTrackHubTracks(config)
  expect(tracks.length).toBeGreaterThan(0)
})
