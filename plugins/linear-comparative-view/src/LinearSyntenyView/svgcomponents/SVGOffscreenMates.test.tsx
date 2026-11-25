import { ExportFontFamilyContext } from '@jbrowse/core/svg/constants'
import { measureText } from '@jbrowse/core/util'
import { createCanvas } from '@napi-rs/canvas'
import { renderToString } from 'react-dom/server'

import SVGOffscreenMates from './SVGOffscreenMates.tsx'

import type { OffscreenMateStrip } from '../../LinearSyntenyViewHelper/offscreenMateStrip.ts'

const nodeCanvas = createCanvas as unknown as (
  width: number,
  height: number,
) => HTMLCanvasElement

const width = 1000

const strip: OffscreenMateStrip = {
  datasets: [
    {
      mateRefNameDict: ['ctgB'],
      counts: Uint32Array.of(1),
      alignedBp: Float64Array.of(10_000),
      starts: Float64Array.of(0),
      ends: Float64Array.of(10_000),
      mateRefNameIds: Uint32Array.of(0),
      lengths: Float32Array.of(10_000),
      mateStarts: Float64Array.of(0),
      mateEnds: Float64Array.of(10_000),
    },
  ],
  mateBand: { lo: -Infinity, hi: Infinity },
  bpPerPx: 10,
  offsetPx: 0,
  side: 'top',
  width,
  height: 50,
  navRow: 1,
}

function exported(fontFamily: string) {
  return renderToString(
    <svg>
      <ExportFontFamilyContext value={fontFamily}>
        <SVGOffscreenMates
          strips={[strip]}
          width={width}
          height={50}
          groundColor="#fff"
          opts={{ rasterizeLayers: true, createCanvas: nodeCanvas }}
        />
      </ExportFontFamilyContext>
    </svg>,
  )
}

// The marks rasterize with the figure; the names stay text in its font, laid
// out at that font's width: centred over the stretch they name.
test('a rasterized export names the contig in text, in the export font', () => {
  const svg = exported('monospace')
  const names = [...svg.matchAll(/<text[^>]*>ctgB<\/text>/g)].map(m => m[0])
  expect(svg).toContain('<image')
  expect(names).toHaveLength(2)
  for (const name of names) {
    expect(name).toContain('font-family="monospace"')
    const x = Number(/ x="([\d.]+)"/.exec(name)![1])
    expect(x).toBeCloseTo((width - measureText('ctgB', 10, 'monospace')) / 2, 0)
  }
})
