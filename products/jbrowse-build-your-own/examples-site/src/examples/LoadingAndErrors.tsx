import { useState } from 'react'

import { EmbedProvider, TrackStack } from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

const brca1 = 'chr17:43,044,295..43,125,364'

const scenarios = {
  'hg38 (2bit), which loads': {
    assembly: {
      name: 'hg38',
      uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.2bit',
    },
    loc: brca1,
  },
  'GRCh38 (bgzip FASTA), four files to fetch first': {
    assembly: {
      name: 'GRCh38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
    },
    loc: 'chr17:1..2,000,000',
  },
  'a sequence file behind a 404': {
    assembly: {
      name: 'hg38',
      uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/does-not-exist.2bit',
    },
    loc: brca1,
  },
  'a view with no location yet': {
    assembly: {
      name: 'hg38',
      uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.2bit',
    },
    loc: undefined,
  },
}

type Scenario = keyof typeof scenarios

const Notifications = observer(function Notifications({
  session,
}: {
  session: ViewModel['session']
}) {
  const latest = session.snackbarMessages.at(-1)
  return latest ? (
    <div
      role={latest.level === 'error' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        gap: 8,
        marginTop: 8,
        padding: '4px 8px',
        fontSize: '0.8rem',
        background: 'color-mix(in srgb, CanvasText 8%, Canvas)',
      }}
    >
      <span style={{ flex: 1 }}>{latest.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          session.popSnackbarMessage()
        }}
      >
        ✕
      </button>
    </div>
  ) : null
})

const Browser = observer(function Browser({
  scenario,
}: {
  scenario: Scenario
}) {
  const { assembly, loc } = scenarios[scenario]
  const tracks = ['hg38_phylop']
  const state = useCreateViewState({
    assembly,
    tracks: [
      {
        trackId: 'hg38_phylop',
        name: 'phyloP 100-way conservation',
        uri: 'https://jbrowse.org/demos/phylop/hg38.phyloP100way.brca1.bw',
        displayDefaults: { height: 100, color: '#3a7ca5' },
      },
    ],
    init: loc ? { loc, tracks } : undefined,
  })
  if (!state) {
    return null
  }
  const { session } = state
  const { view } = session
  return (
    <EmbedProvider session={session}>
      <button
        type="button"
        style={{ marginBottom: 8 }}
        onClick={() => {
          void view.launchTrack('a_track_that_is_not_in_the_config')
        }}
      >
        Show a track that isn't in the config
      </button>
      {view.status.type === 'noRegions' ? (
        <div role="status" style={{ padding: '10px 12px' }}>
          Nothing has told this view where to look yet.{' '}
          <button
            type="button"
            onClick={() => {
              view.setLaunch({ assembly: assembly.name, loc: brca1, tracks })
            }}
          >
            Show {brca1}
          </button>
        </div>
      ) : (
        <TrackStack view={view} />
      )}
      <Notifications session={session} />
    </EmbedProvider>
  )
})

const LoadingAndErrors = observer(function LoadingAndErrors() {
  const [scenario, setScenario] = useState<Scenario>('hg38 (2bit), which loads')
  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          paddingBottom: 8,
          fontSize: '0.85rem',
        }}
      >
        Load
        {Object.keys(scenarios).map(name => (
          <label key={name}>
            <input
              type="radio"
              name="scenario"
              checked={scenario === name}
              onChange={() => {
                setScenario(name as Scenario)
              }}
            />
            {name}
          </label>
        ))}
      </div>
      <Browser key={scenario} scenario={scenario} />
    </div>
  )
})

export default LoadingAndErrors
