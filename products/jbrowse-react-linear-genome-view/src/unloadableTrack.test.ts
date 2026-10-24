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
    const state = await createViewStateAsync({
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
    const { session } = state
    expect(
      session.view.tracks.map(
        (t: { configuration: { trackId: string } }) => t.configuration.trackId,
      ),
    ).toEqual(['good'])
    expect(
      session.snackbarMessages.map((m: { message: string }) => m.message),
    ).toContainEqual(expect.stringContaining('could not be loaded: bad'))
    warn.mockRestore()
  },
)
