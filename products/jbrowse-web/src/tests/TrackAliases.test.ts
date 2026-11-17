import { waitFor } from '@testing-library/react'

import { getPluginManager, volvoxConfigWithTracks } from './util.tsx'

interface OpenTrack {
  configuration: { trackId: string }
}

interface AliasSession {
  views: unknown[]
  snackbarMessages: { message: string }[]
  trackConfigDeltas: Record<string, { trackId: string; name?: string }>
  sessionTracks: { trackId: string }[]
  getTrackById: (id: string) => { trackId: string; name?: unknown } | undefined
  addSessionTrackConf: (conf: Record<string, unknown>) => unknown
}

interface AliasView {
  tracks: OpenTrack[]
  showTrack: (trackId: string) => unknown
  hideTrack: (trackId: string) => unknown
}

// gff3tabix_genes was renamed genes_v2, listing its old id in `aliases`
function renamedConfig() {
  const config = volvoxConfigWithTracks(['gff3tabix_genes'])
  return {
    ...config,
    tracks: config.tracks.map(t => ({
      ...t,
      trackId: 'genes_v2',
      aliases: ['gff3tabix_genes'],
    })),
  }
}

async function loadSavedSession(saved: Record<string, unknown> = {}) {
  const { pluginManager, rootModel } = await getPluginManager(renamedConfig())
  const snapshot = {
    name: 'saved before the rename',
    views: [
      {
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
        ],
        tracks: [
          {
            type: 'FeatureTrack',
            configuration: 'gff3tabix_genes',
            displays: [
              {
                type: 'LinearBasicDisplay',
                configuration: 'gff3tabix_genes-LinearBasicDisplay',
              },
            ],
          },
        ],
      },
    ],
    ...saved,
  }
  await pluginManager.preloadSessionTypes(snapshot)
  rootModel.setSession(snapshot)
  const session = rootModel.session as unknown as AliasSession
  const view = session.views[0] as AliasView
  return { session, view }
}

test('a saved session naming a renamed track by its old id opens it', async () => {
  const { session, view } = await loadSavedSession()
  await waitFor(() => {
    expect(view.tracks.map(t => t.configuration.trackId)).toEqual(['genes_v2'])
  })
  expect(session.snackbarMessages).toEqual([])
})

test('showing or hiding a track by its old id acts on the open track', async () => {
  const { view } = await loadSavedSession()
  view.showTrack('gff3tabix_genes')
  expect(view.tracks).toHaveLength(1)
  view.hideTrack('gff3tabix_genes')
  expect(view.tracks).toHaveLength(0)
  view.showTrack('gff3tabix_genes')
  expect(view.tracks.map(t => t.configuration.trackId)).toEqual(['genes_v2'])
})

test('an edit saved under the old id moves to the track', async () => {
  const { session } = await loadSavedSession({
    trackConfigDeltas: {
      gff3tabix_genes: { trackId: 'gff3tabix_genes', name: 'Edited genes' },
    },
  })
  expect(session.trackConfigDeltas).toEqual({
    genes_v2: { trackId: 'genes_v2', name: 'Edited genes' },
  })
  expect(session.getTrackById('genes_v2')?.name).toBe('Edited genes')
  expect(session.getTrackById('gff3tabix_genes')?.trackId).toBe('genes_v2')
})

test('an edit under the current id wins over one saved under the old id', async () => {
  const { session } = await loadSavedSession({
    trackConfigDeltas: {
      genes_v2: { trackId: 'genes_v2', name: 'Newer edit' },
      gff3tabix_genes: { trackId: 'gff3tabix_genes', name: 'Stale edit' },
    },
  })
  expect(session.trackConfigDeltas).toEqual({
    genes_v2: { trackId: 'genes_v2', name: 'Newer edit' },
  })
})

test('a legacy full-copy edit saved under the old id becomes the track’s edit', async () => {
  const [genes] = renamedConfig().tracks
  const { session } = await loadSavedSession({
    sessionTracks: [
      {
        ...genes,
        trackId: 'gff3tabix_genes',
        aliases: undefined,
        name: 'Legacy edit',
      },
    ],
  })
  expect(session.sessionTracks).toHaveLength(0)
  expect(session.getTrackById('gff3tabix_genes')?.trackId).toBe('genes_v2')
  expect(session.getTrackById('genes_v2')?.name).toBe('Legacy edit')
})

test('adding a track under an alias leaves the open track in place', async () => {
  const { session, view } = await loadSavedSession()
  await waitFor(() => {
    expect(view.tracks).toHaveLength(1)
  })
  session.addSessionTrackConf({
    type: 'FeatureTrack',
    trackId: 'gff3tabix_genes',
    name: 'New track',
    assemblyNames: ['volvox'],
    adapter: { type: 'Gff3Adapter', uri: 'volvox.sort.gff3' },
  })
  expect(session.sessionTracks).toHaveLength(0)
  expect(view.tracks.map(t => t.configuration.trackId)).toEqual(['genes_v2'])
})
