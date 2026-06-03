/* eslint-disable no-console */
import { createElement, useEffect, useRef, useState } from 'react'

import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import Plugin from '@jbrowse/core/Plugin'
import { getConf } from '@jbrowse/core/configuration'
import { ErrorBanner } from '@jbrowse/core/ui'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import r2wc from '@r2wc/react-to-web-component'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'
import { createPortal } from 'react-dom'

import {
  JBrowseLinearGenomeView,
  createViewState,
  loadPlugins,
  useCreateViewState,
} from '../src/index.ts'
import {
  ViewWithErrorHandling,
  addRelativeUris,
  getVolvoxConfig,
} from './examples/util.tsx'
import makeWorkerInstance from '../src/makeWorkerInstance.ts'

// barrel re-exports for stories not shown in MDX (appear in "Source code for examples" page)
export {
  NextstrainExample,
  OneLinearGenomeView,
  PanUKBGWAS,
  UseCreateViewState,
} from './examples/index.ts'

import type { ViewModel } from '../src/index.ts'
import type { EmotionCache } from '@emotion/cache'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Feature } from '@jbrowse/core/util'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// tags: ['!dev'] keeps these out of the sidebar; they still power <Canvas of={...}>
// embeds in the MDX docs pages and remain available via "Show code"
export default { title: 'Source code for examples', tags: ['!dev'] }

// ---------------------------------------------------------------------------
// Shared volvox inline config used in source.code strings
// ---------------------------------------------------------------------------
const VOLVOX_SOURCE_CONFIG = `\
const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: { uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: { uri: 'https://jbrowse.org/genomes/volvox/volvox.sort.gff3.gz' },
      index: { location: { uri: 'https://jbrowse.org/genomes/volvox/volvox.sort.gff3.gz.tbi' } },
    },
  },
]`

// ---------------------------------------------------------------------------
// WithInit — already defined inline, keep unchanged
// ---------------------------------------------------------------------------

const assembly = {
  name: 'hg38',
  aliases: ['GRCh38'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'P6R5xbRqRr',
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
  cytobands: {
    adapter: {
      type: 'CytobandAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/cytoBand.txt',
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'ncbi-refseq-genes',
    name: 'NCBI RefSeq Genes',
    category: ['Genes'],
    assemblyNames: ['hg38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: {
        uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
      },
      index: {
        location: {
          uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
        },
        indexType: 'CSI',
      },
    },
  },
]

function WithInitRender() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'My session',
        view: {
          type: 'LinearGenomeView',
          init: {
            assembly: 'hg38',
            loc: 'chr1:11,106,077-11,261,675',
            tracks: ['ncbi-refseq-genes'],
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithInit = {
  render: WithInitRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'hg38',
  aliases: ['GRCh38'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'P6R5xbRqRr',
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
  cytobands: {
    adapter: {
      type: 'CytobandAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/cytoBand.txt',
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'ncbi-refseq-genes',
    name: 'NCBI RefSeq Genes',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: { uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz' },
      index: {
        location: { uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi' },
        indexType: 'CSI',
      },
    },
  },
]

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'My session',
        view: {
          type: 'LinearGenomeView',
          init: {
            assembly: 'hg38',
            loc: 'chr1:11,106,077-11,261,675',
            tracks: ['ncbi-refseq-genes'],
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// DefaultSession
// ---------------------------------------------------------------------------

function DefaultSessionRender() {
  const { assembly, tracks } = getVolvoxConfig()
  const state = useCreateViewState({
    assembly,
    tracks,
    defaultSession: {
      name: 'My session',
      view: {
        type: 'LinearGenomeView',
        init: {
          loc: 'ctgA:1105..1221',
          assembly: 'volvox',
          tracks: ['volvox-long-reads-sv-bam'],
        },
      },
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export const DefaultSession = {
  render: DefaultSessionRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const state = useCreateViewState({
    assembly,
    tracks,
    defaultSession: {
      name: 'My session',
      view: {
        type: 'LinearGenomeView',
        init: {
          loc: 'ctgA:1105..1221',
          assembly: 'volvox',
          tracks: ['volvox-long-reads-sv-bam'],
        },
      },
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// DisableAddTrack
// ---------------------------------------------------------------------------

function DisableAddTrackRender() {
  const { assembly, tracks } = getVolvoxConfig()
  const state = useCreateViewState({
    assembly,
    tracks,
    disableAddTracks: true,
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export const DisableAddTrack = {
  render: DisableAddTrackRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const state = useCreateViewState({
    assembly,
    tracks,
    disableAddTracks: true,
  })
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// ExternalNavigateLocstring
// ---------------------------------------------------------------------------

const bookmarks = [
  { label: 'ctgA — region A', loc: 'ctgA:1,000..5,000' },
  { label: 'ctgA — region B', loc: 'ctgA:20,000..25,000' },
  { label: 'ctgB — region C', loc: 'ctgB:1..2,000' },
]

function ExternalNavigateLocstringRender() {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      location: 'ctgA:1,000..5,000',
    }),
  )
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        {bookmarks.map(b => (
          <button
            key={b.loc}
            style={{ marginRight: 8 }}
            onClick={() => {
              state.session.view.navToLocString(b.loc).catch((e: unknown) => {
                console.error(e)
              })
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}

export const ExternalNavigateLocstring = {
  render: ExternalNavigateLocstringRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

const bookmarks = [
  { label: 'ctgA — region A', loc: 'ctgA:1,000..5,000' },
  { label: 'ctgA — region B', loc: 'ctgA:20,000..25,000' },
  { label: 'ctgB — region C', loc: 'ctgB:1..2,000' },
]

function App() {
  const [state] = useState(() =>
    createViewState({ assembly, tracks, location: 'ctgA:1,000..5,000' }),
  )
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        {bookmarks.map(b => (
          <button
            key={b.loc}
            style={{ marginRight: 8 }}
            onClick={() => {
              state.session.view.navToLocString(b.loc).catch((e: unknown) => {
                console.error(e)
              })
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// ExternalNavigateObject
// ---------------------------------------------------------------------------

const hits = [
  { label: 'gene1', refName: 'ctgA', start: 1050, end: 9000 },
  { label: 'gene2', refName: 'ctgA', start: 20000, end: 23000 },
  { label: 'gene3', refName: 'ctgB', start: 100, end: 1500 },
]

function ExternalNavigateObjectRender() {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      location: 'ctgA:1,000..5,000',
    }),
  )
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        {hits.map(h => (
          <button
            key={h.label}
            style={{ marginRight: 8 }}
            onClick={() => {
              state.session.view
                .navToLocations([
                  { refName: h.refName, start: h.start, end: h.end },
                ])
                .catch((e: unknown) => {
                  console.error(e)
                })
            }}
          >
            {h.label}
          </button>
        ))}
      </div>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}

export const ExternalNavigateObject = {
  render: ExternalNavigateObjectRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

const hits = [
  { label: 'gene1', refName: 'ctgA', start: 1050, end: 9000 },
  { label: 'gene2', refName: 'ctgA', start: 20000, end: 23000 },
  { label: 'gene3', refName: 'ctgB', start: 100, end: 1500 },
]

function App() {
  const [state] = useState(() =>
    createViewState({ assembly, tracks, location: 'ctgA:1,000..5,000' }),
  )
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        {hits.map(h => (
          <button
            key={h.label}
            style={{ marginRight: 8 }}
            onClick={() => {
              state.session.view
                .navToLocations([{ refName: h.refName, start: h.start, end: h.end }])
                .catch((e: unknown) => { console.error(e) })
            }}
          >
            {h.label}
          </button>
        ))}
      </div>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// HorizontallyFlipped*
// ---------------------------------------------------------------------------

function FlipButton({ state }: { state: ViewModel }) {
  const [error, setError] = useState<unknown>()
  return (
    <div>
      <button
        onClick={() => {
          try {
            state.session.view.horizontallyFlip()
          } catch (e) {
            setError(e)
          }
        }}
      >
        Horizontally flip
      </button>
      {error ? <ErrorBanner error={error} /> : null}
    </div>
  )
}

function HorizontallyFlippedViaLocstringRender() {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      location: 'ctgA:1-50000[rev]',
    }),
  )
  return (
    <div>
      <p>
        The <code>[rev]</code> suffix in a locstring navigates to that region in
        the horizontally flipped orientation.
      </p>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}

export const HorizontallyFlippedViaLocstring = {
  render: HorizontallyFlippedViaLocstringRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const [state] = useState(() =>
    createViewState({ assembly, tracks, location: 'ctgA:1-50000[rev]' }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

function HorizontallyFlippedViaButtonRender() {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      location: 'ctgA:1-50000',
    }),
  )
  return (
    <div>
      <p>
        Call <code>state.session.view.horizontallyFlip()</code> at any time to
        toggle the flipped orientation.
      </p>
      <FlipButton state={state} />
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}

export const HorizontallyFlippedViaButton = {
  render: HorizontallyFlippedViaButtonRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { ErrorBanner } from '@jbrowse/core/ui'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

type ViewState = ReturnType<typeof createViewState>

function FlipButton({ state }: { state: ViewState }) {
  const [error, setError] = useState<unknown>()
  return (
    <div>
      <button
        onClick={() => {
          try {
            state.session.view.horizontallyFlip()
          } catch (e) {
            setError(e)
          }
        }}
      >
        Horizontally flip
      </button>
      {error ? <ErrorBanner error={error} /> : null}
    </div>
  )
}

function App() {
  const [state] = useState(() =>
    createViewState({ assembly, tracks, location: 'ctgA:1-50000' }),
  )
  return (
    <div>
      <FlipButton state={state} />
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}`,
      },
    },
  },
}

function HorizontallyFlippedViaDisplayedRegionsRender() {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Horizontally flipped via displayedRegions',
        view: {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            {
              refName: 'ctgA',
              start: 0,
              end: 50001,
              reversed: true,
              assemblyName: 'volvox',
            },
          ],
        },
      },
    }),
  )
  return (
    <div>
      <p>
        Set <code>reversed: true</code> on a region in{' '}
        <code>displayedRegions</code> in your <code>defaultSession</code> to
        start in the horizontally flipped orientation.
      </p>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}

export const HorizontallyFlippedViaDisplayedRegions = {
  render: HorizontallyFlippedViaDisplayedRegionsRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Horizontally flipped via displayedRegions',
        view: {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            { refName: 'ctgA', start: 0, end: 50001, reversed: true, assemblyName: 'volvox' },
          ],
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// HumanExomeExample
// ---------------------------------------------------------------------------

const humanAssembly = {
  name: 'GRCh38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GRCh38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
    },
  },
  aliases: ['hg38'],
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
  },
}

const humanTracks = [
  {
    type: 'FeatureTrack',
    trackId: 'ncbi-refseq-genes',
    name: 'NCBI RefSeq Genes',
    category: ['Genes'],
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
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
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
      sequenceAdapter: {
        type: 'BgzipFastaAdapter',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
      },
    },
  },
]

function HumanExomeExampleRender() {
  const [state] = useState(() =>
    createViewState({
      assembly: humanAssembly,
      tracks: humanTracks,
      defaultSession: {
        name: 'My session',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: '1:100,987,269..100,987,368',
            assembly: 'GRCh38',
            tracks: ['NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome'],
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}

export const HumanExomeExample = {
  render: HumanExomeExampleRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'GRCh38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GRCh38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
    },
  },
  aliases: ['hg38'],
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'ncbi-refseq-genes',
    name: 'NCBI RefSeq Genes',
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
    name: 'NA12878 Exome',
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'CramAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
      sequenceAdapter: {
        type: 'BgzipFastaAdapter',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
      },
    },
  },
]

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'My session',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: '1:100,987,269..100,987,368',
            assembly: 'GRCh38',
            tracks: ['NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome'],
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// ShadowDOMOneLinearGenomeView
// ---------------------------------------------------------------------------

const ShadowComponent = () => {
  const node = useRef<HTMLDivElement>(null)
  const nodeForPin = useRef(null)
  const [rootNode, setRootNode] = useState<ShadowRoot>()
  const [cacheNode, setCacheNode] = useState<EmotionCache>()
  const [config, setConfig] = useState<ViewModel>()
  useEffect(() => {
    if (!node.current) {
      return
    }
    const { assembly: shadowAssembly, tracks: shadowTracks } = getVolvoxConfig()
    const root = node.current.attachShadow({ mode: 'open' })
    setRootNode(root)
    setCacheNode(
      createCache({
        key: 'react-shadow',
        prepend: true,
        container: root,
      }),
    )
    setConfig(
      createViewState({
        assembly: shadowAssembly,
        tracks: shadowTracks,
        location: 'ctgA:1105..1221',
        configuration: {
          theme: {
            palette: {
              primary: { main: '#4400a6' },
            },
            components: {
              MuiPopover: {
                defaultProps: { container: () => nodeForPin.current },
              },
              MuiPopper: {
                defaultProps: { container: () => nodeForPin.current },
              },
              MuiTooltip: {
                defaultProps: {
                  slotProps: {
                    popper: { container: () => nodeForPin.current },
                  },
                },
              },
              MuiModal: {
                defaultProps: { container: () => nodeForPin.current },
              },
              MuiMenu: {
                defaultProps: { container: () => nodeForPin.current },
              },
            },
          },
        },
      }),
    )
  }, [])
  return (
    <div ref={node}>
      {rootNode && config
        ? createPortal(
            // @ts-expect-error
            <CacheProvider value={cacheNode}>
              <JBrowseLinearGenomeView viewState={config} />
              <div ref={nodeForPin} />
            </CacheProvider>,
            rootNode,
          )
        : null}
    </div>
  )
}

const JBrowseCustom = () => {
  return createElement(ShadowComponent, null, null)
}

function ShadowDOMOneLinearGenomeViewRender() {
  if (customElements.get('jbrowse-linear-view') === undefined) {
    customElements.define('jbrowse-linear-view', r2wc(JBrowseCustom))
  }
  return (
    <div>
      {/* @ts-expect-error */}
      <jbrowse-linear-view />
    </div>
  )
}

export const ShadowDOMOneLinearGenomeView = {
  render: ShadowDOMOneLinearGenomeViewRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { createElement, useEffect, useRef, useState } from 'react'
import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import r2wc from '@r2wc/react-to-web-component'
import { createPortal } from 'react-dom'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import type { EmotionCache } from '@emotion/cache'

${VOLVOX_SOURCE_CONFIG}

type ViewState = ReturnType<typeof createViewState>

const ShadowComponent = () => {
  const node = useRef<HTMLDivElement>(null)
  const nodeForPin = useRef(null)
  const [rootNode, setRootNode] = useState<ShadowRoot>()
  const [cacheNode, setCacheNode] = useState<EmotionCache>()
  const [config, setConfig] = useState<ViewState>()
  useEffect(() => {
    if (!node.current) return
    const root = node.current.attachShadow({ mode: 'open' })
    setRootNode(root)
    setCacheNode(createCache({ key: 'react-shadow', prepend: true, container: root }))
    setConfig(
      createViewState({
        assembly,
        tracks,
        location: 'ctgA:1105..1221',
        configuration: {
          theme: {
            palette: { primary: { main: '#4400a6' } },
            components: {
              MuiPopover: { defaultProps: { container: () => nodeForPin.current } },
              MuiPopper: { defaultProps: { container: () => nodeForPin.current } },
              MuiTooltip: {
                defaultProps: { slotProps: { popper: { container: () => nodeForPin.current } } },
              },
              MuiModal: { defaultProps: { container: () => nodeForPin.current } },
              MuiMenu: { defaultProps: { container: () => nodeForPin.current } },
            },
          },
        },
      }),
    )
  }, [])
  return (
    <div ref={node}>
      {rootNode && config
        ? createPortal(
            <CacheProvider value={cacheNode}>
              <JBrowseLinearGenomeView viewState={config} />
              <div ref={nodeForPin} />
            </CacheProvider>,
            rootNode,
          )
        : null}
    </div>
  )
}

const JBrowseCustom = () => createElement(ShadowComponent, null, null)

export function App() {
  if (customElements.get('jbrowse-linear-view') === undefined) {
    customElements.define('jbrowse-linear-view', r2wc(JBrowseCustom))
  }
  // @ts-expect-error
  return <jbrowse-linear-view />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// UsingLocObject
// ---------------------------------------------------------------------------

function UsingLocObjectRender() {
  const { assembly, tracks } = getVolvoxConfig()
  const state = useCreateViewState({
    assembly,
    tracks,
    location: {
      refName: 'ctgA',
      start: 10000,
      end: 20000,
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export const UsingLocObject = {
  render: UsingLocObjectRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const state = useCreateViewState({
    assembly,
    tracks,
    // use 0-based coordinates for location objects
    location: { refName: 'ctgA', start: 10000, end: 20000 },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithAggregateTextSearching
// ---------------------------------------------------------------------------

function WithAggregateTextSearchingRender() {
  const { assembly: volvoxAssembly } = getVolvoxConfig()
  const [state] = useState(() => {
    const textSearchConfig = {
      assembly: volvoxAssembly,
      aggregateTextSearchAdapters: [
        {
          type: 'TrixTextSearchAdapter',
          textSearchAdapterId: 'volvox-index',
          ixFilePath: { uri: 'storybook_data/volvox.ix' },
          ixxFilePath: { uri: 'storybook_data/volvox.ixx' },
          metaFilePath: { uri: 'storybook_data/volvox_meta.json' },
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
            uri: 'volvox.sort.gff3.gz',
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
            uri: 'single_exon_gene.sorted.gff.gz',
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
            uri: 'volvox.inv.vcf.gz',
          },
        },
      ],
      location: 'ctgA:1..800',
    }
    const configPath = 'test_data/volvox/config.json'
    addRelativeUris(
      textSearchConfig,
      new URL(configPath, window.location.href).href,
    )
    return createViewState(textSearchConfig)
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithAggregateTextSearching = {
  render: WithAggregateTextSearchingRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      aggregateTextSearchAdapters: [
        {
          type: 'TrixTextSearchAdapter',
          textSearchAdapterId: 'volvox-index',
          ixFilePath: { uri: 'storybook_data/volvox.ix' },
          ixxFilePath: { uri: 'storybook_data/volvox.ixx' },
          metaFilePath: { uri: 'storybook_data/volvox_meta.json' },
          assemblyNames: ['volvox'],
        },
      ],
      tracks,
      location: 'ctgA:1..800',
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithCustomTheme
// ---------------------------------------------------------------------------

function WithCustomThemeRender() {
  const { assembly: volvoxAssembly, tracks: volvoxTracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly: volvoxAssembly,
      tracks: volvoxTracks,
      configuration: {
        theme: {
          palette: {
            primary: { main: '#311b92' },
            secondary: { main: '#0097a7' },
            tertiary: { main: '#f57c00' },
            quaternary: { main: '#d50000' },
            bases: {
              A: { main: '#98FB98' },
              C: { main: '#87CEEB' },
              G: { main: '#DAA520' },
              T: { main: '#DC143C' },
            },
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithCustomTheme = {
  render: WithCustomThemeRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      configuration: {
        theme: {
          palette: {
            primary: { main: '#311b92' },
            secondary: { main: '#0097a7' },
            tertiary: { main: '#f57c00' },
            quaternary: { main: '#d50000' },
            bases: {
              A: { main: '#98FB98' },
              C: { main: '#87CEEB' },
              G: { main: '#DAA520' },
              T: { main: '#DC143C' },
            },
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithDarkTheme
// ---------------------------------------------------------------------------

function WithDarkThemeRender() {
  const { assembly: volvoxAssembly, tracks: volvoxTracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly: volvoxAssembly,
      tracks: volvoxTracks,
      configuration: {
        theme: {
          palette: {
            mode: 'dark',
            primary: { main: '#333' },
            secondary: { main: '#444' },
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithDarkTheme = {
  render: WithDarkThemeRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      configuration: {
        theme: {
          palette: {
            mode: 'dark',
            primary: { main: '#333' },
            secondary: { main: '#444' },
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithDisableZoomAndSideScroll
// ---------------------------------------------------------------------------

class DisableZoomPlugin extends Plugin {
  name = 'DisableZoomPlugin'
  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint<PluggableElementType>(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const view = pluggableElement as ViewType
          view.stateModel = types.compose(
            view.stateModel,
            types.model().actions(() => ({
              zoomTo: () => {},
              scrollTo: () => {},
            })),
          )
        }
        return pluggableElement
      },
    )
  }
  configure() {}
}

function WithDisableZoomAndSideScrollRender() {
  const [state] = useState(() => {
    const { assembly: volvoxAssembly, tracks: volvoxTracks } = getVolvoxConfig()
    return createViewState({
      assembly: volvoxAssembly,
      tracks: volvoxTracks,
      plugins: [DisableZoomPlugin],
      location: 'ctgA:1105..1221',
    })
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      (Note: This is a basic demo that was added for a user request and may not
      be a complete solution)
    </div>
  )
}

export const WithDisableZoomAndSideScroll = {
  render: WithDisableZoomAndSideScrollRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import Plugin from '@jbrowse/core/Plugin'
import { types } from '@jbrowse/mobx-state-tree'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

${VOLVOX_SOURCE_CONFIG}

class MyPlugin extends Plugin {
  name = 'MyPlugin'
  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint<PluggableElementType>(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const view = pluggableElement as ViewType
          view.stateModel = types.compose(
            view.stateModel,
            types.model().actions(() => ({
              zoomTo: () => {},
              scrollTo: () => {},
            })),
          )
        }
        return pluggableElement
      },
    )
  }
  configure() {}
}

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      plugins: [MyPlugin],
      location: 'ctgA:1105..1221',
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithDrawerWidget
// ---------------------------------------------------------------------------

function WithDrawerWidgetRender() {
  const { assembly: volvoxAssembly, tracks: volvoxTracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly: volvoxAssembly,
      tracks: volvoxTracks,
      location: 'ctgA:1105..1221',
      drawerViewHeight: '100vh',
      defaultSession: {
        name: 'Drawer Widget Example',
        view: {
          id: 'linearGenomeView',
          type: 'LinearGenomeView',
          init: {
            // @ts-expect-error assembly guaranteed from getVolvoxConfig
            assembly: volvoxAssembly.name,
            tracklist: true,
          },
        },
      },
    }),
  )
  return (
    <div>
      <p>
        This example demonstrates the drawer widget feature showing a
        hierarchical track selector.
      </p>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}

export const WithDrawerWidget = {
  render: WithDrawerWidgetRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      location: 'ctgA:1105..1221',
      drawerViewHeight: '100vh',
      defaultSession: {
        name: 'Drawer Widget Example',
        view: {
          id: 'linearGenomeView',
          type: 'LinearGenomeView',
          init: {
            assembly: 'volvox',
            tracklist: true,
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithErrorHandler
// ---------------------------------------------------------------------------

function WithErrorHandlerRender() {
  const { assembly: volvoxAssembly } = getVolvoxConfig()
  const [{ viewState, error }] = useState(() => {
    try {
      return {
        viewState: createViewState({
          assembly: volvoxAssembly,
          tracks: [
            {
              type: 'BadTrack',
              notProperTrack: 'error',
              shouldHaveTrackIdAndStuff: 'test',
            },
          ],
          location: 'ctgA:1105..1221',
        }),
        error: undefined as unknown,
      }
    } catch (e) {
      return { viewState: undefined, error: e }
    }
  })
  return (
    <div>
      {error ? (
        <ErrorBanner error={error} />
      ) : viewState ? (
        <JBrowseLinearGenomeView viewState={viewState} />
      ) : (
        'Loading...'
      )}
    </div>
  )
}

export const WithErrorHandler = {
  render: WithErrorHandlerRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { ErrorBanner } from '@jbrowse/core/ui'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const [{ viewState, error }] = useState(() => {
    try {
      return {
        viewState: createViewState({
          assembly,
          tracks: [
            {
              type: 'BadTrack',
              notProperTrack: 'error',
              shouldHaveTrackIdAndStuff: 'test',
            },
          ],
          location: 'ctgA:1105..1221',
        }),
        error: undefined as unknown,
      }
    } catch (e) {
      return { viewState: undefined, error: e }
    }
  })
  return error ? (
    <ErrorBanner error={error} />
  ) : viewState ? (
    <JBrowseLinearGenomeView viewState={viewState} />
  ) : (
    'Loading...'
  )
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithExternalPlugin
// ---------------------------------------------------------------------------

const hg19Assembly = {
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
}

function WithExternalPluginRender() {
  const [error, setError] = useState<unknown>()
  const [viewState, setViewState] = useState<ViewModel>()

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
          assembly: hg19Assembly,
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
        })
        state.session.view.showTrack('segdups_ucsc_hg19')
        setViewState(state)
      } catch (e) {
        setError(e)
      }
    })()
  }, [])

  return error ? (
    <ErrorBanner error={error} />
  ) : !viewState ? (
    <div>Loading...</div>
  ) : (
    <JBrowseLinearGenomeView viewState={viewState} />
  )
}

export const WithExternalPlugin = {
  render: WithExternalPluginRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useEffect, useState } from 'react'
import { ErrorBanner } from '@jbrowse/core/ui'
import { createViewState, loadPlugins, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
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
}

type ViewState = ReturnType<typeof createViewState>

function App() {
  const [error, setError] = useState<unknown>()
  const [viewState, setViewState] = useState<ViewState>()

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
          assembly,
          plugins: plugins.map(p => p.plugin),
          tracks: [
            {
              type: 'FeatureTrack',
              trackId: 'segdups_ucsc_hg19',
              name: 'UCSC SegDups',
              assemblyNames: ['hg19'],
              adapter: { type: 'UCSCAdapter', track: 'genomicSuperDups' },
            },
          ],
          location: '1:2,467,681..2,667,681',
        })
        state.session.view.showTrack('segdups_ucsc_hg19')
        setViewState(state)
      } catch (e) {
        setError(e)
      }
    })()
  }, [])

  return error ? (
    <ErrorBanner error={error} />
  ) : !viewState ? (
    <div>Loading...</div>
  ) : (
    <JBrowseLinearGenomeView viewState={viewState} />
  )
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithInitAdvanced
// ---------------------------------------------------------------------------

const refseqTrackId = 'ncbi-refseq-genes'

const hg38Assembly = {
  name: 'hg38',
  aliases: ['GRCh38'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'P6R5xbRqRr',
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
}

const hg38Tracks = [
  {
    type: 'FeatureTrack',
    trackId: refseqTrackId,
    name: 'NCBI RefSeq Genes',
    category: ['Genes'],
    assemblyNames: ['hg38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
    },
  },
]

function WithInitAdvancedRender() {
  const [state] = useState(() =>
    createViewState({
      assembly: hg38Assembly,
      tracks: hg38Tracks,
      defaultSession: {
        name: 'Advanced init',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: 'chr1:11,106,077-11,261,675',
            assembly: 'hg38',
            tracklist: true,
            nav: true,
            tracks: [
              {
                trackId: refseqTrackId,
                displaySnapshot: { height: 200 },
              },
            ],
            highlight: ['chr1:11,170,000-11,190,000'],
          },
        },
      },
    }),
  )
  return <ViewWithErrorHandling state={state} />
}

export const WithInitAdvanced = {
  render: WithInitAdvancedRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'hg38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'P6R5xbRqRr',
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
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'ncbi-refseq-genes',
    name: 'NCBI RefSeq Genes',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
    },
  },
]

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Advanced init',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: 'chr1:11,106,077-11,261,675',
            assembly: 'hg38',
            tracklist: true,
            nav: true,
            tracks: [{ trackId: 'ncbi-refseq-genes', displaySnapshot: { height: 200 } }],
            highlight: ['chr1:11,170,000-11,190,000'],
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithSessionHighlights
// ---------------------------------------------------------------------------

// highlights authored directly on the view snapshot (view.highlight) rather
// than through init.highlight loc-strings: this form carries per-highlight
// color and label, and is what gets persisted/restored in a session
const sessionHighlights = [
  {
    assemblyName: 'hg38',
    refName: 'chr1',
    start: 11_130_000,
    end: 11_145_000,
    color: 'rgba(255, 0, 0, 0.25)',
    label: 'Region of interest',
  },
  {
    assemblyName: 'hg38',
    refName: 'chr1',
    start: 11_200_000,
    end: 11_220_000,
    color: 'rgba(0, 128, 255, 0.25)',
    label: 'Promoter',
  },
]

function WithSessionHighlightsRender() {
  const [state] = useState(() =>
    createViewState({
      assembly: hg38Assembly,
      tracks: hg38Tracks,
      defaultSession: {
        name: 'Session highlights',
        view: {
          type: 'LinearGenomeView',
          highlight: sessionHighlights,
          init: {
            loc: 'chr1:11,106,077-11,261,675',
            assembly: 'hg38',
            tracks: [
              {
                trackId: refseqTrackId,
                displaySnapshot: { height: 200 },
              },
            ],
          },
        },
      },
    }),
  )
  return <ViewWithErrorHandling state={state} />
}

export const WithSessionHighlights = {
  render: WithSessionHighlightsRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

// assembly + tracks defined as in other examples

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Session highlights',
        view: {
          type: 'LinearGenomeView',
          // highlights authored on the view snapshot carry per-highlight color
          // and label, and round-trip through saved sessions. compare with
          // init.highlight, which only accepts plain loc-strings
          highlight: [
            {
              assemblyName: 'hg38',
              refName: 'chr1',
              start: 11_130_000,
              end: 11_145_000,
              color: 'rgba(255, 0, 0, 0.25)',
              label: 'Region of interest',
            },
            {
              assemblyName: 'hg38',
              refName: 'chr1',
              start: 11_200_000,
              end: 11_220_000,
              color: 'rgba(0, 128, 255, 0.25)',
              label: 'Promoter',
            },
          ],
          init: {
            loc: 'chr1:11,106,077-11,261,675',
            assembly: 'hg38',
            tracks: [{ trackId: 'ncbi-refseq-genes', displaySnapshot: { height: 200 } }],
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithInitAlignmentsDisplay
// ---------------------------------------------------------------------------

const cramTrackId = 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome'

const grch38Assembly = {
  name: 'GRCh38',
  aliases: ['hg38'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GRCh38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
  },
}

const grch38CramTracks = [
  {
    type: 'AlignmentsTrack',
    trackId: cramTrackId,
    name: 'NA12878 Exome',
    category: ['1000 Genomes', 'Alignments'],
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'CramAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
      sequenceAdapter: {
        type: 'BgzipFastaAdapter',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
      },
    },
  },
]

function WithInitAlignmentsDisplayRender() {
  const [state] = useState(() =>
    createViewState({
      assembly: grch38Assembly,
      tracks: grch38CramTracks,
      defaultSession: {
        name: 'Alignments display config',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: '1:100,987,200..100,987,450',
            assembly: 'GRCh38',
            tracks: [
              {
                trackId: cramTrackId,
                displaySnapshot: {
                  type: 'LinearAlignmentsDisplay',
                  height: 250,
                  showSoftClipping: true,
                  colorBySetting: { type: 'pairOrientation' },
                },
              },
            ],
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithInitAlignmentsDisplay = {
  render: WithInitAlignmentsDisplayRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'GRCh38',
  aliases: ['hg38'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GRCh38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
  },
}

const cramTrackId = 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome'

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: cramTrackId,
    name: 'NA12878 Exome',
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'CramAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
      sequenceAdapter: {
        type: 'BgzipFastaAdapter',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
      },
    },
  },
]

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Alignments display config',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: '1:100,987,200..100,987,450',
            assembly: 'GRCh38',
            tracks: [
              {
                trackId: cramTrackId,
                displaySnapshot: {
                  type: 'LinearAlignmentsDisplay',
                  height: 250,
                  showSoftClipping: true,
                  colorBySetting: { type: 'pairOrientation' },
                },
              },
            ],
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithInlinePlugins
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
                        console.log(selectedRegions)
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

function WithInlinePluginsRender() {
  const { assembly: volvoxAssembly, tracks: volvoxTracks } = getVolvoxConfig()
  const state = useCreateViewState({
    assembly: volvoxAssembly,
    plugins: [HighlightRegionPlugin],
    tracks: volvoxTracks,
    location: 'ctgA:1105..1221',
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithInlinePlugins = {
  render: WithInlinePluginsRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import Plugin from '@jbrowse/core/Plugin'
import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

${VOLVOX_SOURCE_CONFIG}

class HighlightRegionPlugin extends Plugin {
  name = 'HighlightRegionPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint<PluggableElementType>(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const view = pluggableElement as ViewType
          const newStateModel = view.stateModel.extend(self => {
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
                        console.log(self.getSelectedRegions(leftOffset, rightOffset))
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

function App() {
  const state = useCreateViewState({
    assembly,
    plugins: [HighlightRegionPlugin],
    tracks,
    location: 'ctgA:1105..1221',
  })
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithInternetAccounts
// ---------------------------------------------------------------------------

function WithInternetAccountsRender() {
  const { assembly: volvoxAssembly } = getVolvoxConfig()
  const state = useCreateViewState({
    assembly: volvoxAssembly,
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
            uri: 'https://www.googleapis.com/drive/v3/files/1PIvZCOJioK9eBL1Vuvfa4L_Fv9zTooHk?alt=media',
            internetAccountId: 'manualGoogleEntry',
          },
        },
      },
    ],
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

export const WithInternetAccounts = {
  render: WithInternetAccountsRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const state = useCreateViewState({
    assembly,
    tracks: [
      {
        type: 'QuantitativeTrack',
        trackId: 'google_bigwig',
        name: 'Google Drive BigWig',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: {
            locationType: 'UriLocation',
            uri: 'https://www.googleapis.com/drive/v3/files/1PIvZCOJioK9eBL1Vuvfa4L_Fv9zTooHk?alt=media',
            internetAccountId: 'manualGoogleEntry',
          },
        },
      },
    ],
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
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithMultipleDisplayedRegionsFlipped
// ---------------------------------------------------------------------------

interface TranscriptFeature {
  refName: string
  subfeatures?: { type?: string; start: number; end: number }[]
}

function getExonRegionsFromFeature(feature: TranscriptFeature, padding = 50) {
  const subs = feature.subfeatures ?? []
  const exons = subs.filter(
    f => f.type === 'exon' || f.type === 'CDS' || !f.type,
  )
  const sorted = [...exons].sort((a, b) => a.start - b.start)
  const merged: { refName: string; start: number; end: number }[] = []
  for (const exon of sorted) {
    const paddedStart = Math.max(0, exon.start - padding)
    const paddedEnd = exon.end + padding
    const last = merged.at(-1)
    if (last && paddedStart <= last.end) {
      last.end = Math.max(last.end, paddedEnd)
    } else {
      merged.push({
        refName: feature.refName,
        start: paddedStart,
        end: paddedEnd,
      })
    }
  }
  return merged
}

function regionsToLocString(
  regions: { refName: string; start: number; end: number }[],
) {
  return regions.map(r => `${r.refName}:${r.start + 1}..${r.end}`).join(' ')
}

const multiRegionTranscript = {
  strand: 1,
  refName: 'chr1',
  type: 'mRNA',
  start: 113073169,
  end: 113125202,
  subfeatures: [
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113073169,
      end: 113073645,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113091317,
      end: 113091383,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113092028,
      end: 113092140,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113093205,
      end: 113093280,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113093209,
      end: 113093280,
      phase: 0,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113093429,
      end: 113093564,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113093429,
      end: 113093564,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113094338,
      end: 113094482,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113094338,
      end: 113094482,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113094611,
      end: 113094755,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113094611,
      end: 113094755,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113095873,
      end: 113096017,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113095873,
      end: 113096017,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113096221,
      end: 113096365,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113096221,
      end: 113096365,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113098704,
      end: 113098785,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113098704,
      end: 113098785,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113100210,
      end: 113100282,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113100210,
      end: 113100282,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113100419,
      end: 113100488,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113100419,
      end: 113100488,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113107593,
      end: 113107757,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113107593,
      end: 113107757,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113110241,
      end: 113110562,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113110241,
      end: 113110562,
      phase: 2,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113112478,
      end: 113112760,
      phase: 2,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113112478,
      end: 113112760,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113114426,
      end: 113114876,
      phase: 2,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113114426,
      end: 113114876,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113116286,
      end: 113116436,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113116286,
      end: 113116436,
      phase: 2,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113119232,
      end: 113119523,
      phase: 2,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113119232,
      end: 113119523,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113123874,
      end: 113124101,
      phase: 2,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113123874,
      end: 113125202,
    },
  ],
  id: 'mRNA5901',
  name: 'NM_001312686.1',
}

const multiRegionAssembly = {
  name: 'GRCh38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GRCh38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
    },
  },
  aliases: ['hg38'],
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
  },
}

const multiRegionTracks = [
  {
    type: 'FeatureTrack',
    trackId: 'ncbi-refseq-genes',
    name: 'NCBI RefSeq Genes',
    category: ['Genes'],
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
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
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
      sequenceAdapter: {
        type: 'BgzipFastaAdapter',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
      },
    },
  },
]

const FlipView = observer(function FlipView({ state }: { state: ViewModel }) {
  const view = state.session.view
  const isFlipped = view.displayedRegions[0]?.reversed ?? false
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <button
          onClick={() => {
            view.horizontallyFlip()
          }}
        >
          {isFlipped ? 'Unflip (show 5′→3′)' : 'Flip horizontally (show 3′→5′)'}
        </button>
      </div>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
})

function WithMultipleDisplayedRegionsFlippedRender() {
  const [state] = useState(() => {
    const loc = regionsToLocString(
      getExonRegionsFromFeature(multiRegionTranscript),
    )
    return createViewState({
      assembly: multiRegionAssembly,
      tracks: multiRegionTracks,
      defaultSession: {
        name: 'Multi-region flipped example',
        view: {
          id: 'multi_region_flipped_view',
          type: 'LinearGenomeView',
          init: {
            loc,
            assembly: 'GRCh38',
            tracks: [
              'ncbi-refseq-genes',
              'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
            ],
          },
        },
      },
    })
  })
  return <FlipView state={state} />
}

export const WithMultipleDisplayedRegionsFlipped = {
  render: WithMultipleDisplayedRegionsFlippedRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { observer } from 'mobx-react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'GRCh38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GRCh38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
    },
  },
  aliases: ['hg38'],
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
  },
}

// ... (define tracks similarly)

const FlipView = observer(function FlipView({ state }: { state: ViewModel }) {
  const view = state.session.view
  const isFlipped = view.displayedRegions[0]?.reversed ?? false
  return (
    <div>
      <button onClick={() => { view.horizontallyFlip() }}>
        {isFlipped ? 'Unflip' : 'Flip horizontally'}
      </button>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
})

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Multi-region flipped example',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: 'chr1:113073119..113073695 chr1:113091267..113091433',
            assembly: 'GRCh38',
            tracks: ['ncbi-refseq-genes'],
          },
        },
      },
    }),
  )
  return <FlipView state={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithObserveVisibleFeatures
// ---------------------------------------------------------------------------

const VisibleFeatures = observer(function VisibleFeatures({
  session,
}: {
  session: { rpcManager: RpcManager; view: LinearGenomeViewModel }
}) {
  const [features, setFeatures] = useState<Feature[]>()
  const { rpcManager, view } = session

  useEffect(() => {
    return autorun(() => {
      if (!view.initialized) {
        return
      }
      const track = view.tracks[0]
      if (!track) {
        return
      }
      const adapterConfig = getConf(track, 'adapter')
      const sessionId = getRpcSessionId(track)
      const { coarseDynamicBlocks } = view
      void rpcManager
        .call(sessionId, 'CoreGetFeatures', {
          adapterConfig,
          regions: coarseDynamicBlocks,
        })
        .then(feats => {
          setFeatures(feats)
        })
    })
  }, [rpcManager, view])
  return (
    <div>
      {!features ? (
        <div>Loading...</div>
      ) : (
        <div>
          <h4>Visible features in {view.coarseVisibleLocStrings}:</h4>
          <table>
            <thead>
              <tr>
                <th>Feature name</th>
                <th>Feature location</th>
              </tr>
            </thead>
            <tbody>
              {features.map(f => (
                <tr key={f.id()}>
                  <td>{f.get('name')}</td>
                  <td>
                    {f.get('refName')}:{f.get('start')}-{f.get('end')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
})

function WithObserveVisibleFeaturesRender() {
  const { assembly: volvoxAssembly, tracks: volvoxTracks } = getVolvoxConfig()
  const state = useCreateViewState({
    assembly: volvoxAssembly,
    tracks: volvoxTracks,
    defaultSession: {
      name: 'My session',
      view: {
        type: 'LinearGenomeView',
        init: {
          loc: 'ctgA:1105..1221',
          assembly: 'volvox',
          tracks: ['volvox_cram'],
        },
      },
    },
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <VisibleFeatures session={state.session} />
    </div>
  )
}

export const WithObserveVisibleFeatures = {
  render: WithObserveVisibleFeaturesRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useEffect, useState } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'
import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

${VOLVOX_SOURCE_CONFIG}

const VisibleFeatures = observer(function VisibleFeatures({
  session,
}: {
  session: { rpcManager: RpcManager; view: LinearGenomeViewModel }
}) {
  const [features, setFeatures] = useState<Feature[]>()
  const { rpcManager, view } = session

  useEffect(() => {
    return autorun(() => {
      if (!view.initialized) return
      const track = view.tracks[0]
      if (!track) return
      const adapterConfig = getConf(track, 'adapter')
      const sessionId = getRpcSessionId(track)
      void rpcManager
        .call(sessionId, 'CoreGetFeatures', {
          adapterConfig,
          regions: view.coarseDynamicBlocks,
        })
        .then(feats => { setFeatures(feats) })
    })
  }, [rpcManager, view])

  return !features ? (
    <div>Loading...</div>
  ) : (
    <table>
      <thead><tr><th>Name</th><th>Location</th></tr></thead>
      <tbody>
        {features.map(f => (
          <tr key={f.id()}>
            <td>{f.get('name')}</td>
            <td>{f.get('refName')}:{f.get('start')}-{f.get('end')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
})

function App() {
  const state = useCreateViewState({
    assembly,
    tracks,
    defaultSession: {
      name: 'My session',
      view: {
        type: 'LinearGenomeView',
        init: { loc: 'ctgA:1105..1221', assembly: 'volvox', tracks: ['volvox_cram'] },
      },
    },
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <VisibleFeatures session={state.session} />
    </div>
  )
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithObserveVisibleRegions
// ---------------------------------------------------------------------------

function loc(r: BaseBlock) {
  return r.type === 'ContentBlock'
    ? `${r.refName}:${Math.floor(r.start)}-${Math.floor(r.end)}`
    : ''
}

const VisibleRegions = observer(function VisibleRegions({
  viewState,
}: {
  viewState: ViewModel
}) {
  const view = viewState.session.view
  return view.initialized ? (
    <div>
      <p>Visible region {view.coarseDynamicBlocks.map(loc).join(',')}</p>
      <p>Static blocks {view.staticBlocks.contentBlocks.map(loc).join(',')}</p>
    </div>
  ) : null
})

function WithObserveVisibleRegionsRender() {
  const { assembly: volvoxAssembly, tracks: volvoxTracks } = getVolvoxConfig()
  const state = useCreateViewState({
    assembly: volvoxAssembly,
    tracks: volvoxTracks,
    location: 'ctgA:1105..1221',
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <VisibleRegions viewState={state} />
    </div>
  )
}

export const WithObserveVisibleRegions = {
  render: WithObserveVisibleRegionsRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { observer } from 'mobx-react'
import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

${VOLVOX_SOURCE_CONFIG}

function loc(r: BaseBlock) {
  return r.type === 'ContentBlock'
    ? \`\${r.refName}:\${Math.floor(r.start)}-\${Math.floor(r.end)}\`
    : ''
}

type ViewState = ReturnType<typeof useCreateViewState>

const VisibleRegions = observer(function VisibleRegions({ viewState }: { viewState: ViewState }) {
  const view = viewState.session.view
  return view.initialized ? (
    <div>
      <p>Visible region {view.coarseDynamicBlocks.map(loc).join(',')}</p>
      <p>Static blocks {view.staticBlocks.contentBlocks.map(loc).join(',')}</p>
    </div>
  ) : null
})

function App() {
  const state = useCreateViewState({ assembly, tracks, location: 'ctgA:1105..1221' })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <VisibleRegions viewState={state} />
    </div>
  )
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithOutsideStyling
// ---------------------------------------------------------------------------

function WithOutsideStylingRender() {
  const { assembly: volvoxAssembly, tracks: volvoxTracks } = getVolvoxConfig()
  const state = useCreateViewState({
    assembly: volvoxAssembly,
    tracks: volvoxTracks,
    location: 'ctgA:1105..1221',
  })
  return (
    <div style={{ textAlign: 'center', fontFamily: 'monospace' }}>
      <p>
        This parent container has textAlign:&apos;center&apos; and a monospace
        font, but these attributes are not affecting the internal LGV
      </p>
      <p>
        The react component takes measures to avoid being affected by styles
        outside of it on the page.
      </p>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}

export const WithOutsideStyling = {
  render: WithOutsideStylingRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const state = useCreateViewState({ assembly, tracks, location: 'ctgA:1105..1221' })
  return (
    <div style={{ textAlign: 'center', fontFamily: 'monospace' }}>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithPerTrackTextSearching
// ---------------------------------------------------------------------------

function WithPerTrackTextSearchingRender() {
  const { assembly: volvoxAssembly } = getVolvoxConfig()
  const [state] = useState(() => {
    const textSearchConfig = {
      assembly: volvoxAssembly,
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'gff3tabix_genes',
          assemblyNames: ['volvox'],
          name: 'GFF3Tabix genes',
          category: ['Miscellaneous'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'volvox.sort.gff3.gz',
          },
          textSearching: {
            textSearchAdapter: {
              type: 'TrixTextSearchAdapter',
              textSearchAdapterId: 'gff3tabix_genes-index',
              ixFilePath: { uri: 'storybook_data/gff3tabix_genes.ix' },
              ixxFilePath: { uri: 'storybook_data/gff3tabix_genes.ixx' },
              metaFilePath: {
                uri: 'storybook_data/gff3tabix_genes_meta.json',
              },
              assemblyNames: ['volvox'],
            },
          },
        },
      ],
      location: 'ctgA:1..800',
    }
    const configPath = 'test_data/volvox/config.json'
    addRelativeUris(
      textSearchConfig,
      new URL(configPath, window.location.href).href,
    )
    return createViewState(textSearchConfig)
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithPerTrackTextSearching = {
  render: WithPerTrackTextSearchingRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'gff3tabix_genes',
          assemblyNames: ['volvox'],
          name: 'GFF3Tabix genes',
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: { uri: 'https://example.com/volvox.sort.gff3.gz' },
            index: { location: { uri: 'https://example.com/volvox.sort.gff3.gz.tbi' } },
          },
          textSearching: {
            textSearchAdapter: {
              type: 'TrixTextSearchAdapter',
              textSearchAdapterId: 'gff3tabix_genes-index',
              ixFilePath: { uri: 'https://example.com/storybook_data/gff3tabix_genes.ix' },
              ixxFilePath: { uri: 'https://example.com/storybook_data/gff3tabix_genes.ixx' },
              metaFilePath: { uri: 'https://example.com/storybook_data/gff3tabix_genes_meta.json' },
              assemblyNames: ['volvox'],
            },
          },
        },
      ],
      location: 'ctgA:1..800',
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithShowTrack
// ---------------------------------------------------------------------------

function WithShowTrackRender() {
  const { assembly: volvoxAssembly, tracks: volvoxTracks } = getVolvoxConfig()
  const [state] = useState(() => {
    const s = createViewState({
      assembly: volvoxAssembly,
      tracks: volvoxTracks,
      location: 'ctgA:1105..1221',
    })
    s.session.view.showTrack('volvox-long-reads-sv-bam')
    return s
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithShowTrack = {
  render: WithShowTrackRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const [state] = useState(() => {
    const s = createViewState({ assembly, tracks, location: 'ctgA:1105..1221' })
    // showTrack API: https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-showtrack
    s.session.view.showTrack('your-track-id')
    return s
  })
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithTwoLinearGenomeViews
// ---------------------------------------------------------------------------

function WithTwoLinearGenomeViewsRender() {
  const { assembly: volvoxAssembly, tracks: volvoxTracks } = getVolvoxConfig()
  const [state1] = useState(() =>
    createViewState({
      assembly: volvoxAssembly,
      tracks: volvoxTracks,
      location: 'ctgA:1105..1221',
    }),
  )
  const [state2] = useState(() =>
    createViewState({
      assembly: volvoxAssembly,
      tracks: volvoxTracks,
      location: 'ctgA:5560..30589',
    }),
  )
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state1} />
      <JBrowseLinearGenomeView viewState={state2} />
    </div>
  )
}

export const WithTwoLinearGenomeViews = {
  render: WithTwoLinearGenomeViewsRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const [state1] = useState(() =>
    createViewState({ assembly, tracks, location: 'ctgA:1105..1221' }),
  )
  const [state2] = useState(() =>
    createViewState({ assembly, tracks, location: 'ctgA:5560..30589' }),
  )
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state1} />
      <JBrowseLinearGenomeView viewState={state2} />
    </div>
  )
}`,
      },
    },
  },
}

// ---------------------------------------------------------------------------
// WithWebWorker
// ---------------------------------------------------------------------------

function WithWebWorkerRender() {
  const { assembly: volvoxAssembly, tracks: volvoxTracks } = getVolvoxConfig()
  const [state] = useState(() => {
    const s = createViewState({
      assembly: volvoxAssembly,
      tracks: volvoxTracks,
      location: 'ctgA:1105..1221',
      configuration: {
        rpc: {
          defaultDriver: 'WebWorkerRpcDriver',
        },
      },
      makeWorkerInstance,
    })
    s.session.view.showTrack('Deep sequencing')
    return s
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export const WithWebWorker = {
  render: WithWebWorkerRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import makeWorkerInstance from '@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance'

${VOLVOX_SOURCE_CONFIG}

function App() {
  const [state] = useState(() => {
    const s = createViewState({
      assembly,
      tracks,
      location: 'ctgA:1105..1221',
      configuration: {
        rpc: { defaultDriver: 'WebWorkerRpcDriver' },
      },
      makeWorkerInstance,
    })
    s.session.view.showTrack('your-track-id')
    return s
  })
  return <JBrowseLinearGenomeView viewState={state} />
}`,
      },
    },
  },
}
