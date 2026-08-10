import { renderToStaticMarkup } from 'react-dom/server'

import { PaintLayer } from './paintLayer.tsx'

function markup(node: React.ReactNode) {
  return renderToStaticMarkup(<svg>{node}</svg>)
}

describe('PaintLayer vector branch', () => {
  it('serializes what paint drew into a <g>', () => {
    const html = markup(
      <PaintLayer
        width={100}
        height={20}
        paint={ctx => {
          ctx.fillStyle = 'red'
          ctx.fillRect(0, 0, 10, 10)
        }}
      />,
    )
    expect(html).toContain('<g>')
    expect(html).toContain('<rect')
  })

  // Layers are routinely conditional on data — a highlight pass with nothing
  // highlighted, a band that is switched off — and each one used to leave a
  // stray empty group in the exported file.
  it('renders nothing at all when paint drew nothing', () => {
    expect(
      markup(<PaintLayer width={100} height={20} paint={() => {}} />),
    ).toBe('<svg></svg>')
  })

  // The emptiness test is on the drawn output, not on the layer's size: a
  // zero-area layer still reaches the vector branch (canvas creation rejects
  // 0x0), and one that somehow painted is still worth emitting.
  it('keeps a zero-area layer that painted', () => {
    const html = markup(
      <PaintLayer
        width={0}
        height={0}
        paint={ctx => {
          ctx.fillRect(0, 0, 5, 5)
        }}
      />,
    )
    expect(html).toContain('<rect')
  })
})
