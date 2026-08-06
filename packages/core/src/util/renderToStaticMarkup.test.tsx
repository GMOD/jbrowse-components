import { observable, runInAction } from 'mobx'
import { observer } from 'mobx-react'

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
  // rgba(), so the alpha is dropped rather than risking an unparsable fill.
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

  // This is a real client root, so effects run and every `observer` in an
  // export ends up holding a live MobX reaction on the session's models. The
  // root has to be unmounted or each export leaves its whole detached tree
  // subscribed for the rest of the session, re-rendering on every pan/zoom.
  it('leaves nothing subscribed to the observables it read', async () => {
    const box = observable.box(1)
    let renders = 0
    const Obs = observer(function Obs() {
      renders++
      return <text>{box.get()}</text>
    })

    expect(
      renderToStaticMarkup(
        <svg>
          <Obs />
        </svg>,
      ),
    ).toContain('<text>1</text>')
    expect(renders).toBe(1)

    runInAction(() => {
      box.set(2)
    })
    // a reaction-driven re-render is scheduled, not synchronous, so give the
    // scheduler a turn before concluding that nothing was listening
    await new Promise(resolve => {
      setTimeout(resolve, 0)
    })
    expect(renders).toBe(1)
  })
})
