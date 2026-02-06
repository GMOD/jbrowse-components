import { fetchJB2TrackHubTracks } from './fetchTracks.ts'

const mockConfigJson = {
  tracks: [
    {
      type: 'FeatureTrack',
      trackId: 'test-track-1',
      name: 'Test Track 1',
      assemblyNames: ['hg38'],
      adapter: {
        type: 'BigBedAdapter',
        bigBedLocation: {
          uri: 'test.bb',
          locationType: 'UriLocation',
        },
      },
    },
    {
      type: 'QuantitativeTrack',
      trackId: 'test-track-2',
      name: 'Test Track 2',
      assemblyNames: ['hg38'],
      adapter: {
        type: 'BigWigAdapter',
        bigWigLocation: {
          uri: 'test.bw',
          locationType: 'UriLocation',
        },
      },
    },
  ],
}

beforeEach(() => {
  // @ts-expect-error
  fetch.resetMocks()
  // @ts-expect-error
  fetch.mockResponse(JSON.stringify(mockConfigJson))
})

test('fetches tracks from a JB2 hub config', async () => {
  const config = {
    configJsonLocation: {
      uri: 'http://example.com/hub/config.json',
      locationType: 'UriLocation',
    },
  }

  const tracks = await fetchJB2TrackHubTracks(config)

  expect(tracks.length).toBe(2)
  expect(tracks[0]!.trackId).toBe('test-track-1')
  expect(tracks[1]!.trackId).toBe('test-track-2')
})

test('returns empty array when config has no tracks', async () => {
  // @ts-expect-error
  fetch.mockResponse(JSON.stringify({ assemblies: [] }))

  const config = {
    configJsonLocation: {
      uri: 'http://example.com/hub/config.json',
      locationType: 'UriLocation',
    },
  }

  const tracks = await fetchJB2TrackHubTracks(config)
  expect(tracks.length).toBe(0)
})

test('adds baseUri to track URIs via addRelativeUris', async () => {
  // @ts-expect-error
  fetch.mockResponse(
    JSON.stringify({
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'rel-track',
          adapter: {
            type: 'BigBedAdapter',
            bigBedLocation: {
              uri: 'relative/path.bb',
              locationType: 'UriLocation',
            },
          },
        },
      ],
    }),
  )

  const config = {
    configJsonLocation: {
      uri: 'http://example.com/hub/config.json',
      locationType: 'UriLocation',
    },
  }

  const tracks = await fetchJB2TrackHubTracks(config)

  expect(tracks.length).toBe(1)
  const adapter = tracks[0]!.adapter as Record<string, unknown>
  const loc = adapter.bigBedLocation as Record<string, unknown>
  // addRelativeUris should have set baseUri on the location
  expect(loc.baseUri).toBe('http://example.com/hub/config.json')
})
