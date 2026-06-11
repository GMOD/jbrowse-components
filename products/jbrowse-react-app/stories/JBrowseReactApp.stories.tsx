import { useEffect, useState } from 'react'

import Plugin from '@jbrowse/core/Plugin'
import { ErrorMessage } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'

import { addRelativeUris } from './util.ts'
import volvoxConfigJson from '../public/test_data/volvox/config.json' with { type: 'json' }
import { JBrowseApp, createViewState, loadPlugins } from '../src/index.ts'
import makeWorkerInstance from '../src/makeWorkerInstance.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

export default {
  title: 'JBrowse React App',
}

// clone before tagging baseUri so we never mutate the shared imported JSON
const volvoxConfigPath = 'test_data/volvox/config.json'
const volvoxConfig = structuredClone(volvoxConfigJson)
addRelativeUris(
  volvoxConfig,
  new URL(volvoxConfigPath, window.location.href).href,
)

// ---------------------------------------------------------------------------
// BasicExample
// ---------------------------------------------------------------------------

function BasicExampleRender() {
  const [state] = useState(() =>
    createViewState({
      config: {
        assemblies: [
          {
            name: 'volvox',
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'volvox_refseq',
              adapter: {
                type: 'TwoBitAdapter',
                uri: 'volvox.2bit',
              },
            },
            refNameAliases: {
              adapter: {
                type: 'FromConfigAdapter',
                adapterId: 'W6DyPGJ0UU',
                features: [
                  {
                    refName: 'ctgA',
                    uniqueId: 'alias1',
                    aliases: ['A', 'contigA'],
                  },
                  {
                    refName: 'ctgB',
                    uniqueId: 'alias2',
                    aliases: ['B', 'contigB'],
                  },
                ],
              },
            },
          },
        ],
        tracks: [
          {
            type: 'AlignmentsTrack',
            trackId: 'volvox_cram',
            name: 'volvox-sorted.cram',
            assemblyNames: ['volvox'],
            category: ['Alignments'],
            adapter: {
              type: 'CramAdapter',
              uri: 'volvox-sorted.cram',
            },
          },
        ],
        defaultSession: {
          name: 'My session',
          views: [
            {
              id: 'view1',
              type: 'LinearGenomeView',
              init: {
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
                tracks: ['volvox_cram'],
                tracklist: true,
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}

export const BasicExample = {
  render: BasicExampleRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

export const BasicExample = () => {
  const [state] = useState(() =>
    createViewState({
      config: {
        assemblies: [
          {
            name: 'volvox',
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'volvox_refseq',
              adapter: { type: 'TwoBitAdapter', uri: 'volvox.2bit' },
            },
          },
        ],
        tracks: [
          {
            type: 'AlignmentsTrack',
            trackId: 'volvox_cram',
            name: 'volvox-sorted.cram',
            assemblyNames: ['volvox'],
            adapter: {
              type: 'CramAdapter',
              uri: 'volvox-sorted.cram',
            },
          },
        ],
        defaultSession: {
          name: 'My session',
          views: [
            {
              id: 'view1',
              type: 'LinearGenomeView',
              init: {
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
                tracks: ['volvox_cram'],
                tracklist: true,
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// HumanDemo
// ---------------------------------------------------------------------------

function HumanDemoRender() {
  const [viewState] = useState(() =>
    createViewState({
      config: {
        assemblies: [
          {
            name: 'GRCh38',
            aliases: ['hg38'],
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'GRCh38-ReferenceSequenceTrack',
              adapter: {
                type: 'BgzipFastaAdapter',
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
              },
            },
            refNameAliases: {
              adapter: {
                type: 'RefNameAliasAdapter',
                uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
              },
            },
          },
        ],
        tracks: [
          {
            type: 'FeatureTrack',
            trackId: 'genes',
            name: 'NCBI RefSeq Genes',
            assemblyNames: ['GRCh38'],
            category: ['Genes'],
            adapter: {
              type: 'Gff3TabixAdapter',
              uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
            },
            textSearching: {
              textSearchAdapter: {
                type: 'TrixTextSearchAdapter',
                textSearchAdapterId: 'gff3tabix_genes-index',
                ixFilePath: {
                  uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ix',
                },
                ixxFilePath: {
                  uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ixx',
                },
                metaFilePath: {
                  uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz_meta.json',
                },
                assemblyNames: ['GRCh38'],
              },
            },
          },
          {
            type: 'FeatureTrack',
            trackId: 'repeats_hg38',
            name: 'Repeats',
            assemblyNames: ['hg38'],
            category: ['Annotation'],
            adapter: {
              type: 'BigBedAdapter',
              uri: 'https://jbrowse.org/genomes/GRCh38/repeats.bb',
            },
          },
          {
            type: 'AlignmentsTrack',
            trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
            name: 'NA12878 Exome',
            assemblyNames: ['GRCh38'],
            category: ['1000 Genomes', 'Alignments'],
            adapter: {
              type: 'CramAdapter',
              uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
            },
          },
          {
            type: 'VariantTrack',
            trackId:
              'ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf',
            name: '1000 Genomes Variant Calls',
            assemblyNames: ['GRCh38'],
            category: ['1000 Genomes', 'Variants'],
            adapter: {
              type: 'VcfTabixAdapter',
              uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz',
            },
          },
          {
            type: 'QuantitativeTrack',
            trackId: 'hg38.100way.phyloP100way',
            name: 'hg38.100way.phyloP100way',
            category: ['Conservation'],
            assemblyNames: ['hg38'],
            adapter: {
              type: 'BigWigAdapter',
              uri: 'https://hgdownload.cse.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
            },
          },
        ],
        defaultSession: {
          name: 'Human demo',
          views: [
            {
              id: 'linearGenomeView',
              type: 'LinearGenomeView',
              init: {
                loc: '1:100,000-110,000',
                assembly: 'hg38',
                tracks: [
                  'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
                  'hg38.100way.phyloP100way',
                ],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={viewState} />
}

export const HumanDemo = {
  render: HumanDemoRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

export const HumanDemo = () => {
  const [viewState] = useState(() =>
    createViewState({
      config: {
        assemblies: [
          {
            name: 'GRCh38',
            aliases: ['hg38'],
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'GRCh38-ReferenceSequenceTrack',
              adapter: {
                type: 'BgzipFastaAdapter',
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
              },
            },
            refNameAliases: {
              adapter: {
                type: 'RefNameAliasAdapter',
                uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
              },
            },
          },
        ],
        tracks: [
          {
            type: 'AlignmentsTrack',
            trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
            name: 'NA12878 Exome',
            assemblyNames: ['GRCh38'],
            adapter: {
              type: 'CramAdapter',
              uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
            },
          },
          {
            type: 'QuantitativeTrack',
            trackId: 'hg38.100way.phyloP100way',
            name: 'hg38.100way.phyloP100way',
            assemblyNames: ['hg38'],
            adapter: {
              type: 'BigWigAdapter',
              uri: 'https://hgdownload.cse.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
            },
          },
        ],
        defaultSession: {
          name: 'Human demo',
          views: [
            {
              id: 'linearGenomeView',
              type: 'LinearGenomeView',
              init: {
                loc: '1:100,000-110,000',
                assembly: 'hg38',
                tracks: [
                  'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
                  'hg38.100way.phyloP100way',
                ],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={viewState} />
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithImportConfigJson
// ---------------------------------------------------------------------------

function WithImportConfigJsonRender() {
  const [state] = useState(() => createViewState({ config: volvoxConfig }))
  return <JBrowseApp viewState={state} />
}

export const WithImportConfigJson = {
  render: WithImportConfigJsonRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'
import config from './config.json' with { type: 'json' }

// Resolve relative URIs in the config by tagging each with a baseUri, which
// JBrowse uses to resolve the relative uri at load time
function addRelativeUris(config: unknown, baseUri: string) {
  if (typeof config === 'object' && config !== null) {
    const obj = config as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      const val = obj[key]
      if (typeof val === 'object' && val !== null) {
        addRelativeUris(val, baseUri)
      } else if (key === 'uri' && !obj.baseUri) {
        obj.baseUri = baseUri
      }
    }
  }
}

const configPath = './config.json'
addRelativeUris(config, new URL(configPath, window.location.href).href)

export const WithImportConfigJson = () => {
  const [state] = useState(() => createViewState({ config }))
  return <JBrowseApp viewState={state} />
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithFetchConfigJson
// ---------------------------------------------------------------------------

type ViewState = ReturnType<typeof createViewState>

function WithFetchConfigJsonRender() {
  const [state, setState] = useState<ViewState>()
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      const configPath = 'test_data/volvox/config.json'
      const response = await fetch(configPath)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching config ${configPath}`)
      }
      const config = await response.json()
      addRelativeUris(config, new URL(configPath, window.location.href).href)
      setState(createViewState({ config }))
    })()
  }, [])

  return state ? <JBrowseApp viewState={state} /> : null
}

export const WithFetchConfigJson = {
  render: WithFetchConfigJsonRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useEffect, useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

type ViewState = ReturnType<typeof createViewState>

// Resolve relative URIs in the config by tagging each with a baseUri, which
// JBrowse uses to resolve the relative uri at load time
function addRelativeUris(config: unknown, baseUri: string) {
  if (typeof config === 'object' && config !== null) {
    const obj = config as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      const val = obj[key]
      if (typeof val === 'object' && val !== null) {
        addRelativeUris(val, baseUri)
      } else if (key === 'uri' && !obj.baseUri) {
        obj.baseUri = baseUri
      }
    }
  }
}

export const WithFetchConfigJson = () => {
  const [state, setState] = useState<ViewState>()
  useEffect(() => {
    ;(async () => {
      const configPath = './config.json'
      const response = await fetch(configPath)
      if (!response.ok) {
        throw new Error(\`HTTP \${response.status} fetching config \${configPath}\`)
      }
      const config = await response.json()
      addRelativeUris(config, new URL(configPath, window.location.href).href)
      setState(createViewState({ config }))
    })()
  }, [])

  return state ? <JBrowseApp viewState={state} /> : null
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// DarkTheme
// ---------------------------------------------------------------------------

function DarkThemeRender() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        configuration: {
          theme: {
            palette: {
              mode: 'dark',
            },
          },
        },
        defaultSession: {
          name: 'My session',
          views: [
            {
              id: 'view1',
              type: 'LinearGenomeView',
              init: {
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
                tracks: ['volvox_cram'],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}

export const DarkTheme = {
  render: DarkThemeRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

export const DarkTheme = () => {
  const [state] = useState(() =>
    createViewState({
      config: {
        configuration: {
          theme: {
            palette: {
              mode: 'dark',
            },
          },
        },
        assemblies: [
          {
            name: 'volvox',
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'volvox_refseq',
              adapter: { type: 'TwoBitAdapter', uri: 'volvox.2bit' },
            },
          },
        ],
        tracks: [
          {
            type: 'AlignmentsTrack',
            trackId: 'volvox_cram',
            name: 'volvox-sorted.cram',
            assemblyNames: ['volvox'],
            adapter: {
              type: 'CramAdapter',
              uri: 'volvox-sorted.cram',
            },
          },
        ],
        defaultSession: {
          name: 'My session',
          views: [
            {
              id: 'view1',
              type: 'LinearGenomeView',
              init: {
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
                tracks: ['volvox_cram'],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// SyntenyExample
// ---------------------------------------------------------------------------

function SyntenyExampleRender() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'Volvox vs Volvox Del synteny',
          views: [
            {
              id: 'synteny_view',
              type: 'LinearSyntenyView',
              init: {
                views: [{ assembly: 'volvox' }, { assembly: 'volvox_del' }],
                tracks: ['volvox_del.paf'],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}

export const SyntenyExample = {
  render: SyntenyExampleRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

// config is loaded from a config.json that includes both 'volvox' and
// 'volvox_del' assemblies and a 'volvox_del.paf' synteny track
export const SyntenyExample = () => {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...config,
        defaultSession: {
          name: 'Volvox vs Volvox Del synteny',
          views: [
            {
              id: 'synteny_view',
              type: 'LinearSyntenyView',
              init: {
                views: [{ assembly: 'volvox' }, { assembly: 'volvox_del' }],
                tracks: ['volvox_del.paf'],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithLaunchLinearGenomeView
// ---------------------------------------------------------------------------

function WithLaunchLinearGenomeViewRender() {
  const [viewState, setViewState] =
    useState<ReturnType<typeof createViewState>>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const state = createViewState({
          config: {
            assemblies: [
              {
                name: 'GRCh38',
                aliases: ['hg38'],
                sequence: {
                  type: 'ReferenceSequenceTrack',
                  trackId: 'GRCh38-ReferenceSequenceTrack',
                  adapter: {
                    type: 'BgzipFastaAdapter',
                    uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
                  },
                },
                refNameAliases: {
                  adapter: {
                    type: 'RefNameAliasAdapter',
                    uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
                  },
                },
              },
            ],
            tracks: [
              {
                type: 'QuantitativeTrack',
                trackId: 'hg38.100way.phyloP100way',
                name: 'hg38.100way.phyloP100way',
                category: ['Conservation'],
                assemblyNames: ['hg38'],
                adapter: {
                  type: 'BigWigAdapter',
                  uri: 'https://hgdownload.cse.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
                },
              },
            ],
          },
        })
        const { pluginManager } = getEnv(state)

        setViewState(state)
        await pluginManager.evaluateAsyncExtensionPoint(
          'LaunchView-LinearGenomeView',
          {
            tracks: ['hg38.100way.phyloP100way'],
            loc: 'chr10:1-100000',
            assembly: 'hg38',
            session: state.session,
          },
        )
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [])

  return viewState ? (
    <>
      {error ? <ErrorMessage error={error} /> : null}
      <JBrowseApp viewState={viewState} />
    </>
  ) : null
}

export const WithLaunchLinearGenomeView = {
  render: WithLaunchLinearGenomeViewRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useEffect, useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'
import { ErrorMessage } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'

export const WithLaunchLinearGenomeView = () => {
  const [viewState, setViewState] = useState<ReturnType<typeof createViewState>>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    ;(async () => {
      try {
        const state = createViewState({
          config: {
            assemblies: [
              {
                name: 'GRCh38',
                aliases: ['hg38'],
                sequence: {
                  type: 'ReferenceSequenceTrack',
                  trackId: 'GRCh38-ReferenceSequenceTrack',
                  adapter: {
                    type: 'BgzipFastaAdapter',
                    uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
                  },
                },
                refNameAliases: {
                  adapter: {
                    type: 'RefNameAliasAdapter',
                    uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
                  },
                },
              },
            ],
            tracks: [
              {
                type: 'QuantitativeTrack',
                trackId: 'hg38.100way.phyloP100way',
                name: 'hg38.100way.phyloP100way',
                assemblyNames: ['hg38'],
                adapter: {
                  type: 'BigWigAdapter',
                  uri: 'https://hgdownload.cse.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
                },
              },
            ],
          },
        })
        const { pluginManager } = getEnv(state)

        setViewState(state)
        await pluginManager.evaluateAsyncExtensionPoint(
          'LaunchView-LinearGenomeView',
          {
            tracks: ['hg38.100way.phyloP100way'],
            loc: 'chr10:1-100000',
            assembly: 'hg38',
            session: state.session,
          },
        )
      } catch (e) {
        setError(e)
      }
    })()
  }, [])

  return viewState ? (
    <>
      {error ? <ErrorMessage error={error} /> : null}
      <JBrowseApp viewState={viewState} />
    </>
  ) : null
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// DotplotExample
// ---------------------------------------------------------------------------

function DotplotExampleRender() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'Volvox dotplot (self-vs-self)',
          views: [
            {
              id: 'dotplot_view',
              type: 'DotplotView',
              init: {
                views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
                tracks: ['volvox_fake_synteny'],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}

export const DotplotExample = {
  render: DotplotExampleRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

// config includes assemblies and a 'volvox_fake_synteny' dotplot track
export const DotplotExample = () => {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...config,
        defaultSession: {
          name: 'Volvox dotplot (self-vs-self)',
          views: [
            {
              id: 'dotplot_view',
              type: 'DotplotView',
              init: {
                views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
                tracks: ['volvox_fake_synteny'],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// CircularExample
// ---------------------------------------------------------------------------

function CircularExampleRender() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'Volvox structural variants (circular)',
          views: [
            {
              id: 'circular_view',
              type: 'CircularView',
              init: {
                assembly: 'volvox',
                tracks: ['volvox_sv_test'],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}

export const CircularExample = {
  render: CircularExampleRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

// config includes the 'volvox' assembly and a 'volvox_sv_test' chord track
export const CircularExample = () => {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...config,
        defaultSession: {
          name: 'Volvox structural variants (circular)',
          views: [
            {
              id: 'circular_view',
              type: 'CircularView',
              init: {
                assembly: 'volvox',
                tracks: ['volvox_sv_test'],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// SpreadsheetExample
// ---------------------------------------------------------------------------

function SpreadsheetExampleRender() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'Volvox VCF spreadsheet',
          views: [
            {
              id: 'spreadsheet_view',
              type: 'SpreadsheetView',
              init: {
                assembly: 'volvox',
                uri: 'test_data/volvox/volvox.filtered.vcf.gz',
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}

export const SpreadsheetExample = {
  render: SpreadsheetExampleRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

export const SpreadsheetExample = () => {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...config,
        defaultSession: {
          name: 'Volvox VCF spreadsheet',
          views: [
            {
              id: 'spreadsheet_view',
              type: 'SpreadsheetView',
              init: {
                assembly: 'volvox',
                uri: 'path/to/variants.vcf.gz',
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// SvInspectorExample
// ---------------------------------------------------------------------------

function SvInspectorExampleRender() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'Volvox SV inspector',
          views: [
            {
              id: 'sv_inspector_view',
              type: 'SvInspectorView',
              init: {
                assembly: 'volvox',
                uri: 'test_data/volvox/volvox.dup.vcf.gz',
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}

export const SvInspectorExample = {
  render: SvInspectorExampleRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

export const SvInspectorExample = () => {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...config,
        defaultSession: {
          name: 'Volvox SV inspector',
          views: [
            {
              id: 'sv_inspector_view',
              type: 'SvInspectorView',
              init: {
                assembly: 'volvox',
                uri: 'path/to/structural-variants.vcf.gz',
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// BreakpointSplitExample
// ---------------------------------------------------------------------------

function BreakpointSplitExampleRender() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'Volvox breakpoint split view',
          views: [
            {
              id: 'breakpoint_split_view',
              type: 'BreakpointSplitView',
              init: {
                views: [
                  {
                    loc: 'ctgA:1-5000',
                    assembly: 'volvox',
                    tracks: ['volvox_sv_cram'],
                  },
                  {
                    loc: 'ctgB:1-5000',
                    assembly: 'volvox',
                    tracks: ['volvox_sv_cram'],
                  },
                ],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}

export const BreakpointSplitExample = {
  render: BreakpointSplitExampleRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

// config includes a 'volvox_sv_cram' alignments track with SV reads
export const BreakpointSplitExample = () => {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...config,
        defaultSession: {
          name: 'Volvox breakpoint split view',
          views: [
            {
              id: 'breakpoint_split_view',
              type: 'BreakpointSplitView',
              init: {
                views: [
                  { loc: 'ctgA:1-5000', assembly: 'volvox', tracks: ['volvox_sv_cram'] },
                  { loc: 'ctgB:1-5000', assembly: 'volvox', tracks: ['volvox_sv_cram'] },
                ],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// AddTracksProgrammatically
// ---------------------------------------------------------------------------

const genesTrackConf = volvoxConfig.tracks.find(
  (t: { trackId: string }) => t.trackId === 'gff3tabix_genes',
)!

function AddTracksProgrammaticallyRender() {
  const [added, setAdded] = useState(false)

  const [state] = useState(() =>
    createViewState({
      config: {
        assemblies: volvoxConfig.assemblies,
        tracks: volvoxConfig.tracks.filter(
          (t: { trackId: string }) => t.trackId !== 'gff3tabix_genes',
        ),
        defaultSession: {
          name: 'Programmatic tracks',
          views: [
            {
              id: 'view1',
              type: 'LinearGenomeView',
              init: {
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
              },
            },
          ],
        },
      },
    }),
  )

  function addTrack() {
    state.jbrowse.addTrackConf(genesTrackConf)
    state.session.views[0]?.showTrack('gff3tabix_genes')
    setAdded(true)
  }

  return (
    <div>
      <button
        disabled={added}
        onClick={() => {
          addTrack()
        }}
      >
        {added ? 'Genes track added' : 'Add genes track'}
      </button>
      <JBrowseApp viewState={state} />
    </div>
  )
}

export const AddTracksProgrammatically = {
  render: AddTracksProgrammaticallyRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

// genesTrackConf is a track config object that you want to add at runtime
const genesTrackConf = { /* your track config */ }

export const AddTracksProgrammatically = () => {
  const [added, setAdded] = useState(false)

  const [state] = useState(() =>
    createViewState({
      config: {
        assemblies: [/* your assembly */],
        tracks: [],
        defaultSession: {
          name: 'Programmatic tracks',
          views: [
            {
              id: 'view1',
              type: 'LinearGenomeView',
              init: { assembly: 'GRCh38', loc: '1:1..50000' },
            },
          ],
        },
      },
    }),
  )

  function addTrack() {
    state.jbrowse.addTrackConf(genesTrackConf)
    state.session.views[0]?.showTrack(genesTrackConf.trackId)
    setAdded(true)
  }

  return (
    <div>
      <button disabled={added} onClick={() => { addTrack() }}>
        {added ? 'Track added' : 'Add track'}
      </button>
      <JBrowseApp viewState={state} />
    </div>
  )
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// EmbeddedPlugin
// ---------------------------------------------------------------------------

class HighlightRegionPlugin extends Plugin {
  name = 'HighlightRegionPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint<PluggableElementType>(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const view = pluggableElement as ViewType
          const newStateModel = view.stateModel.extend(self => {
            const superItems = self.rubberBandMenuItems
            return {
              views: {
                rubberBandMenuItems() {
                  return [
                    ...superItems(),
                    {
                      label: 'Console log selected region',
                      onClick: () => {
                        const { leftOffset, rightOffset } = self
                        // eslint-disable-next-line no-console
                        console.log(
                          JSON.stringify(
                            self.getSelectedRegions(leftOffset, rightOffset),
                          ),
                        )
                      },
                    },
                  ]
                },
              },
            }
          })
          view.stateModel = newStateModel
        }
        return pluggableElement
      },
    )
  }

  configure() {}
}

function EmbeddedPluginRender() {
  const [state] = useState(() =>
    createViewState({
      config: volvoxConfig,
      plugins: [HighlightRegionPlugin],
    }),
  )

  return <JBrowseApp viewState={state} />
}

export const EmbeddedPlugin = {
  render: EmbeddedPluginRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import Plugin from '@jbrowse/core/Plugin'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

class HighlightRegionPlugin extends Plugin {
  name = 'HighlightRegionPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint<PluggableElementType>(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const view = pluggableElement as ViewType
          const newStateModel = view.stateModel.extend(self => {
            const superItems = self.rubberBandMenuItems
            return {
              views: {
                rubberBandMenuItems() {
                  return [
                    ...superItems(),
                    {
                      label: 'Console log selected region',
                      onClick: () => {
                        const { leftOffset, rightOffset } = self
                        console.log(
                          JSON.stringify(
                            self.getSelectedRegions(leftOffset, rightOffset),
                          ),
                        )
                      },
                    },
                  ]
                },
              },
            }
          })
          view.stateModel = newStateModel
        }
        return pluggableElement
      },
    )
  }

  configure() {}
}

export const EmbeddedPlugin = () => {
  const [state] = useState(() =>
    createViewState({
      config,
      plugins: [HighlightRegionPlugin],
    }),
  )

  return <JBrowseApp viewState={state} />
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithWebWorker
// ---------------------------------------------------------------------------

function WithWebWorkerRender() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        configuration: {
          rpc: {
            defaultDriver: 'WebWorkerRpcDriver',
          },
        },
        defaultSession: {
          name: 'Web worker example',
          views: [
            {
              type: 'LinearGenomeView',
              init: {
                assembly: 'volvox',
                loc: 'ctgA:1000-2000',
                tracks: ['Deep sequencing'],
              },
            },
          ],
        },
      },
      makeWorkerInstance,
    }),
  )

  return <JBrowseApp viewState={state} />
}

export const WithWebWorker = {
  render: WithWebWorkerRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'
import makeWorkerInstance from '@jbrowse/react-app2/esm/makeWorkerInstance'

export const WithWebWorker = () => {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...config,
        configuration: {
          rpc: {
            defaultDriver: 'WebWorkerRpcDriver',
          },
        },
        defaultSession: {
          name: 'Web worker example',
          views: [
            {
              type: 'LinearGenomeView',
              init: {
                assembly: 'GRCh38',
                loc: '1:1000-2000',
                tracks: ['my-track-id'],
              },
            },
          ],
        },
      },
      makeWorkerInstance,
    }),
  )

  return <JBrowseApp viewState={state} />
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithOnChange
// ---------------------------------------------------------------------------

function WithOnChangeRender() {
  const [log, setLog] = useState<string[]>([])
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'onChange example',
          views: [
            {
              id: 'view1',
              type: 'LinearGenomeView',
              init: {
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
                tracks: ['volvox_cram'],
              },
            },
          ],
        },
      },
      onChange: patch => {
        setLog(prev => [`${patch.op} ${patch.path}`, ...prev].slice(0, 8))
      },
    }),
  )

  return (
    <div>
      <div
        style={{
          padding: 8,
          fontFamily: 'monospace',
          fontSize: 12,
          background: '#8881',
        }}
      >
        <div>Recent session patches (pan/zoom, or show/hide a track):</div>
        <pre style={{ margin: 0 }}>
          {log.join('\n') || '(interact with the view to see patches)'}
        </pre>
      </div>
      <JBrowseApp viewState={state} />
    </div>
  )
}

export const WithOnChange = {
  render: WithOnChangeRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

// onChange fires on every MST patch. Use it to persist the session (e.g. to
// localStorage or a backend), drive an undo/redo stack, or sync external UI.
export const WithOnChange = () => {
  const [log, setLog] = useState<string[]>([])
  const [state] = useState(() =>
    createViewState({
      config: {
        assemblies: [
          {
            name: 'volvox',
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'volvox_refseq',
              adapter: { type: 'TwoBitAdapter', uri: 'volvox.2bit' },
            },
          },
        ],
        tracks: [
          {
            type: 'AlignmentsTrack',
            trackId: 'volvox_cram',
            name: 'volvox-sorted.cram',
            assemblyNames: ['volvox'],
            adapter: {
              type: 'CramAdapter',
              uri: 'volvox-sorted.cram',
            },
          },
        ],
        defaultSession: {
          name: 'onChange example',
          views: [
            {
              id: 'view1',
              type: 'LinearGenomeView',
              init: {
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
                tracks: ['volvox_cram'],
              },
            },
          ],
        },
      },
      onChange: patch => {
        setLog(prev => [\`\${patch.op} \${patch.path}\`, ...prev].slice(0, 8))
      },
    }),
  )

  return (
    <div>
      <pre>{log.join('\\n')}</pre>
      <JBrowseApp viewState={state} />
    </div>
  )
}
`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithExternalPlugin
// ---------------------------------------------------------------------------

function WithExternalPluginRender() {
  const [viewState, setViewState] =
    useState<ReturnType<typeof createViewState>>()
  const [error, setError] = useState<unknown>()

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
          config: {
            assemblies: [
              {
                name: 'hg19',
                aliases: ['GRCh37'],
                sequence: {
                  type: 'ReferenceSequenceTrack',
                  trackId: 'Pd8Wh30ei9R',
                  adapter: {
                    type: 'BgzipFastaAdapter',
                    uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
                  },
                },
                refNameAliases: {
                  adapter: {
                    type: 'RefNameAliasAdapter',
                    uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
                  },
                },
              },
            ],
            tracks: [
              {
                type: 'FeatureTrack',
                trackId: 'segdups_ucsc_hg19',
                name: 'UCSC SegDups',
                assemblyNames: ['hg19'],
                adapter: { type: 'UCSCAdapter', track: 'genomicSuperDups' },
              },
            ],
            defaultSession: {
              name: 'External plugin example',
              views: [
                {
                  id: 'view1',
                  type: 'LinearGenomeView',
                  init: {
                    assembly: 'hg19',
                    loc: '1:2,467,681..2,667,681',
                    tracks: ['segdups_ucsc_hg19'],
                  },
                },
              ],
            },
          },
          plugins: plugins.map(p => p.plugin),
        })
        setViewState(state)
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [])

  return error ? (
    <ErrorMessage error={error} />
  ) : viewState ? (
    <JBrowseApp viewState={viewState} />
  ) : null
}

export const WithExternalPlugin = {
  render: WithExternalPluginRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useEffect, useState } from 'react'
import { JBrowseApp, createViewState, loadPlugins } from '@jbrowse/react-app2'
import { ErrorMessage } from '@jbrowse/core/ui'

type ViewState = ReturnType<typeof createViewState>

// loadPlugins fetches plugins at runtime from a URL (here the UCSC plugin from
// unpkg), so you don't have to bundle them. Pass the resulting classes to
// createViewState the same way you would inline plugins.
export const WithExternalPlugin = () => {
  const [viewState, setViewState] = useState<ViewState>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    ;(async () => {
      try {
        const plugins = await loadPlugins([
          {
            name: 'UCSC',
            url: 'https://unpkg.com/jbrowse-plugin-ucsc@^1/dist/jbrowse-plugin-ucsc.umd.production.min.js',
          },
        ])
        const state = createViewState({
          config: {
            assemblies: [
              {
                name: 'hg19',
                aliases: ['GRCh37'],
                sequence: {
                  type: 'ReferenceSequenceTrack',
                  trackId: 'Pd8Wh30ei9R',
                  adapter: {
                    type: 'BgzipFastaAdapter',
                    uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
                  },
                },
              },
            ],
            tracks: [
              {
                type: 'FeatureTrack',
                trackId: 'segdups_ucsc_hg19',
                name: 'UCSC SegDups',
                assemblyNames: ['hg19'],
                adapter: { type: 'UCSCAdapter', track: 'genomicSuperDups' },
              },
            ],
            defaultSession: {
              name: 'External plugin example',
              views: [
                {
                  id: 'view1',
                  type: 'LinearGenomeView',
                  init: {
                    assembly: 'hg19',
                    loc: '1:2,467,681..2,667,681',
                    tracks: ['segdups_ucsc_hg19'],
                  },
                },
              ],
            },
          },
          plugins: plugins.map(p => p.plugin),
        })
        setViewState(state)
      } catch (e) {
        setError(e)
      }
    })()
  }, [])

  return error ? (
    <ErrorMessage error={error} />
  ) : viewState ? (
    <JBrowseApp viewState={viewState} />
  ) : null
}
`,
      },
    },
  },
}
