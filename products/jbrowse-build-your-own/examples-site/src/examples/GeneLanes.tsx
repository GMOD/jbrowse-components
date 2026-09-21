import {
  EmbedProvider,
  Legend,
  LocationBox,
  Scalebar,
  TrackStack,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-app2'
import { observer } from 'mobx-react'

import type { MultiWaySyntenyDisplayModel } from '@jbrowse/plugin-linear-comparative-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const base = 'https://jbrowse.org/demos/ecoli_orthologs'

const genomes = [
  'MG1655',
  'DH10B',
  'Sakai',
  'EDL933',
  'CFT073',
  'UTI89',
  'S88',
  'UMN026',
  'IAI39',
  'IAI1',
  '55989',
  'ED1a',
]

const loci = [
  { label: 'atp operon', loc: 'NC_000913.3:3,910,000-3,925,000' },
  { label: 'O-antigen cluster', loc: 'NC_000913.3:2,095,000-2,115,000' },
]

const Loci = observer(function Loci({ view }: { view: LinearGenomeViewModel }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        paddingBottom: 8,
        fontSize: '0.85rem',
      }}
    >
      <LocationBox view={view} />
      {loci.map(({ label, loc }) => (
        <button
          key={label}
          type="button"
          onClick={() => {
            view.navToLocString(loc).catch((e: unknown) => {
              console.error(e)
            })
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
})

const GeneLanes = observer(function GeneLanes() {
  const state = useCreateViewState({
    config: {
      assemblies: genomes.map(name => ({
        name,
        sequence: {
          adapter: {
            type: 'ChromSizesAdapter',
            uri: `${base}/${name}.chrom.sizes`,
          },
        },
      })),
      tracks: [
        ...genomes.map(name => ({
          type: 'FeatureTrack',
          trackId: `${name}_genes`,
          name: `${name} genes`,
          assemblyNames: [name],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: `${base}/${name}.gff.gz`,
          },
        })),
        {
          type: 'SyntenyTrack',
          trackId: 'orthologs',
          name: 'E. coli orthologs by gene symbol',
          assemblyNames: genomes,
          adapter: {
            type: 'MCScanBlocksAdapter',
            mcscanBlocksLocation: { uri: `${base}/ecoli.blocks.gz` },
            blockAssemblies: genomes,
            bedLocations: genomes.map(name => ({
              uri: `${base}/${name}.bed.gz`,
            })),
          },
          displays: [
            {
              type: 'MultiWaySyntenyDisplay',
              displayId: 'orthologs-MultiWaySyntenyDisplay',
              color: { field: 'cluster' },
              height: 330,
              showLegend: false,
            },
          ],
        },
      ],
      defaultSession: {
        name: 'gene lanes',
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'MG1655',
            loc: loci[0]!.loc,
            tracks: ['orthologs'],
          },
        ],
      },
    },
  })
  if (!state) {
    return null
  }
  const { session } = state
  const view = session.views[0] as LinearGenomeViewModel
  const display = view.getTrack('orthologs')?.activeDisplay as
    | MultiWaySyntenyDisplayModel
    | undefined
  return (
    <EmbedProvider session={session}>
      <Loci view={view} />
      {display ? (
        <Legend display={display} style={{ paddingBottom: 6 }} />
      ) : null}
      <TrackStack view={view}>
        <Scalebar view={view} />
      </TrackStack>
    </EmbedProvider>
  )
})

export default GeneLanes
