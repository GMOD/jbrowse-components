import { PluginConstructor } from '@jbrowse/core/Plugin'
import React, { useEffect, useState } from 'react'
import {
  createViewState,
  createJBrowseTheme,
  JBrowseLinearGenomeView,
  loadPlugins,
  ThemeProvider,
} from '../src'
import volvoxConfig from '../public/test_data/volvox/config.json'
import volvoxSession from '../public/volvox-session.json'

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
  new URL('test_data/volvox/config.json', window.location.href).href,
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
  view: volvoxConfig.defaultSession.views[0],
}
const longReadsSession = {
  ...defaultSession,
  view: volvoxSession.session.views[0],
}

export const OneLinearGenomeView = () => {
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
      <JBrowseLinearGenomeView viewState={state} />
    </ThemeProvider>
  )
}

export const LinearViewWithLongReads = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession: longReadsSession,
    location: 'ctgA:1105..1221',
    onChange: patch => {
      // eslint-disable-next-line no-console
      console.log('patch', patch)
    },
  })

  return (
    <ThemeProvider theme={theme}>
      <JBrowseLinearGenomeView viewState={state} />
    </ThemeProvider>
  )
}

export const OneLinearGenomeViewWithOutsideStyling = () => {
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
    <div style={{ textAlign: 'center', fontFamily: 'monospace' }}>
      <h2>Hello world, this is centered but not affecting the internal LGV</h2>
      <ThemeProvider theme={theme}>
        <JBrowseLinearGenomeView viewState={state} />
      </ThemeProvider>
    </div>
  )
}

export const TwoLinearGenomeViews = () => {
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
      <JBrowseLinearGenomeView viewState={state1} />
      <JBrowseLinearGenomeView viewState={state2} />
    </ThemeProvider>
  )
}

export const WithRuntimePlugins = () => {
  const [plugins, setPlugins] = useState<PluginConstructor[]>()

  useEffect(() => {
    async function getPlugins() {
      const loadedPlugins = await loadPlugins([
        {
          name: 'UCSC',
          url:
            'https://unpkg.com/jbrowse-plugin-ucsc@^1/dist/jbrowse-plugin-ucsc.umd.production.min.js',
        },
      ])
      setPlugins(loadedPlugins)
    }
    getPlugins()
  }, [setPlugins])

  if (!plugins) {
    return null
  }

  const state = createViewState({
    assembly: {
      name: 'hg19',
      aliases: ['GRCh37'],
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'Pd8Wh30ei9R',
        adapter: {
          type: 'BgzipFastaAdapter',
          fastaLocation: {
            uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
          },
          faiLocation: {
            uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai',
          },
          gziLocation: {
            uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi',
          },
        },
      },
      refNameAliases: {
        adapter: {
          type: 'RefNameAliasAdapter',
          location: {
            uri:
              'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
          },
        },
      },
    },
    plugins,
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'segdups_ucsc_hg19',
        name: 'UCSC SegDups',
        category: ['Annotation'],
        assemblyNames: ['hg19'],
        adapter: {
          type: 'UCSCAdapter',
          track: 'genomicSuperDups',
        },
      },
    ],
    location: '1:2,467,681..2,667,681',
    defaultSession: {
      name: 'Runtime plugins',
      view: {
        id: 'aU9Nqje1U',
        type: 'LinearGenomeView',
        offsetPx: 22654,
        bpPerPx: 108.93300653594771,
        displayedRegions: [
          {
            refName: '1',
            start: 0,
            end: 249250621,
            reversed: false,
            assemblyName: 'hg19',
          },
        ],
        tracks: [
          {
            id: 'MbiRphmDa',
            type: 'FeatureTrack',
            configuration: 'segdups_ucsc_hg19',
            displays: [
              {
                id: '8ovhuA5cFM',
                type: 'LinearBasicDisplay',
                height: 100,
                configuration: 'segdups_ucsc_hg19-LinearBasicDisplay',
              },
            ],
          },
        ],
        hideHeader: false,
        hideHeaderOverview: false,
        trackSelectorType: 'hierarchical',
        trackLabels: 'overlapping',
        showCenterLine: false,
      },
    },
  })
  return (
    <ThemeProvider theme={theme}>
      <JBrowseLinearGenomeView viewState={state} />
    </ThemeProvider>
  )
}
