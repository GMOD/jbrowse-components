import { PluginRecord } from '@jbrowse/core/PluginLoader'
import React, { useEffect, useState } from 'react'
import { createViewState, JBrowseLinearGenomeView, loadPlugins } from '../src'
import volvoxConfig from '../public/test_data/volvox/config.json'
import volvoxSession from '../public/volvox-session.json'

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
const aggregateTextSearchAdapters = volvoxConfig.aggregateTextSearchAdapters
export const OneLinearGenomeView = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    // use 1-based coordinates for locstring
    location: 'ctgA:1105..1221',
    onChange: patch => {
      // eslint-disable-next-line no-console
      console.log('patch', patch)
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export const OneLinearGenomeViewUsingLocObject = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,

    // use 0-based coordinates for "location object" here
    location: { refName: 'ctgA', start: 10000, end: 20000 },
    onChange: patch => {
      // eslint-disable-next-line no-console
      console.log('patch', patch)
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
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

  return <JBrowseLinearGenomeView viewState={state} />
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
      <JBrowseLinearGenomeView viewState={state} />
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
    <>
      <JBrowseLinearGenomeView viewState={state1} />
      <JBrowseLinearGenomeView viewState={state2} />
    </>
  )
}

export const WithPlugins = () => {
  // usage with buildtime plugins
  // import UCSCPlugin from 'jbrowse-plugin-ucsc'
  // const plugins = [UCSCPlugin]

  // alternative usage with runtime plugins
  const [plugins, setPlugins] = useState<PluginRecord[]>()
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
    plugins: plugins.map(p => p.plugin),
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
  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithTextSearching = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    aggregateTextSearchAdapters,
    // use 1-based coordinates for locstring
    location: 'ctgA:1105..1221',
    onChange: patch => {
      // eslint-disable-next-line no-console
      console.log('patch', patch)
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
export const CustomTheme = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession: {
      ...defaultSession,
      view: {
        ...defaultSession.view,
        bpPerPx: 0.1,
        offsetPx: 10000,
        tracks: [
          {
            id: 'q3UA86xQA',
            type: 'ReferenceSequenceTrack',
            configuration: 'volvox_refseq',
            displays: [
              {
                id: '6JCCxQScPJ',
                type: 'LinearReferenceSequenceDisplay',
                configuration: 'volvox_refseq-LinearReferenceSequenceDisplay',
                height: 210,
              },
            ],
          },
        ],
      },
    },
    configuration: {
      theme: {
        palette: {
          primary: {
            main: '#311b92',
          },
          secondary: {
            main: '#0097a7',
          },
          tertiary: {
            main: '#f57c00',
          },
          quaternary: {
            main: '#d50000',
          },
          bases: {
            A: { main: '#98FB98' },
            C: { main: '#87CEEB' },
            G: { main: '#DAA520' },
            T: { main: '#DC143C' },
          },
        },
      },
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

const JBrowseLinearGenomeViewStories = {
  title: 'Linear View',
}

export default JBrowseLinearGenomeViewStories
