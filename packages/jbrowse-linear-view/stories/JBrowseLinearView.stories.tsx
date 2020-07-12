import { PluginConstructor } from '@gmod/jbrowse-core/Plugin'
import React, { useEffect, useState } from 'react'
import {
  createViewState,
  defaultJBrowseTheme,
  JBrowseLinearView,
  loadPlugins,
  ThemeProvider,
} from '../src'
import { exampleAssembly, exampleSession, exampleTracks } from './examples'

export default {
  title: 'Linear View',
}

export const ReferenceSequence = () => {
  const state = createViewState({
    assembly: exampleAssembly,
    tracks: exampleTracks.slice(0, 5),
    defaultSession: exampleSession,
    location: 'ctgA:1105..1221',
    onChange: patch => {
      // eslint-disable-next-line no-console
      console.log('patch', patch)
    },
  })
  return (
    <ThemeProvider theme={defaultJBrowseTheme}>
      <JBrowseLinearView viewState={state} />
    </ThemeProvider>
  )
}

export const TwoLinearViews = () => {
  const state1 = createViewState({
    assembly: exampleAssembly,
    tracks: exampleTracks.slice(0, 5),
    defaultSession: exampleSession,
    location: 'ctgA:1105..1221',
  })
  const state2 = createViewState({
    assembly: exampleAssembly,
    tracks: exampleTracks.slice(0, 5),
    defaultSession: {
      ...exampleSession,
      view: { ...exampleSession.view, id: 'linear-genome-view-2' },
    },
    location: 'ctgA:5560..30589',
  })
  return (
    <ThemeProvider theme={defaultJBrowseTheme}>
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
        /* array of plugin URLs */
      ])
      setPlugins(loadedPlugins)
    }
    getPlugins()
  }, [setPlugins])

  if (!plugins) {
    return null
  }

  const state = createViewState({
    assembly: exampleAssembly,
    tracks: exampleTracks.slice(0, 5),
    defaultSession: exampleSession,
    location: 'ctgA:1105..1221',
    plugins,
  })
  return (
    <ThemeProvider theme={defaultJBrowseTheme}>
      <JBrowseLinearView viewState={state} />
    </ThemeProvider>
  )
}
