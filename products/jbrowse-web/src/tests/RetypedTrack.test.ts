import { waitFor } from '@testing-library/react'

import { getPluginManager, volvoxConfigWithTracks } from './util.tsx'

interface OpenTrack {
  id: string
  type: string
  minimized: boolean
  displays: { id: string; type: string; hiddenCategories?: unknown }[]
}

// volvox_filtered_vcf is a VariantTrack in the config; each session below was
// saved while it was a FeatureTrack
async function loadSavedSession(tracks: Record<string, unknown>[]) {
  const { pluginManager, rootModel } = await getPluginManager(
    volvoxConfigWithTracks(['volvox_filtered_vcf']),
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
    expect(view.tracks).toHaveLength(1)
  })
  const track = view.tracks[0]!
  expect(track.type).toBe('VariantTrack')
  expect(track.id).toBe('saved-track')
  expect(track.minimized).toBe(true)
  expect(track.displays.map(d => d.type)).toEqual(['LinearVariantDisplay'])
  expect(track.displays[0]!.id).not.toBe('saved-display')
  expect(messages(session)).toEqual([
    'Reopened 1 track whose type changed: volvox_filtered_vcf (FeatureTrack → VariantTrack); its display settings were reset',
  ])
  expect(errorSpy).toHaveBeenCalled()
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
  errorSpy.mockRestore()
})

test('a track whose config is gone is still dropped', async () => {
  const { session, view, errorSpy } = await loadSavedSession([
    {
      type: 'FeatureTrack',
      configuration: 'no_such_track',
      displays: [
        {
          type: 'LinearBasicDisplay',
          configuration: 'no_such_track-LinearBasicDisplay',
        },
      ],
    },
  ])
  expect(view.tracks).toHaveLength(0)
  expect(messages(session)).toEqual([
    'Removed 1 track that could not be loaded: no_such_track',
  ])
  errorSpy.mockRestore()
})
