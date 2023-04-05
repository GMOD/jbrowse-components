/* eslint-disable no-console */
import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { Region } from '@jbrowse/core/util/types'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'

// locals
import { createViewState, loadPlugins, JBrowseLinearGenomeView } from '../src'

import makeWorkerInstance from '../src/makeWorkerInstance'

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
      } else if (key === 'uri' && !config.baseUri) {
        config.baseUri = baseUri
      }
    }
  }
}

const configPath = 'test_data/volvox/config.json'
addRelativeUris(volvoxConfig, new URL(configPath, window.location.href).href)
const supportedTrackTypes = new Set([
  'AlignmentsTrack',
  'FeatureTrack',
  'VariantTrack',
  'WiggleTrack',
])

const excludeIds = new Set([
  'gtf_plain_text_test',
  'lollipop_track',
  'arc_track',
])

const assembly = volvoxConfig.assemblies[0]
const tracks = volvoxConfig.tracks.filter(
  t => supportedTrackTypes.has(t.type) && !excludeIds.has(t.trackId),
)
const defaultSession = {
  name: 'Storybook',
  view: volvoxConfig.defaultSession.views[0],
}
const longReadsSession = {
  ...defaultSession,
  view: volvoxSession.session.views[0],
}
export const WithWebWorker = () => {
  const state = createViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
    configuration: {
      rpc: {
        defaultDriver: 'WebWorkerRpcDriver',
      },
    },
    makeWorkerInstance,
  })
  state.session.view.showTrack('Deep sequencing')

  return <JBrowseLinearGenomeView viewState={state} />
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

export const DisableAddTracks = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    // use 0-based coordinates for "location object" here
    location: { refName: 'ctgA', start: 10000, end: 20000 },
    disableAddTracks: true,
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

export const WithShowTrack = () => {
  const state = createViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })
  state.session.view.showTrack('volvox-long-reads-sv-bam')

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

function loc(r: Region) {
  return `${r.refName}:${Math.floor(r.start)}-${Math.floor(r.end)}`
}
const VisibleRegions = observer(
  ({ state }: { state: ReturnType<typeof createViewState> }) => {
    const view = state.session.views[0]
    return view.initialized ? (
      <div>
        <p>Visible region {view.coarseDynamicBlocks.map(loc).join(',')}</p>
        <p>Static blocks {view.staticBlocks.map(loc).join(',')}</p>
      </div>
    ) : null
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

export const Hg38Exome = () => {
  const assembly = {
    name: 'GRCh38',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'GRCh38-ReferenceSequenceTrack',
      adapter: {
        type: 'BgzipFastaAdapter',
        fastaLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
        },
        faiLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.fai',
        },
        gziLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.gzi',
        },
      },
    },
    aliases: ['hg38'],
    refNameAliases: {
      adapter: {
        type: 'RefNameAliasAdapter',
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
      },
    },
  }

  const tracks = [
    {
      type: 'FeatureTrack',
      trackId:
        'GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff',
      name: 'NCBI RefSeq Genes',
      category: ['Genes'],
      assemblyNames: ['GRCh38'],
      adapter: {
        type: 'Gff3TabixAdapter',
        gffGzLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
        },
        index: {
          location: {
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.tbi',
          },
        },
      },
      renderer: {
        type: 'SvgFeatureRenderer',
      },
    },
    {
      type: 'AlignmentsTrack',
      trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
      name: 'NA12878 Exome',
      category: ['1000 Genomes', 'Alignments'],
      assemblyNames: ['GRCh38'],
      adapter: {
        type: 'CramAdapter',
        cramLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
          locationType: 'UriLocation',
        },
        craiLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram.crai',
          locationType: 'UriLocation',
        },
        sequenceAdapter: {
          type: 'BgzipFastaAdapter',
          fastaLocation: {
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
            locationType: 'UriLocation',
          },
          faiLocation: {
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.fai',
            locationType: 'UriLocation',
          },
          gziLocation: {
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.gzi',
            locationType: 'UriLocation',
          },
        },
      },
    },
  ]

  const state = createViewState({
    assembly,
    tracks,
    location: '1:100,987,269..100,987,368',
  })
  state.session.view.showTrack('NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome')

  return <JBrowseLinearGenomeView viewState={state} />
}
export const WithExternalPlugins = () => {
  const [error, setError] = useState<unknown>()
  const [viewState, setViewState] =
    useState<ReturnType<typeof createViewState>>()
  // usage with buildtime plugins
  // this plugins array is then passed to the createViewState constructor
  //
  // import UCSCPlugin from 'jbrowse-plugin-ucsc'
  // const plugins = [UCSCPlugin]
  //
  // note: the loadPlugins function is from
  // import {loadPlugins} from '@jbrowse/react-linear-genome-view'
  //
  // we manually call loadPlugins, and pass the result to the createViewState constructor
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const plugins = await loadPlugins([
          {
            name: 'UCSC',
            url: 'https://unpkg.com/jbrowse-plugin-ucsc@^1/dist/jbrowse-plugin-ucsc.umd.production.min.js',
          },
        ])
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
          plugins: plugins.map(p => p.plugin) || [],
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
        setViewState(state)
      } catch (e) {
        setError(e)
      }
    })()
  }, [])

  return error ? (
    <div style={{ color: 'red' }}>{`${error}`}</div>
  ) : !viewState ? (
    <div>Loading...</div>
  ) : (
    <JBrowseLinearGenomeView viewState={viewState} />
  )
}

export const WithInternetAccounts = () => {
  const state = createViewState({
    assembly,
    tracks: [
      {
        type: 'QuantitativeTrack',
        trackId: 'google_bigwig',
        name: 'Google Drive BigWig',
        category: ['Authentication'],
        assemblyNames: ['volvox'],
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: {
            locationType: 'UriLocation',
            uri: ' https://www.googleapis.com/drive/v3/files/1PIvZCOJioK9eBL1Vuvfa4L_Fv9zTooHk?alt=media',
            internetAccountId: 'manualGoogleEntry',
          },
        },
      },
    ],
    defaultSession,
    location: 'ctgA:1105..1221',
    internetAccounts: [
      {
        type: 'ExternalTokenInternetAccount',
        internetAccountId: 'manualGoogleEntry',
        name: 'Google Drive Manual Token Entry',
        description: 'Manually enter a token to access Google Drive files',
        tokenType: 'Bearer',
      },
    ],
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

const JBrowseLinearGenomeViewStories = {
  title: 'Linear View',
}

export default JBrowseLinearGenomeViewStories
