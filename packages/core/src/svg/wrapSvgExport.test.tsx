import { PaintLayer } from '../util/paintLayer.tsx'
import { wrapSvgExport } from './wrapSvgExport.tsx'

// A layer that clips, so it mints a clip id. Two of them, because the collision
// the counter is global to avoid is between LAYERS of one document, not between
// draws of one layer.
function clippedLayers() {
  return (
    <>
      <PaintLayer
        width={100}
        height={20}
        paint={ctx => {
          ctx.beginPath()
          ctx.rect(0, 0, 100, 20)
          ctx.clip()
          ctx.fillStyle = 'red'
          ctx.fillRect(0, 0, 10, 10)
        }}
      />
      <PaintLayer
        width={100}
        height={20}
        paint={ctx => {
          ctx.beginPath()
          ctx.rect(0, 0, 100, 20)
          ctx.clip()
          ctx.fillStyle = 'blue'
          ctx.fillRect(0, 0, 10, 10)
        }}
      />
    </>
  )
}

function exportOnce() {
  return wrapSvgExport({
    theme: undefined,
    width: 100,
    height: 40,
    children: clippedLayers(),
  })
}

// The property `svgNodeId` exists to hold, asserted for the ids SvgCanvas mints
// itself: the same content exports to the same bytes. The clip counter is
// process-wide (ids are document-global, so it has to be shared across the
// PaintLayers of one document), and left running it numbered each export from
// wherever the previous one stopped — so exporting the same view twice differed
// in every clip id, diffing two saved files showed changes that weren't real,
// and `jest -t` on any but the first export test failed a checked-in snapshot
// with a diff that was nothing but renumbering.
test('the same content exports to the same bytes, export after export', () => {
  const first = exportOnce()
  const second = exportOnce()
  const third = exportOnce()

  expect(first).toContain('svgcanvas-clip-0')
  expect(second).toBe(first)
  expect(third).toBe(first)
})

// The reset must not go so far as to reuse an id WITHIN a document: two layers
// clipping to the same rect that both minted `svgcanvas-clip-0` would leave the
// second `url(#svgcanvas-clip-0)` pointing at the first layer's clipPath.
test('layers of one document still get distinct clip ids', () => {
  const svg = exportOnce()

  const ids = [...svg.matchAll(/<clipPath id="(svgcanvas-clip-\d+)"/g)].map(
    m => m[1]!,
  )
  expect(ids).toHaveLength(2)
  expect(new Set(ids).size).toBe(2)
  for (const id of ids) {
    expect(svg).toContain(`url(#${id})`)
  }
})
