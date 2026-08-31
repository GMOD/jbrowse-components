import { Suspense, use, useEffect, useRef, useState } from 'react'

import { isFeature } from '@jbrowse/core/util'
import {
  JBrowseLinearGenomeView,
  loadPlugins,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { MultiWiggleDisplayModel } from '@jbrowse/plugin-wiggle'

// ---------------------------------------------------------------------------
// The UMAP panel. It is plain canvas with no JBrowse in it at all, and it lives
// here rather than in a shared module so this page's source stays one complete
// file you can copy. `Cells` is also the shape of the cells.json the demo
// fetches below.
// ---------------------------------------------------------------------------

interface CellType {
  name: string
  group: string
  color: string
}

interface Cells {
  dataset: string
  cellTypes: CellType[]
  // coordinates are pre-normalized to 0..1, so the page never needs to know
  // the embedding's units
  x: number[]
  y: number[]
  type: number[]
  genes: string[]
  geneLoc: string[]
  // the subset of `genes` whose windows the per-cell Zarr matrix covers
  perCellGenes: string[]
  // [record offset, record count, the expression value a byte of 255 means]
  exprIndex: [number, number, number][]
  exprUrl: string
  perCellUrl: string
}

const WIDTH = 560
const HEIGHT = 400
const PAD = 14
const DOT = 2.6
const GREY = '#d8dbe0'

// Values for one gene, unpacked from the sparse blob: three bytes per
// expressing cell, a uint16 cell index and a byte of expression.
function geneValues(cells: Cells, expr: Uint8Array, gene: string) {
  const g = cells.genes.indexOf(gene)
  const out = new Uint8Array(cells.x.length)
  if (g !== -1) {
    const [offset, count] = cells.exprIndex[g]!
    for (let i = 0; i < count; i++) {
      const at = (offset + i) * 3
      out[expr[at]! | (expr[at + 1]! << 8)] = expr[at + 2]!
    }
  }
  return out
}

// Light to dark single hue, so a bright point reads as more expression without
// competing with the categorical cell-type colors.
function ramp(v: number) {
  const t = v / 255
  const r = Math.round(232 + (8 - 232) * t)
  const g = Math.round(238 + (48 - 238) * t)
  const b = Math.round(247 + (107 - 247) * t)
  return `rgb(${r},${g},${b})`
}

function UmapScatter({
  cells,
  expr,
  gene,
  selected,
  onPick,
}: {
  cells: Cells
  expr: Uint8Array
  gene?: string
  selected: string[]
  onPick: (cellType: string) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  // an imperative canvas repaint whenever the inputs change
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (ctx) {
      const dpr = 2
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      const px = (i: number) => PAD + cells.x[i]! * (WIDTH - 2 * PAD)
      const py = (i: number) => HEIGHT - PAD - cells.y[i]! * (HEIGHT - 2 * PAD)
      const values = gene ? geneValues(cells, expr, gene) : undefined
      const active = new Set(selected)

      // draw the de-emphasized cells first so the ones being asked about are
      // never hidden underneath them
      const order = [...cells.x.keys()].sort((a, b) =>
        values
          ? values[a]! - values[b]!
          : Number(
              active.size > 0 &&
                active.has(cells.cellTypes[cells.type[a]!]!.name),
            ) -
            Number(
              active.size > 0 &&
                active.has(cells.cellTypes[cells.type[b]!]!.name),
            ),
      )
      for (const i of order) {
        const type = cells.cellTypes[cells.type[i]!]!
        ctx.fillStyle = values
          ? ramp(values[i]!)
          : active.size === 0 || active.has(type.name)
            ? type.color
            : GREY
        ctx.beginPath()
        ctx.arc(px(i), py(i), DOT, 0, 2 * Math.PI)
        ctx.fill()
      }
    }
  }, [cells, expr, gene, selected])

  return (
    <div>
      <canvas
        ref={ref}
        width={WIDTH * 2}
        height={HEIGHT * 2}
        style={{
          width: WIDTH,
          height: HEIGHT,
          maxWidth: '100%',
          cursor: 'pointer',
        }}
        onClick={event => {
          const box = event.currentTarget.getBoundingClientRect()
          const scale = WIDTH / box.width
          const mx = (event.clientX - box.left) * scale
          const my = (event.clientY - box.top) * scale
          let best = -1
          let bestDist = 64
          for (let i = 0; i < cells.x.length; i++) {
            const dx = PAD + cells.x[i]! * (WIDTH - 2 * PAD) - mx
            const dy = HEIGHT - PAD - cells.y[i]! * (HEIGHT - 2 * PAD) - my
            const d = dx * dx + dy * dy
            if (d < bestDist) {
              bestDist = d
              best = i
            }
          }
          if (best !== -1) {
            onPick(cells.cellTypes[cells.type[best]!]!.name)
          }
        }}
      />
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: WIDTH }}
      >
        {cells.cellTypes.map(type => (
          <button
            key={type.name}
            type="button"
            onClick={() => {
              onPick(type.name)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 7px',
              cursor: 'pointer',
              // CanvasText, not a hex grey: the selected outline has to stay
              // visible whichever scheme the host page is in
              border: selected.includes(type.name)
                ? '2px solid CanvasText'
                : '2px solid transparent',
              background: 'none',
              font: 'inherit',
              fontSize: '0.85em',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                background: type.color,
              }}
            />
            {type.name}
          </button>
        ))}
      </div>
    </div>
  )
}

// --- end of the UMAP panel; the genome view starts here ---

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
    uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
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
          uri: `${BASE}/${type.name.replaceAll(' ', '_')}.bw`,
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
        assembly: 'GRCh38',
        // MS4A1, the B-cell marker: one row carries the coverage
        loc: '11:60,453,846-60,472,752',
        tracks: ['hg38_refseq_curated', TRACK_ID, PER_CELL_TRACK_ID],
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
                  void view.navToLocString(cells.geneLoc[at]!)
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
