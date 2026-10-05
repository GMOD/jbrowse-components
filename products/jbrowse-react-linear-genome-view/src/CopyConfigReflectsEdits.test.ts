import {
  hydrateTrackConfig,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { getEnv } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { createViewState } from './index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('./makeWorkerInstance', () => () => {})

const TRACK_ID = 'testtrack'
const DISPLAY_ID = `${TRACK_ID}-LinearBasicDisplay`

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

const track = {
  type: 'FeatureTrack',
  trackId: TRACK_ID,
  name: 'Track',
  assemblyNames: ['volvox'],
  adapter: { type: 'FromConfigAdapter', features: [] },
}

interface Displays {
  displays: { displayId: string; color?: { value: string } }[]
}

function colorOf(config: unknown) {
  const { displays } = config as Displays
  return displays.find(d => d.displayId === DISPLAY_ID)?.color?.value
}

// "Copy config" in the About dialog reads `readConfObject(config)` of whatever
// the dialog was handed: `track.configuration` from the in-view label, a
// hydrated `session.tracks` entry from the track selector
describe('the config About copies after a display edit', () => {
  async function editedColor() {
    const state = createViewState({ assembly, tracks: [track] })
    const { view } = state.session
    await view.launchTrack(TRACK_ID)
    await waitFor(() => {
      expect(view.getTrack(TRACK_ID)).toBeTruthy()
    })
    const shown = view.getTrack(TRACK_ID)
    setConf(shown.displays[0], 'color', 'rgb(1,2,3)')
    return { state, shown }
  }

  test('through the in-view track label', async () => {
    const { shown } = await editedColor()
    expect(colorOf(readConfObject(shown.configuration))).toBe('rgb(1,2,3)')
  })

  test('through the track selector', async () => {
    const { state } = await editedColor()
    const { pluginManager } = getEnv<{ pluginManager: PluginManager }>(
      state.session,
    )
    await waitFor(() => {
      const entry = state.session.tracks.find(t => t.trackId === TRACK_ID)!
      expect(
        colorOf(readConfObject(hydrateTrackConfig(pluginManager, entry)!)),
      ).toBe('rgb(1,2,3)')
    })
  })
})
