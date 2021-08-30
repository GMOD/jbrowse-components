/* eslint-disable no-console */
import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { PluginRecord } from '@jbrowse/core/PluginLoader'
import { Region } from '@jbrowse/core/util/types'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'

// locals
import { createViewState, loadPlugins, JBrowseLinearGenomeView } from '../src'

// configs
import volvoxConfig from '../public/test_data/volvox/config.json'
import volvoxSession from '../public/volvox-session.json'
import nextstrainConfig from '../public/nextstrain_covid.json'

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

const configPath = 'test_data/volvox/config.json'
addRelativeUris(volvoxConfig, new URL(configPath, window.location.href).href)
const supportedTrackTypes = [
  'AlignmentsTrack',
  'PileupTrack',
  'SNPCoverageTrack',
  'VariantTrack',
  'QuantitativeTrack',
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
    // use 1-based coordinates for locstring
    location: 'ctgA:1105..1221',
    onChange: patch => {
      console.log('patch', patch)
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export const UsingDefaultTracks = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    defaultTracks: ['wiggle_track_fractional_posneg'],

    // use 1-based coordinates for locstring
    location: 'ctgA:1105..1221',
    onChange: patch => {
      console.log('patch', patch)
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export const UsingLocObject = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,

    // use 0-based coordinates for "location object" here
    location: { refName: 'ctgA', start: 10000, end: 20000 },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
export const WithLongReads = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession: longReadsSession,
    location: 'ctgA:1105..1221',
  })

  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithOutsideStyling = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    location: 'ctgA:1105..1221',
  })

  return (
    <div style={{ textAlign: 'center', fontFamily: 'monospace' }}>
      <h2>
        This parent container has textAlign:&apos;center&apos; and a monospace
        font, but these attributes are not affecting the internal LGV
      </h2>
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

export const WithTextSearching = () => {
  const textSearchConfig = {
    assembly,
    aggregateTextSearchAdapters: [
      {
        type: 'TrixTextSearchAdapter',
        textSearchAdapterId: 'volvox-index',
        ixFilePath: {
          uri: 'storybook_data/volvox.ix',
          locationType: 'UriLocation',
        },
        ixxFilePath: {
          uri: 'storybook_data/volvox.ixx',
          locationType: 'UriLocation',
        },
        metaFilePath: {
          uri: 'storybook_data/volvox_meta.json',
          locationType: 'UriLocation',
        },
        assemblyNames: ['volvox'],
      },
    ],
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'gff3tabix_genes',
        assemblyNames: ['volvox'],
        name: 'GFF3Tabix genes',
        category: ['Miscellaneous'],
        adapter: {
          type: 'Gff3TabixAdapter',
          gffGzLocation: {
            uri: 'volvox.sort.gff3.gz',
            locationType: 'UriLocation',
          },
          index: {
            location: {
              uri: 'volvox.sort.gff3.gz.tbi',
              locationType: 'UriLocation',
            },
          },
        },
      },
      {
        type: 'FeatureTrack',
        trackId: 'single_exon_gene',
        category: ['Miscellaneous'],
        name: 'Single exon gene',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'Gff3TabixAdapter',
          gffGzLocation: {
            uri: 'single_exon_gene.sorted.gff.gz',
            locationType: 'UriLocation',
          },
          index: {
            location: {
              uri: 'single_exon_gene.sorted.gff.gz.tbi',
              locationType: 'UriLocation',
            },
          },
        },
      },
      {
        type: 'VariantTrack',
        trackId: 'volvox.inv.vcf',
        name: 'volvox inversions',
        category: ['VCF'],
        assemblyNames: ['volvox'],
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: {
            uri: 'volvox.inv.vcf.gz',
            locationType: 'UriLocation',
          },
          index: {
            location: {
              uri: 'volvox.inv.vcf.gz.tbi',
              locationType: 'UriLocation',
            },
            indexType: 'TBI',
          },
        },
      },
    ],
    defaultSession,
    // use 1-based coordinates for locstring
    location: 'ctgA:1..800',
  }
  addRelativeUris(
    textSearchConfig,
    new URL(configPath, window.location.href).href,
  )
  const state = createViewState(textSearchConfig)
  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithPerTrackTextSearching = () => {
  const textSearchConfig = {
    assembly,
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'gff3tabix_genes',
        assemblyNames: ['volvox'],
        name: 'GFF3Tabix genes',
        category: ['Miscellaneous'],
        adapter: {
          type: 'Gff3TabixAdapter',
          gffGzLocation: {
            uri: 'volvox.sort.gff3.gz',
            locationType: 'UriLocation',
          },
          index: {
            location: {
              uri: 'volvox.sort.gff3.gz.tbi',
              locationType: 'UriLocation',
            },
          },
        },
        textSearching: {
          textSearchAdapter: {
            type: 'TrixTextSearchAdapter',
            textSearchAdapterId: 'gff3tabix_genes-index',
            ixFilePath: {
              uri: 'storybook_data/gff3tabix_genes.ix',
              locationType: 'UriLocation',
            },
            ixxFilePath: {
              uri: 'storybook_data/gff3tabix_genes.ixx',
              locationType: 'UriLocation',
            },
            metaFilePath: {
              uri: 'storybook_data/gff3tabix_genes_meta.json',
              locationType: 'UriLocation',
            },
            assemblyNames: ['volvox'],
          },
        },
      },
    ],
    defaultSession,
    // use 1-based coordinates for locstring
    location: 'ctgA:1..800',
  }
  addRelativeUris(
    textSearchConfig,
    new URL(configPath, window.location.href).href,
  )
  const state = createViewState(textSearchConfig)
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
export const NextstrainExample = () => {
  const { assembly, tracks, defaultSession } = nextstrainConfig
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    location: 'SARS-CoV-2:1..29,903',
    onChange: patch => {
      console.log('patch', patch)
    },
    configuration: {
      theme: {
        palette: {
          primary: {
            main: '#5da8a3',
          },
          secondary: {
            main: '#333',
          },
        },
      },
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

const VisibleRegions = observer(
  ({ state }: { state: ReturnType<typeof createViewState> }) => {
    const locstrings = state.session.views[0].coarseDynamicBlocks
      .map(
        (region: Region) =>
          `${region.refName}:${Math.floor(region.start)}-${Math.floor(
            region.end,
          )}`,
      )
      .join(',')
    return <p>Visible region: {locstrings}</p>
  },
)

export const VisibleRegionsExample = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    location: 'ctgA:1105..1221',
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <VisibleRegions state={state} />
    </div>
  )
}

export const WithInlinePlugins = () => {
  // you don't have to necessarily define this inside your react component, it
  // just helps so that you can see the source code in the storybook to have it
  // here
  class HighlightRegionPlugin extends Plugin {
    name = 'HighlightRegionPlugin'

    install(pluginManager: PluginManager) {
      pluginManager.addToExtensionPoint(
        'Core-extendPluggableElement',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pluggableElement: any) => {
          if (pluggableElement.name === 'LinearGenomeView') {
            const { stateModel } = pluggableElement as ViewType
            const newStateModel = stateModel.extend(self => {
              const superRubberBandMenuItems = self.rubberBandMenuItems
              return {
                views: {
                  rubberBandMenuItems() {
                    return [
                      ...superRubberBandMenuItems(),
                      {
                        label: 'Console log selected region',
                        onClick: () => {
                          const { leftOffset, rightOffset } = self
                          const selectedRegions = self.getSelectedRegions(
                            leftOffset,
                            rightOffset,
                          )
                          // console log the list of potentially multiple
                          // regions that were selected
                          console.log(selectedRegions)
                        },
                      },
                    ]
                  },
                },
              }
            })

            pluggableElement.stateModel = newStateModel
          }
          return pluggableElement
        },
      )
    }

    configure() {}
  }

  const state = createViewState({
    assembly,
    plugins: [HighlightRegionPlugin],
    tracks,
    defaultSession,
    location: 'ctgA:1105..1221',
  })

  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithExternalPlugins = () => {
  // usage with buildtime plugins
  // this plugins array is then passed to the createViewState constructor
  // import UCSCPlugin from 'jbrowse-plugin-ucsc'
  // const plugins = [UCSCPlugin]

  // usage with runtime plugins
  // this plugins array is then passed to the createViewState constructor
  const [plugins, setPlugins] = useState<PluginRecord[]>()
  useEffect(() => {
    async function getPlugins() {
      const loadedPlugins = await loadPlugins([
        {
          name: 'UCSC',
          url: 'https://unpkg.com/jbrowse-plugin-ucsc@^1/dist/jbrowse-plugin-ucsc.umd.production.min.js',
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
            locationType: 'UriLocation',
          },
          faiLocation: {
            uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai',
            locationType: 'UriLocation',
          },
          gziLocation: {
            uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi',
            locationType: 'UriLocation',
          },
        },
      },
      refNameAliases: {
        adapter: {
          type: 'RefNameAliasAdapter',
          location: {
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
            locationType: 'UriLocation',
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

const JBrowseLinearGenomeViewStories = {
  title: 'Linear View',
}

export default JBrowseLinearGenomeViewStories
