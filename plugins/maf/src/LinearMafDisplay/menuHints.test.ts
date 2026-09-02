import { createMafTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// Four settings on this menu can be on, correctly on, and doing nothing
// observable — the two band toggles past the summary floor, the codon row
// coloring away from base level, and the CDS strip whose read the byte
// pre-flight declined. In each case the tick deliberately keeps reporting what
// the user chose (so the state is restored without a second click), which is
// what makes silence the wrong answer: the setting is not what is wrong.
// The hint lives in the label, after an em dash (`withHint`), so rows are found
// by their base label and the assertion is on what got appended. Splitting on
// the separator rather than slicing by the base label's length means a reworded
// base label fails as "no such row" rather than as a mangled hint.
const SEP = ' — '

// Annotated because it recurses into its own return type (TS7023 otherwise).
function findRow(items: MenuItem[], label: string): string | undefined {
  for (const item of items) {
    if (
      'label' in item &&
      typeof item.label === 'string' &&
      item.label.split(SEP)[0] === label
    ) {
      return item.label
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

// The hint on that row, or undefined where the row is bare.
function hintOn(items: MenuItem[], label: string) {
  return findRow(items, label)?.split(SEP)[1]
}

// The tooltip a disabled row shows in place of its help text, which is where
// the reason has to live once the row cannot be clicked at all.
function disabledHintOn(items: MenuItem[], label: string) {
  for (const item of items) {
    if (
      'label' in item &&
      typeof item.label === 'string' &&
      item.label.split(SEP)[0] === label &&
      'disabledHelpText' in item
    ) {
      return item.disabledHelpText
    }
  }
  return undefined
}

const BAND_ROWS = ['Show coverage', 'Show conservation (% identity)']
const HINT = 'zoom in past the summary tier'

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

// The right-click sort is the third row the summary tier overrides. It reads
// `rpcDataMap`, which the summary fetch clears on purpose, so past the floor it
// was enabled and silently did nothing.
describe('the right-click sort says when the summary tier has its data', () => {
  const SORT = 'Sort rows by base here'

  function contextItems(bpPerPx: number) {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    view.zoomTo(bpPerPx)
    display.openContextMenu({
      clientX: 0,
      clientY: 0,
      refName: 'ctgA',
      pos: 100,
    })
    return {
      items: display.contextMenuItems(),
      showSummary: display.showSummary,
    }
  }

  it('hints and disables past the floor', () => {
    const { items, showSummary } = contextItems(100)
    expect(showSummary).toBe(true)
    expect(hintOn(items, SORT)).toBe(HINT)
    expect(disabledHintOn(items, SORT)).toBe(HINT)
  })

  it('leaves the row alone below it, where the sort has blocks to read', () => {
    const { items, showSummary } = contextItems(1)
    expect(showSummary).toBe(false)
    expect(hintOn(items, SORT)).toBeUndefined()
    expect(disabledHintOn(items, SORT)).toBe('Needs at least two rows to sort')
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
  const ZOOM_HINT = 'zoom in to base level'

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
      'too much frame data here, zoom in',
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
