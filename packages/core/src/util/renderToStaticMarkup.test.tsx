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

  it('throws what a component throws, rather than returning no markup', () => {
    function Broken(): React.ReactElement {
      throw new Error('no feature to read')
    }
    expect(() =>
      renderToStaticMarkup(
        <svg>
          <Broken />
        </svg>,
      ),
    ).toThrow('no feature to read')
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
