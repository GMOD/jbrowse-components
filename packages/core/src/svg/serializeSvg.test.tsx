import { PaintLayer } from '../util/paintLayer.tsx'
import { renderToStaticMarkup } from '../util/renderToStaticMarkup.ts'
import { serializeSvg } from './serializeSvg.ts'

function parses(markup: string) {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
  return doc.getElementsByTagName('parsererror').length === 0
}

test('a no-break space serializes as an XML character reference', () => {
  const svg = serializeSvg(
    <svg xmlns="http://www.w3.org/2000/svg">
      <text data-label={'a b'}>{'a b'}</text>
    </svg>,
  )
  expect(svg).not.toContain('&nbsp;')
  expect(svg).toContain('a&#160;b')
  expect(parses(svg)).toBe(true)
})

test('an rgba paint splits into rgb and an opacity attribute', () => {
  const svg = serializeSvg(
    <svg>
      <rect fill="rgba(1, 2, 3, 0.5)" stroke="rgb(4,5,6)" />
    </svg>,
  )
  expect(svg).toContain('fill="rgb(1,2,3)"')
  expect(svg).toContain('fill-opacity="0.5"')
  expect(svg).toContain('stroke="rgb(4,5,6)"')
  expect(svg).not.toContain('stroke-opacity')
})

test('an alpha folds into an opacity the element already carries', () => {
  const svg = serializeSvg(
    <svg xmlns="http://www.w3.org/2000/svg">
      <rect fill="rgba(0,0,0,0.5)" fillOpacity={0.5} />
    </svg>,
  )
  expect(svg.match(/fill-opacity=/g)).toHaveLength(1)
  expect(svg).toContain('fill-opacity="0.25"')
  expect(parses(svg)).toBe(true)
})

test('slash syntax, hex alpha and a three-channel rgba leave the rest of the markup intact', () => {
  const svg = serializeSvg(
    <svg>
      <rect fill="rgba(0 0 0 / 0.5)" />
      <g transform="translate(10,20)">
        <rect stroke="#00000080" />
        <rect fill="rgba(0,0,0)" />
      </g>
    </svg>,
  )
  expect(svg).toContain('translate(10,20)')
  expect(svg).toContain('fill="rgb(0,0,0)" fill-opacity="0.5"')
  expect(svg).toContain('stroke="rgb(0,0,0)" stroke-opacity="0.502"')
  expect(svg).not.toContain('rgba')
})

test('a quoted > does not end a tag early', () => {
  const svg = serializeSvg(
    <svg>
      <rect data-name="a>b" fill="rgba(1,2,3,0.5)" />
    </svg>,
  )
  expect(svg).toContain('fill="rgb(1,2,3)" fill-opacity="0.5"')
})

test('text that looks like a paint attribute is not rewritten', () => {
  const svg = serializeSvg(
    <svg>
      <text>fill=&quot;rgba(1,2,3,0.5)&quot;</text>
    </svg>,
  )
  expect(svg).toContain('rgba(1,2,3,0.5)')
})

function clippedLayer() {
  return (
    <PaintLayer
      width={10}
      height={10}
      paint={ctx => {
        ctx.beginPath()
        ctx.rect(0, 0, 10, 10)
        ctx.clip()
        ctx.fillRect(0, 0, 5, 5)
      }}
    />
  )
}

// A live figure mints clip ids from the same counter into a page. A file
// export in between must not restart the page's numbering, or the next live
// figure reuses an id an earlier one still points at.
test('a file export leaves the live numbering where it was', () => {
  const clipIds = (markup: string) =>
    [...markup.matchAll(/<clipPath id="([^"]+)"/g)].map(m => m[1])
  const first = clipIds(renderToStaticMarkup(<svg>{clippedLayer()}</svg>))
  const second = clipIds(renderToStaticMarkup(<svg>{clippedLayer()}</svg>))
  serializeSvg(<svg>{clippedLayer()}</svg>)
  const third = clipIds(renderToStaticMarkup(<svg>{clippedLayer()}</svg>))

  expect(new Set([...first, ...second, ...third]).size).toBe(3)
})
