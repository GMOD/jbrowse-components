import { renderToStaticMarkup } from './renderToStaticMarkup.ts'

describe('renderToStaticMarkup', () => {
  it('renders an element to markup', () => {
    expect(
      renderToStaticMarkup(
        <svg>
          <text x={1}>hi</text>
        </svg>,
      ),
    ).toContain('<text x="1">hi</text>')
  })

  // Pinned because two components (CrossHatches, MultiWiggleOverlayLines) are
  // written around it: SVG 1.1 fill/stroke take a <color>, which excludes
  // rgba(), so the alpha is dropped rather than risking an unparseable fill.
  it('strips the alpha from an rgba color', () => {
    expect(
      renderToStaticMarkup(
        <svg>
          <rect fill="rgba(1,2,3,0.5)" />
        </svg>,
      ),
    ).toContain('fill="rgb(1,2,3)"')
  })

  it('strips each rgba independently and leaves rgb alone', () => {
    const markup = renderToStaticMarkup(
      <svg>
        <rect fill="rgba(1,2,3,0.5)" stroke="rgb(4,5,6)" />
      </svg>,
    )
    expect(markup).toContain('fill="rgb(1,2,3)"')
    expect(markup).toContain('stroke="rgb(4,5,6)"')
  })

  it('leaves a separate opacity attribute alone, which is how alpha survives', () => {
    expect(
      renderToStaticMarkup(
        <svg>
          <rect fill="rgb(200,200,200)" fillOpacity={0.8} />
        </svg>,
      ),
    ).toContain('fill-opacity="0.8"')
  })
})
