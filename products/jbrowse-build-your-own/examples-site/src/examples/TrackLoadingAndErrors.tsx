import { useId, useState } from 'react'

import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { DisplayUIProvider, plainChromeOverlays } from '@jbrowse/display-ui'
import { Toolbar, TrackStack } from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type {
  DisplayChromeOverlays,
  ErrorBarProps,
  LoadingProps,
} from '@jbrowse/display-ui'

const pill: React.CSSProperties = {
  pointerEvents: 'auto',
  margin: 6,
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: '0.78rem',
  color: 'CanvasText',
  background: 'color-mix(in srgb, Canvas 92%, transparent)',
  boxShadow: 'inset 0 0 0 1.5px #3a7ca5',
}

const Pill = observer(function Pill({
  children,
  action,
}: {
  children: React.ReactNode
  action?: { label: string; run: () => void }
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pointerEvents: 'none',
      }}
    >
      <div style={pill}>
        {children}
        {action ? (
          <button
            type="button"
            style={{ font: 'inherit', marginLeft: 8, fontWeight: 600 }}
            onClick={action.run}
          >
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  )
})

const MyErrorBar = observer(function MyErrorBar({
  error,
  onRetry,
}: ErrorBarProps) {
  return (
    <div role={onRetry ? 'alert' : 'status'}>
      <Pill action={onRetry ? { label: 'Try again', run: onRetry } : undefined}>
        {error instanceof Error ? error.message : String(error)}
      </Pill>
    </div>
  )
})

const MyLoading = observer(function MyLoading({
  visible,
  message,
  canceled,
  onCancel,
  onRetry,
}: LoadingProps) {
  return !visible ? null : canceled ? (
    <Pill action={onRetry ? { label: 'Resume', run: onRetry } : undefined}>
      Stopped
    </Pill>
  ) : (
    <Pill action={onCancel ? { label: 'Stop', run: onCancel } : undefined}>
      {message || 'Loading…'}
    </Pill>
  )
})

const myOverlays: Partial<DisplayChromeOverlays> = {
  ErrorBar: MyErrorBar,
  Loading: MyLoading,
}

const sets = {
  'overlays defined in this file': myOverlays,
  plainChromeOverlays,
  'the Material UI default': undefined,
}

type SetName = keyof typeof sets

const TrackLoadingAndErrors = observer(function TrackLoadingAndErrors() {
  const radioGroupId = useId()
  const [setName, setSetName] = useState<SetName>(
    'overlays defined in this file',
  )
  const state = useCreateViewState({
    assembly: {
      name: 'hg38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
    },
    tracks: [
      {
        trackId: 'hg38_phylop',
        name: 'phyloP 100-way conservation',
        uri: 'https://jbrowse.org/demos/phylop/hg38.phyloP100way.brca1.bw',
        displayDefaults: {
          height: 100,
          encoding: { color: { value: '#3a7ca5' } },
        },
      },
      {
        trackId: 'hg38_genes',
        name: 'RefSeq curated genes',
        uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
        index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
        displayDefaults: { height: 120 },
      },
      {
        trackId: 'hg38_broken',
        name: 'A track that fails to load',
        uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/does-not-exist.bw',
        displayDefaults: { height: 80 },
      },
    ],
    view: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ['hg38_phylop', 'hg38_genes', 'hg38_broken'],
    },
  })
  if (!state) {
    return null
  }
  const overlays = sets[setName]
  const stack = (
    <SessionPaletteProvider session={state.session}>
      <TrackStack view={state.session.view} />
    </SessionPaletteProvider>
  )
  return (
    <div>
      <Toolbar>
        Draw loading and errors with
        {Object.keys(sets).map(name => (
          <label key={name}>
            <input
              type="radio"
              name={radioGroupId}
              checked={setName === name}
              onChange={() => {
                setSetName(name as SetName)
              }}
            />
            {name}
          </label>
        ))}
      </Toolbar>
      {overlays ? (
        <DisplayUIProvider overlays={overlays}>{stack}</DisplayUIProvider>
      ) : (
        stack
      )}
    </div>
  )
})

export default TrackLoadingAndErrors
