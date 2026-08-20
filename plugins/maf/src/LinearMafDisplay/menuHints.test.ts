import { createMafTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// Four settings on this menu can be on, correctly on, and doing nothing
// observable — the two band toggles past the summary floor, the codon row
// coloring away from base level, and the CDS strip whose read the byte
// pre-flight declined. In each case the tick deliberately keeps reporting what
// the user chose (so the state is restored without a second click), which is
// what makes silence the wrong answer: the setting is not what is wrong.
// The hint lives in the label (`withHint` appends it parenthesized), so rows are
// found by their base label and the assertion is on what got appended.
// Annotated because it recurses into its own return type (TS7023 otherwise).
function findRow(items: MenuItem[], label: string): string | undefined {
  for (const item of items) {
    if ('label' in item && typeof item.label === 'string') {
      if (item.label === label || item.label.startsWith(`${label} (`)) {
        return item.label
      }
    }
    if ('subMenu' in item) {
      const hit = findRow(item.subMenu, label)
      if (hit) {
        return hit
      }
    }
  }
  return undefined
}

// What findRow returned, minus the base label: the hint, or undefined when the
// row is bare.
function hintOn(items: MenuItem[], label: string) {
  const found = findRow(items, label)
  return found && found !== label
    ? found.slice(label.length + 2, -1)
    : undefined
}

const BAND_ROWS = ['Show coverage', 'Show conservation (% identity)']
const HINT = 'zoom in past the summary tier to see it'

describe('the band toggles say when the summary tier has overridden them', () => {
  it('adds the hint past the floor', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    view.zoomTo(100)
    expect(display.showSummary).toBe(true)

    const items = display.trackMenuItems()
    for (const label of BAND_ROWS) {
      expect(hintOn(items, label)).toBe(HINT)
    }
  })

  it('drops it below the floor, where the ticks do what they say', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    view.zoomTo(1)
    expect(display.showSummary).toBe(false)

    const items = display.trackMenuItems()
    for (const label of BAND_ROWS) {
      expect(hintOn(items, label)).toBeUndefined()
    }
  })

  // A track with no summary file never enters the tier, so it never earns the
  // hint however far out it is zoomed — it gets the force-load prompt instead.
  it('never adds it to a track with no summary file', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(400)
    const items = display.trackMenuItems()
    for (const label of BAND_ROWS) {
      expect(hintOn(items, label)).toBeUndefined()
    }
  })
})

const framesEnv = () =>
  createMafTestEnvironment({ annotationAdapter: { type: 'BigBedAdapter' } })

// `zoomedToBaseLevel` reads the debounced coarse zoom, which the headless view
// only publishes when asked.
function zoomAndSettle(
  view: ReturnType<
    ReturnType<typeof createMafTestEnvironment>['createDisplay']
  >['view'],
  bpPerPx: number,
) {
  view.zoomTo(bpPerPx)
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
}

// The codon option is the other tick that can sit on a rendering that is not
// painting: codons only exist at base level, and `activeRowRendering` falls
// back to the bases without moving the tick (deliberately — a radio that
// re-picks itself as you zoom reads as the menu changing the setting behind
// your back). The two identity options have carried an explanation of their own
// swap for a while; this is the same sentence for the one that never had it.
describe('the codon row coloring says when it is out of zoom range', () => {
  const CODON = 'Codon changes (amino acids)'
  const ZOOM_HINT = 'zoom in to base level to see them'

  it('hints while zoomed out', () => {
    const { display, view } = framesEnv().createDisplay()
    zoomAndSettle(view, 100)
    expect(display.zoomedToBaseLevel).toBe(false)
    expect(hintOn(display.trackMenuItems(), CODON)).toBe(ZOOM_HINT)
  })

  it('drops the hint at base level, where the option does what it says', () => {
    const { display, view } = framesEnv().createDisplay()
    zoomAndSettle(view, 0.5)
    expect(display.zoomedToBaseLevel).toBe(true)
    expect(hintOn(display.trackMenuItems(), CODON)).toBeUndefined()
  })

  // The option only exists where a mafFrames adapter can define a reading
  // frame, so a track without one has no row to hint on.
  it('is not offered at all without a frames adapter', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    zoomAndSettle(view, 100)
    expect(findRow(display.trackMenuItems(), CODON)).toBeUndefined()
  })
})

// The CDS strip is the one thing here that can be on, correctly on, and still
// draw nothing: its own byte pre-flight declines the read at wide spans on a
// deep alignment, and that failure is soft by design — nothing else on screen
// changes. Silence there is indistinguishable from "this region has no CDS".
describe('the CDS strip says when its read was declined as too large', () => {
  const STRIP = 'Show CDS frames'

  it('is quiet while the frames are being read', () => {
    const { display } = framesEnv().createDisplay()
    expect(display.framesGateBlocked).toBe(false)
    expect(hintOn(display.trackMenuItems(), STRIP)).toBeUndefined()
  })

  it('says so once the pre-flight declines', () => {
    const { display } = framesEnv().createDisplay()
    display.setFramesGateBlocked(true)
    expect(hintOn(display.trackMenuItems(), STRIP)).toBe(
      'too much frame data at this zoom — zoom in',
    )
  })

  // The verdict is about a viewport, so it goes with the data rather than
  // outliving it — otherwise chromosome nav carries "too much data" onto a
  // region nobody has measured yet.
  it('clears with the data it describes', () => {
    const { display } = framesEnv().createDisplay()
    display.setFramesGateBlocked(true)
    display.clearDisplaySpecificData()
    expect(display.framesGateBlocked).toBe(false)
    expect(hintOn(display.trackMenuItems(), STRIP)).toBeUndefined()
  })
})
