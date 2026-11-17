import { waitFor } from '@testing-library/react'

import { getPluginManager, volvoxConfigWithTracks } from './util.tsx'

interface OpenTrack {
  id: string
  type: string
  minimized: boolean
  configuration: { trackId: string }
  displays: { id: string; type: string; hiddenCategories?: unknown }[]
}

// Every session below was saved while its VariantTracks were FeatureTracks
async function loadSavedSession(
  tracks: Record<string, unknown>[],
  trackIds = ['volvox_filtered_vcf'],
) {
  const { pluginManager, rootModel } = await getPluginManager(
    volvoxConfigWithTracks(trackIds),
  )
  const snapshot = {
    name: 'saved before the retype',
    views: [
      {
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
        ],
        tracks,
      },
    ],
  }
  await pluginManager.preloadSessionTypes(snapshot)
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  rootModel.setSession(snapshot)
  const session = rootModel.session!
  const view = session.views[0] as unknown as { tracks: OpenTrack[] }
  return { session, view, errorSpy }
}

function savedFeatureTrack(trackId: string) {
  return {
    type: 'FeatureTrack',
    configuration: trackId,
    displays: [
      {
        type: 'LinearBasicDisplay',
        configuration: `${trackId}-LinearBasicDisplay`,
      },
    ],
  }
}

function messages(session: { snackbarMessages: { message: string }[] }) {
  return session.snackbarMessages.map(m => m.message)
}

test('a track whose config changed type reopens with the new default display', async () => {
  const { session, view, errorSpy } = await loadSavedSession([
    {
      id: 'saved-track',
      type: 'FeatureTrack',
      configuration: 'volvox_filtered_vcf',
      minimized: true,
      displays: [
        {
          id: 'saved-display',
          type: 'LinearBasicDisplay',
          configuration: 'volvox_filtered_vcf-LinearBasicDisplay',
        },
      ],
    },
  ])
  await waitFor(() => {
    expect(messages(session)).toEqual([
      'Reopened 1 track whose type changed: volvox_filtered_vcf (FeatureTrack → VariantTrack); its display settings were reset',
    ])
  })
  const track = view.tracks[0]!
  expect(view.tracks).toHaveLength(1)
  expect(track.type).toBe('VariantTrack')
  expect(track.id).toBe('saved-track')
  expect(track.minimized).toBe(true)
  expect(track.displays.map(d => d.type)).toEqual(['LinearVariantDisplay'])
  expect(track.displays[0]!.id).not.toBe('saved-display')
  expect(errorSpy).not.toHaveBeenCalled()
  errorSpy.mockRestore()
})

test('a retyped track keeps its display whole when the new type still feeds it', async () => {
  const { session, view, errorSpy } = await loadSavedSession([
    {
      id: 'saved-track',
      type: 'FeatureTrack',
      configuration: 'volvox_filtered_vcf',
      displays: [
        {
          id: 'saved-display',
          type: 'LinearMarkDisplay',
          configuration: 'volvox_filtered_vcf-LinearMarkDisplay',
          hiddenCategories: ['SNV'],
        },
      ],
    },
  ])
  expect(view.tracks.map(t => t.type)).toEqual(['VariantTrack'])
  const { id, type, hiddenCategories } = view.tracks[0]!.displays[0]!
  expect({ id, type, hiddenCategories }).toEqual({
    id: 'saved-display',
    type: 'LinearMarkDisplay',
    hiddenCategories: ['SNV'],
  })
  expect(messages(session)).toEqual([
    'Reopened 1 track whose type changed: volvox_filtered_vcf (FeatureTrack → VariantTrack)',
  ])
  expect(errorSpy).not.toHaveBeenCalled()
  errorSpy.mockRestore()
})

test('a retyped track reopens where it was among the tracks that loaded', async () => {
  const { session, view, errorSpy } = await loadSavedSession(
    [
      savedFeatureTrack('gff3tabix_genes'),
      savedFeatureTrack('volvox_filtered_vcf'),
      savedFeatureTrack('bed_genes'),
    ],
    ['gff3tabix_genes', 'volvox_filtered_vcf', 'bed_genes'],
  )
  await waitFor(() => {
    expect(messages(session)).toHaveLength(1)
  })
  expect(view.tracks.map(t => t.configuration.trackId)).toEqual([
    'gff3tabix_genes',
    'volvox_filtered_vcf',
    'bed_genes',
  ])
  expect(errorSpy).not.toHaveBeenCalled()
  errorSpy.mockRestore()
})

test('retyped tracks reopen in their saved order around a removed one', async () => {
  const { session, view, errorSpy } = await loadSavedSession(
    [
      savedFeatureTrack('volvox_filtered_vcf'),
      savedFeatureTrack('no_such_track'),
      savedFeatureTrack('volvox_test_vcf'),
      savedFeatureTrack('gff3tabix_genes'),
    ],
    ['volvox_filtered_vcf', 'volvox_test_vcf', 'gff3tabix_genes'],
  )
  await waitFor(() => {
    expect(messages(session)).toEqual([
      'Removed 1 track that could not be loaded: no_such_track. Reopened 2 tracks whose type changed: volvox_filtered_vcf (FeatureTrack → VariantTrack), volvox_test_vcf (FeatureTrack → VariantTrack); display settings were reset for volvox_filtered_vcf, volvox_test_vcf',
    ])
  })
  expect(view.tracks.map(t => t.configuration.trackId)).toEqual([
    'volvox_filtered_vcf',
    'volvox_test_vcf',
    'gff3tabix_genes',
  ])
  expect(errorSpy).toHaveBeenCalledTimes(1)
  errorSpy.mockRestore()
})

test('a track whose config is gone is still dropped', async () => {
  const { session, view, errorSpy } = await loadSavedSession([
    savedFeatureTrack('no_such_track'),
  ])
  expect(view.tracks).toHaveLength(0)
  expect(messages(session)).toEqual([
    'Removed 1 track that could not be loaded: no_such_track',
  ])
  expect(errorSpy).toHaveBeenCalled()
  errorSpy.mockRestore()
})
