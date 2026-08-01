import { Suspense, use, useState } from 'react'

import { isFeature } from '@jbrowse/core/util'
import {
  JBrowseLinearGenomeView,
  loadPlugins,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import UmapScatter from '../components/UmapScatter.tsx'

import type { Cells } from '../components/UmapScatter.tsx'
import type { MultiWiggleDisplayModel } from '@jbrowse/plugin-wiggle'

// 10x Genomics 5k PBMC v3, clustered and labeled with scanpy, then pseudobulked
// into one coverage BigWig per cell type. The UMAP coordinates, the cell-type
// palette, and the BigWigs all come out of the same build script, so a cluster
// and its coverage row are the same color by construction.
const BASE = 'https://jbrowse.org/demos/scrna_pbmc5k'
const TRACK_ID = 'pbmc5k_scrna_pseudobulk'
const PER_CELL_TRACK_ID = 'pbmc5k_scrna_percell'
// The per-cell rows come from a Zarr signal matrix, which is an external plugin
const ZARR_PLUGIN =
  'https://jbrowse.org/demos/zarr/jbrowse-plugin-zarr.umd.production.min.js'

const dataPromise = Promise.all([
  fetch(`${BASE}/cells.json`).then(res => res.json() as Promise<Cells>),
  fetch(`${BASE}/expr.bin`)
    .then(res => res.arrayBuffer())
    .then(buf => new Uint8Array(buf)),
  loadPlugins([{ name: 'Zarr', url: ZARR_PLUGIN }]).then(loaded =>
    loaded.map(p => p.plugin),
  ),
])

const assembly = {
  name: 'GRCh38',
  aliases: ['hg38'],
  uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
  },
}

// One subadapter per cell type, built from the same list that colors the UMAP.
function tracks(cells: Cells) {
  return [
    {
      type: 'FeatureTrack',
      trackId: 'hg38_refseq_curated',
      name: 'NCBI RefSeq genes',
      assemblyNames: ['GRCh38'],
      adapter: {
        type: 'Gff3TabixAdapter',
        uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
        // this one is indexed with a .csi, not a .tbi
        csi: true,
      },
      displayDefaults: { height: 90 },
    },
    {
      type: 'MultiQuantitativeTrack',
      trackId: TRACK_ID,
      name: 'scRNA pseudobulk by cell type',
      assemblyNames: ['GRCh38'],
      adapter: {
        type: 'MultiWiggleAdapter',
        subadapters: cells.cellTypes.map(type => ({
          type: 'BigWigAdapter',
          name: type.name,
          group: type.group,
          color: type.color,
          uri: `${BASE}/${type.name.replace(/ /g, '_')}.bw`,
        })),
      },
      displayDefaults: { defaultRendering: 'multirowxy', height: 330 },
    },
    {
      // One row per cell instead of one per cell type, read out of a
      // cells-by-bins Zarr matrix. It covers the marker windows in
      // cells.perCellGenes and is empty everywhere else.
      type: 'MultiQuantitativeTrack',
      trackId: PER_CELL_TRACK_ID,
      name: 'Per-cell coverage (marker loci)',
      assemblyNames: ['GRCh38'],
      adapter: {
        type: 'MultiWiggleZarrAdapter',
        uri: `${BASE}/percell.zarr`,
      },
      // The scale is pinned deliberately. Autoscaling puts the maximum at
      // whatever the home cell type reached (hundreds of UMIs in a monocyte at
      // LYZ), which renders every single-UMI cell as white and hides the thing
      // per-cell rows are here to show: the "flat" cell types are not empty,
      // they carry one ambient UMI each.
      displayDefaults: {
        defaultRendering: 'multirowdensity',
        height: 420,
        minScore: 0,
        maxScore: 4,
      },
    },
  ]
}

const Demo = observer(function Demo() {
  const [cells, expr, plugins] = use(dataPromise)
  const [picked, setPicked] = useState<string>()
  const [selected, setSelected] = useState<string[]>([])
  const state = useCreateViewState({
    assembly,
    plugins,
    tracks: tracks(cells),
    defaultSession: {
      name: 'scRNA pseudobulk',
      view: {
        type: 'LinearGenomeView',
        init: {
          assembly: 'GRCh38',
          // MS4A1, the B-cell marker: one row carries the coverage
          loc: '11:60,453,846-60,472,752',
          tracks: ['hg38_refseq_curated', TRACK_ID, PER_CELL_TRACK_ID],
        },
      },
    },
  })

  const { session } = state
  const { selection, view } = session
  // A feature clicked in the gene track wins over the dropdown, which clears
  // the selection when it is used, so the two never disagree.
  const clicked = isFeature(selection)
    ? String(selection.get('name'))
    : undefined
  const gene = clicked && cells.genes.includes(clicked) ? clicked : picked

  function pickCellType(name: string) {
    const next = selected.includes(name)
      ? selected.filter(t => t !== name)
      : [...selected, name]
    setSelected(next)
    // the display's own row filter, the same one the sidebar tree drives
    const display = view.getTrack(TRACK_ID)?.activeDisplay as
      | MultiWiggleDisplayModel
      | undefined
    display?.setSubtreeFilter(next.length ? next : undefined)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <UmapScatter
            cells={cells}
            expr={expr}
            gene={gene}
            selected={selected}
            onPick={name => {
              pickCellType(name)
            }}
          />
        </div>
        <div style={{ minWidth: 220 }}>
          <p style={{ marginTop: 0 }}>
            <b>{cells.dataset}</b>
          </p>
          <label>
            Color by gene{' '}
            <select
              value={gene ?? ''}
              onChange={event => {
                const name = event.target.value
                session.clearSelection()
                setPicked(name || undefined)
                const at = cells.genes.indexOf(name)
                if (at !== -1) {
                  view.navToLocString(cells.geneLoc[at]!)
                }
              }}
            >
              <option value="">cell type</option>
              <optgroup label="With per-cell rows">
                {cells.perCellGenes.map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Expression panel only">
                {cells.genes
                  .filter(name => !cells.perCellGenes.includes(name))
                  .map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <p>
            {gene
              ? `Cells colored by ${gene} expression.`
              : 'Click a cluster or a legend swatch to filter the coverage rows to those cell types.'}
          </p>
          {clicked && !gene ? (
            <p>
              No expression in this demo's panel for <b>{clicked}</b>.
            </p>
          ) : null}
        </div>
      </div>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
})

export default function SingleCellUmap() {
  return (
    <Suspense fallback={<p>Loading cells...</p>}>
      <Demo />
    </Suspense>
  )
}
