import { getFeatureHeightMenuItem } from './menus/featureSize.ts'
import {
  bootAlignmentsDisplay,
  clickMenuItem,
  menuSubItems,
} from './testUtils.ts'

// Boots a real LinearAlignmentsDisplay so the config-slot getters and the
// height-mode split run against the actual MST model.
//
// `displayConfig` lands on the track's own display config (`displayId: 'd1'`),
// which the view-level display then references.
function createDisplay(displayConfig: Record<string, unknown> = {}) {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [
        { type: 'LinearAlignmentsDisplay', displayId: 'd1', ...displayConfig },
      ],
    },
  })
  // no `call`: nothing here is meant to reach a fetch, so one would throw
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  const { display } = mount(Session, { configuration: 'd1' })
  return { display }
}

function presetRow(
  display: ReturnType<typeof createDisplay>['display'],
  label: string,
) {
  const row = getFeatureHeightMenuItem(display, 'read').subMenu.find(
    i => 'label' in i && i.label === label,
  )
  return row as { checked?: boolean; onClick?: () => void } | undefined
}

describe('alignments showSoftClipping', () => {
  it('is off unless the track config says otherwise', () => {
    expect(createDisplay().display.showSoftClipping).toBe(false)
    expect(
      createDisplay({ showSoftClipping: true }).display.showSoftClipping,
    ).toBe(true)
  })

  it('setShowSoftClipping writes the slot both ways', () => {
    const { display } = createDisplay({ showSoftClipping: true })
    display.setShowSoftClipping(false)
    expect(display.showSoftClipping).toBe(false)
    display.setShowSoftClipping(true)
    expect(display.showSoftClipping).toBe(true)
  })
})

// Compactness is featureHeight plus heightMode; spacing is derived from the
// height rather than stored.
describe('alignments compactness', () => {
  it('is Normal with no config', () => {
    const { display } = createDisplay()
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
  })

  it('takes a per-track size from the config', () => {
    const { display } = createDisplay({ featureHeight: 3 })
    expect(display.featureHeight).toBe(3)
    // spacing is derived from the height (3 -> 0)
    expect(display.featureSpacing).toBe(0)
  })

  it('the size presets select each other exclusively', () => {
    const { display } = createDisplay()
    presetRow(display, 'Super-compact')?.onClick?.()
    expect(display.featureHeight).toBe(1)
    expect(presetRow(display, 'Super-compact')?.checked).toBe(true)

    presetRow(display, 'Normal')?.onClick?.()
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
    expect(presetRow(display, 'Normal')?.checked).toBe(true)
    expect(presetRow(display, 'Super-compact')?.checked).toBe(false)
  })
})

describe('alignments fit-to-display-height', () => {
  it('is off by default', () => {
    const { display } = createDisplay()
    expect(display.fitHeightToDisplay).toBe(false)
  })

  it("setHeightMode('fit') enters fit mode", () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    expect(display.fitHeightToDisplay).toBe(true)
  })

  it('setFeatureHeight exits fit mode', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    expect(display.fitHeightToDisplay).toBe(true)

    display.setFeatureHeight(20)
    expect(display.fitHeightToDisplay).toBe(false)
    expect(display.heightMode).toBe('fixed')
    expect(display.configuredFeatureHeight).toBe(20)
  })

  // The "Set feature height" dialog edits the fixed config, so it must seed from
  // `configuredFeatureHeight` — the resolved `featureHeight` becomes the
  // fractional fit pitch in Compressed mode, which the dialog would then bake.
  it('exposes configured feature size independent of the fit squeeze', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(4)

    // resolved size follows the fit pitch (4px pitch = 3px body + 1px spacing)
    expect(display.featureHeight).toBe(3)
    expect(display.featureSpacing).toBe(1)

    // ...but the configured size the dialog edits stays at the config base
    expect(display.configuredFeatureHeight).toBe(7)
  })
})

// mismatchAlpha fades mismatch bases by their per-base Phred quality, and
// reaches the renderers via renderState (tier-4 rerender).
describe('alignments mismatchAlpha (fade by base quality)', () => {
  it('is off by default', () => {
    const { display } = createDisplay()
    expect(display.mismatchAlpha).toBe(false)
  })

  it('setMismatchAlpha sets the config slot on and off', () => {
    const { display } = createDisplay()
    display.setMismatchAlpha(true)
    expect(display.mismatchAlpha).toBe(true)
    display.setMismatchAlpha(false)
    expect(display.mismatchAlpha).toBe(false)
  })

  it('follows a config default', () => {
    const { display } = createDisplay({ mismatchAlpha: true })
    expect(display.mismatchAlpha).toBe(true)
  })

  it('the top-level Show menu exposes the fade-by-quality toggle', () => {
    const { display } = createDisplay()
    // Top-level Show item, not nested under Advanced.
    const show = menuSubItems(display.trackMenuItems(), 'Show...')
    clickMenuItem(show, 'Fade low quality mismatches')
    expect(display.mismatchAlpha).toBe(true)
  })
})

describe('alignments showSashimiLabels (sashimi arc counts)', () => {
  it('is off by default', () => {
    const { display } = createDisplay()
    expect(display.showSashimiLabels).toBe(false)
  })

  it('setShowSashimiLabels writes the slot both ways', () => {
    const { display } = createDisplay({ showSashimiLabels: true })
    display.setShowSashimiLabels(false)
    expect(display.showSashimiLabels).toBe(false)
    display.setShowSashimiLabels(true)
    expect(display.showSashimiLabels).toBe(true)
  })
})

describe('alignments showLegend (color-scheme key)', () => {
  it('is off by default', () => {
    const { display } = createDisplay()
    expect(display.showLegend).toBe(false)
  })

  // The legend's own "×" is `setShowLegend(false)` (PileupComponent).
  it('the legend "×" turns it off', () => {
    const { display } = createDisplay({ showLegend: true })
    expect(display.showLegend).toBe(true)
    display.setShowLegend(false)
    expect(display.showLegend).toBe(false)
  })
})

// `grow` is the third value of the shared `heightMode` vocabulary (with the
// canvas display): the track resizes to fit all reads rather than scrolling
// (fixed) or shrinking reads (fit). autoHeight/fitHeightToDisplay are mutually
// exclusive views of the one slot.
describe('alignments grow (auto-height) mode', () => {
  it('is off by default and mutually exclusive with fit', () => {
    const { display } = createDisplay()
    expect(display.autoHeight).toBe(false)

    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)
    expect(display.fitHeightToDisplay).toBe(false)

    display.setHeightMode('fit')
    expect(display.autoHeight).toBe(false)
    expect(display.fitHeightToDisplay).toBe(true)

    display.setHeightMode('fixed')
    expect(display.autoHeight).toBe(false)
    expect(display.fitHeightToDisplay).toBe(false)
  })

  it('caps the grown height at GROW_MAX_HEIGHT (800)', () => {
    const { display } = createDisplay()
    display.setHeightMode('grow')
    // no fetched reads -> content is just the coverage band, well under the cap
    expect(display.grownHeight).toBeLessThanOrEqual(800)
  })

  it('a manual drag-resize exits grow mode', () => {
    const { display } = createDisplay()
    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)

    display.resizeHeight(50)
    expect(display.autoHeight).toBe(false)
  })

  it('picking a size keeps grow mode (grows at the new size)', () => {
    const { display } = createDisplay()
    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)

    display.setFeatureHeight(3)
    expect(display.autoHeight).toBe(true)
    expect(display.configuredFeatureHeight).toBe(3)
  })
})

// The fit split: while fit is on, featureHeight/featureSpacing don't read the
// config slots — they carve the autorun-cached fit pitch (`fittedHeightPx` =
// pileupSpace/rows) into a read body plus spacing. Here we drive `fittedHeightPx`
// directly (the driving autorun leaves it at 0 with no fetched reads, and
// nothing it tracks changes when we set it, so the value sticks) to exercise the
// split the layout/GPU/SVG consumers actually see. The invariant under test is
// body + spacing === pitch, so the pileup fills the display exactly.
describe('alignments fit-to-display-height split', () => {
  it('with nothing to fit, fittedFeatureHeight is 0 and size falls back to config', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    // no fetched reads -> no rows -> nothing to fit
    expect(display.fittedFeatureHeight).toBe(0)
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
  })

  it('spares a 1px gap once the pitch clears 3px, body fills the rest', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(10)
    expect(display.featureSpacing).toBe(1)
    expect(display.featureHeight).toBe(9)
    // body + spacing reconstructs the pitch exactly
    expect(display.featureHeight + display.featureSpacing).toBe(10)
  })

  it('keeps reads flush (no spacing) at a 3px pitch or tighter', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(3)
    expect(display.featureSpacing).toBe(0)
    expect(display.featureHeight).toBe(3)

    display.setFittedHeightPx(2)
    expect(display.featureSpacing).toBe(0)
    expect(display.featureHeight).toBe(2)
  })

  it('splits a fractional pitch without losing the fill (body stays fractional)', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(3.5)
    expect(display.featureSpacing).toBe(1)
    expect(display.featureHeight).toBe(2.5)
    expect(display.featureHeight + display.featureSpacing).toBe(3.5)
  })

  it('ignores a stale fit cache once fit is off', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(10)
    expect(display.featureHeight).toBe(9)

    // leaving fit doesn't reset the cache, but the getters gate on fit mode so
    // the config values win again
    display.setHeightMode('fixed')
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
  })
})

describe('alignments colorBy', () => {
  it('is normal with no config', () => {
    const { display } = createDisplay()
    expect(display.colorBy).toEqual({ type: 'normal' })
  })

  it('takes an explicit per-track scheme', () => {
    const { display } = createDisplay({ colorBy: { type: 'strand' } })
    expect(display.colorBy).toEqual({ type: 'strand' })
  })

  // Leaving pairs mode discards the now-meaningless pairing scheme.
  it('leaving pairs resets colorBy to normal', () => {
    const { display } = createDisplay()
    display.setLinkedReads('normal')
    expect(display.colorBy.type).toBe('insertSizeAndOrientation')

    display.setLinkedReads('off')
    expect(display.colorBy).toEqual({ type: 'normal' })
  })
})

describe('alignments linkedReads (view as pairs)', () => {
  it('is off with no config', () => {
    const { display } = createDisplay()
    expect(display.linkedReads).toBe('off')
  })

  it('setLinkedReads writes the slot both ways', () => {
    const { display } = createDisplay()
    display.setLinkedReads('normal')
    expect(display.linkedReads).toBe('normal')
    display.setLinkedReads('off')
    expect(display.linkedReads).toBe('off')
  })
})

describe('alignments readConnections (arcs)', () => {
  it('is off with no config', () => {
    const { display } = createDisplay()
    expect(display.readConnections).toBe('off')
  })

  it('takes an explicit per-track overlay', () => {
    const { display } = createDisplay({ readConnections: 'arc' })
    expect(display.readConnections).toBe('arc')
  })
})
