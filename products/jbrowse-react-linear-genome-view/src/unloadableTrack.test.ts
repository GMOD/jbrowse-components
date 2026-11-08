import { createViewStateAsync } from './index.ts'

jest.mock('./makeWorkerInstance', () => () => {})

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'f',
          start: 0,
          end: 10,
          seq: 'cattgttgcg',
        },
      ],
    },
  },
}

const track = (trackId: string, display: Record<string, unknown> = {}) => ({
  type: 'FeatureTrack',
  trackId,
  assemblyNames: ['volvox'],
  adapter: { type: 'FromConfigAdapter', features: [] },
  displays: [
    {
      type: 'LinearBasicDisplay',
      displayId: `${trackId}-LinearBasicDisplay`,
      ...display,
    },
  ],
})

const openTracks = (ids: string[]) =>
  ids.map(id => ({
    type: 'FeatureTrack',
    configuration: id,
    displays: [
      { type: 'LinearBasicDisplay', configuration: `${id}-LinearBasicDisplay` },
    ],
  }))

// a value its slot refuses, as a newer release's enum member would be
test.each(['session', 'defaultSession'] as const)(
  'a track whose config cannot load costs that track, through %s',
  async key => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { session } = await createViewStateAsync({
      assembly,
      tracks: [track('good'), track('bad', { heightMode: 'shrink' })],
      location: 'ctgA:1-10',
      [key]: {
        name: 's',
        view: {
          id: 'v',
          type: 'LinearGenomeView',
          tracks: openTracks(['good', 'bad']),
        },
      },
    })
    expect(
      session.view.tracks.map(
        (t: { configuration: { trackId: string } }) => t.configuration.trackId,
      ),
    ).toEqual(['good'])
    expect(
      session.snackbarMessages.map((m: { message: string }) => m.message),
    ).toContainEqual(expect.stringContaining('could not be loaded: bad'))
    expect(String(error.mock.calls[0]?.[0])).toContain('/displays/0/heightMode')
    error.mockRestore()
    warn.mockRestore()
  },
)

// a display type no plugin in this build registers, as a session saved with a
// store plugin carries; the app root prunes it, and so must this one
test('a session naming a display type this build lacks loads without it', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const { session } = await createViewStateAsync({
    assembly,
    tracks: [track('good')],
    location: 'ctgA:1-10',
    session: {
      name: 's',
      view: {
        id: 'v',
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'FeatureTrack',
            configuration: 'good',
            displays: [{ type: 'NoSuchPluginDisplay', configuration: 'x' }],
          },
        ],
      },
    },
  })
  expect(session.name).toBe('s')
  expect(
    session.snackbarMessages.map((m: { message: string }) => m.message),
  ).toContainEqual(expect.stringContaining('NoSuchPluginDisplay'))
  warn.mockRestore()
})
