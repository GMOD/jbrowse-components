import { useEffect, useRef } from 'react'

export interface CellType {
  name: string
  group: string
  color: string
}

export interface Cells {
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
export function geneValues(cells: Cells, expr: Uint8Array, gene: string) {
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

export default function UmapScatter({
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
  const canvas = useRef<HTMLDivElement>(null)
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
    <div ref={canvas}>
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
              border: selected.includes(type.name)
                ? '2px solid #333'
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
