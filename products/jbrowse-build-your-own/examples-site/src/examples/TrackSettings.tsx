import {
  EmbedProvider,
  RegionSeams,
  TrackStack,
} from '@jbrowse/display-ui/embed'
import { pickColorOptions } from '@jbrowse/plugin-alignments'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'

const schemes = pickColorOptions(
  'normal',
  'strand',
  'pairOrientation',
  'insertSizeAndOrientation',
  'mappingQuality',
)

const Settings = observer(function Settings({
  display,
}: {
  display: LinearAlignmentsDisplayModel
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        paddingBottom: 8,
        fontSize: '0.85rem',
      }}
    >
      <label>
        Color by{' '}
        <select
          value={display.colorBy.type}
          onChange={event => {
            display.setColorBy({
              type: event.target.value as (typeof schemes)[number]['type'],
            })
          }}
        >
          {schemes.map(({ type, label }) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={display.showLegend}
          onChange={event => {
            display.setShowLegend(event.target.checked)
          }}
        />
        Show legend
      </label>
      <label>
        Read height{' '}
        <input
          type="range"
          min={2}
          max={12}
          value={display.featureHeight}
          onChange={event => {
            display.setFeatureHeight(Number(event.target.value))
          }}
        />{' '}
        {display.featureHeight}px
      </label>
    </div>
  )
})

const TrackSettings = observer(function TrackSettings() {
  const state = useCreateViewState({
    assembly: {
      name: 'hg38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
      geneticCodes: { chrM: 2 },
    },
    tracks: [
      {
        trackId: 'na12878_exome',
        name: 'NA12878 exome reads',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
        displayDefaults: { height: 150 },
      },
    ],
    view: {
      loc: 'chr17:43,044,295..43,052,295 chr17:43,090,000..43,098,000',
      tracks: ['na12878_exome'],
    },
  })
  if (!state) {
    return null
  }
  const { session } = state
  const { view } = session
  const display = view.getTrack('na12878_exome')?.activeDisplay as
    | LinearAlignmentsDisplayModel
    | undefined
  return (
    <EmbedProvider session={session}>
      {display ? <Settings display={display} /> : null}
      <TrackStack view={view}>
        <RegionSeams view={view} />
      </TrackStack>
    </EmbedProvider>
  )
})

export default TrackSettings
