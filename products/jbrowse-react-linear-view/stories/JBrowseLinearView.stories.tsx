import { PluginConstructor } from '@jbrowse/core/Plugin'
import React, { useEffect, useState } from 'react'
import {
  createViewState,
  createJBrowseTheme,
  JBrowseLinearView,
  loadPlugins,
  ThemeProvider,
} from '../src'
import volvoxConfig from '../public/test_data/volvox/config.json'

export default {
  title: 'Linear View',
}

const theme = createJBrowseTheme()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addRelativeUris(config: any, baseUri: string) {
  if (typeof config === 'object') {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === 'object') {
        addRelativeUris(config[key], baseUri)
      } else if (key === 'uri') {
        if (!config.baseUri) {
          config.baseUri = baseUri
        }
      }
    }
  }
}

addRelativeUris(
  volvoxConfig,
  new URL(`${window.location.origin}/test_data/volvox/config.json`).href,
)

const supportedTrackTypes = [
  'AlignmentsTrack',
  'PileupTrack',
  'SNPCoverageTrack',
  'VariantTrack',
  'WiggleTrack',
]

const assembly = volvoxConfig.assemblies[0]
const tracks = volvoxConfig.tracks.filter(track =>
  supportedTrackTypes.includes(track.type),
)
const defaultSession = {
  name: 'Storybook',
  view: volvoxConfig.savedSessions[0].views[0],
}

export const ReferenceSequence = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    location: 'ctgA:1105..1221',
    onChange: patch => {
      // eslint-disable-next-line no-console
      console.log('patch', patch)
    },
  })
  return (
    <ThemeProvider theme={theme}>
      <JBrowseLinearView viewState={state} />
    </ThemeProvider>
  )
}

export const TwoLinearViews = () => {
  const state1 = createViewState({
    assembly,
    tracks,
    defaultSession,
    location: 'ctgA:1105..1221',
  })
  const state2 = createViewState({
    assembly,
    tracks,
    defaultSession: {
      ...defaultSession,
      view: { ...defaultSession.view, id: 'linear-genome-view-2' },
    },
    location: 'ctgA:5560..30589',
  })
  return (
    <ThemeProvider theme={theme}>
      <JBrowseLinearView viewState={state1} />
      <JBrowseLinearView viewState={state2} />
    </ThemeProvider>
  )
}

export const WithRuntimePlugins = () => {
  const [plugins, setPlugins] = useState<PluginConstructor[]>()

  useEffect(() => {
    async function getPlugins() {
      const loadedPlugins = await loadPlugins([
        /* array of plugin definitions like:
        {
          "name": "GDC",
          "url": "http://localhost:9000/plugin.js"
        }
        */
      ])
      setPlugins(loadedPlugins)
    }
    getPlugins()
  }, [setPlugins])

  if (!plugins) {
    return null
  }

  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    location: 'ctgA:1105..1221',
    plugins,
  })
  return (
    <ThemeProvider theme={theme}>
      <JBrowseLinearView viewState={state} />
    </ThemeProvider>
  )
}
