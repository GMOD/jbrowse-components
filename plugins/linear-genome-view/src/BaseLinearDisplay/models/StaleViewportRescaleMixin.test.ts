import { types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import StaleViewportRescaleMixin from './StaleViewportRescaleMixin.ts'

// `isViewModel` duck-types on width + setWidth, which is all `getContainingView`
// needs to find this from the display below.
const TestView = types
  .model('TestView', {
    display: types.late(() => TestDisplay),
  })
  .volatile(() => ({
    width: 800,
    offsetPx: 0,
    bpPerPx: 10,
  }))
  .actions(self => ({
    setWidth(n: number) {
      self.width = n
    },
    scrollTo(n: number) {
      self.offsetPx = n
    },
    zoomTo(n: number) {
      self.bpPerPx = n
    },
  }))

const TestDisplay = types.compose(
  'TestDisplay',
  StaleViewportRescaleMixin(),
  types.model({ id: types.optional(types.identifier, 'd1') }),
)

function setup() {
  const view = TestView.create({ display: {} })
  return { view, display: view.display }
}

describe('captureViewport', () => {
  it('is what a commit records, so a pan during the fetch leaves it stale', () => {
    const { view, display } = setup()

    // the fetch takes its capture, the user pans, the RPC lands
    const drawn = display.captureViewport()
    view.scrollTo(300)
    display.commitDrawnViewport(drawn)

    expect(display.lastDrawnOffsetPx).toBe(0)
    expect(display.viewportFresh).toBe(false)
    // and the pixels drawn for offsetPx 0 get repositioned rather than left
    expect(display.renderTransform.viewOffsetX).toBe(-300)
  })

  it('reads fresh once the viewport comes back to what was drawn', () => {
    const { view, display } = setup()
    display.commitDrawnViewport(display.captureViewport())
    expect(display.viewportFresh).toBe(true)

    view.zoomTo(5)
    expect(display.viewportFresh).toBe(false)
    expect(display.renderTransform.scale).toBe(2)

    view.zoomTo(10)
    expect(display.viewportFresh).toBe(true)
  })

  // The reason it is in `.views()`: both getters above compare against it, and
  // MobX runs an action untracked — so as an action it would take `offsetPx` out
  // of every observer's dependency set and the display would keep repainting
  // whatever the last reaction happened to see. A bare read outside a reaction
  // recomputes either way, so only an autorun can tell the two apart.
  it('leaves the viewport in an observer of viewportFresh', () => {
    const { view, display } = setup()
    display.commitDrawnViewport(display.captureViewport())

    const seen: boolean[] = []
    const dispose = autorun(() => {
      seen.push(display.viewportFresh)
    })
    view.scrollTo(120)
    dispose()

    expect(seen).toEqual([true, false])
  })

  it('leaves the viewport in an observer of renderTransform', () => {
    const { view, display } = setup()
    display.commitDrawnViewport(display.captureViewport())

    const seen: number[] = []
    const dispose = autorun(() => {
      seen.push(display.renderTransform.scale)
    })
    view.zoomTo(20)
    dispose()

    expect(seen).toEqual([1, 0.5])
  })
})
