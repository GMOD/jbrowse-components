import { readConfObject } from '@jbrowse/core/configuration'
import { GROW_MAX_HEIGHT } from '@jbrowse/display-kit/heightMode'

import { namesToBlock } from '../shared/readNameBlock.ts'
import { bootAlignmentsDisplay, makeEmptyPileupData } from './testUtils.ts'

// Boots a real LinearAlignmentsDisplay with an assemblyManager mock so the
// containing LGV can actually initialize (measured width + ready assembly) —
// grow mode's `height` getter routes to `grownHeight` only once the view is
// initialized, and the bake-on-exit is likewise gated on init.
//
// The view is left UNMEASURED here on purpose: a case asserts that the slot
// reads back pre-init instead of throwing. `createEnvWithPileup` measures it.
function createEnv() {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay()
  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
  }
  const Session = baseSession.volatile(() => ({
    rpcManager: { call: jest.fn() },
    assemblyManager: {
      get: (name: string) => (name === 'volvox' ? asm : undefined),
      isValidRefName: () => true,
    },
  }))
  const { view, display } = mount(Session)
  return { view, display }
}

// A measured view with `depth` reads all covering the same interval, so the
// pileup packs to exactly `depth` rows and the content height is predictable.
function createEnvWithPileup(depth: number) {
  const { view, display } = createEnv()
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
  ])
  const readPositions = new Uint32Array(depth * 2)
  for (let i = 0; i < depth; i++) {
    readPositions[i * 2] = 1000
    readPositions[i * 2 + 1] = 5000
  }
  display.setRpcData(0, {
    groups: [
      {
        key: '',
        label: '',
        data: {
          ...makeEmptyPileupData(),
          readKeys: Array.from({ length: depth }, (_, i) => `r${i}`),
          ...namesToBlock(Array.from({ length: depth }, (_, i) => `r${i}`)),
          readPositions,
          readFlags: new Uint16Array(depth),
          readMapqs: new Uint8Array(depth),
          readStrands: new Int8Array(depth),
        },
      },
    ],
  })
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
  })
  return { view, display }
}

// Mirrors the canvas display's grow-mode contract: `height` follows the laid-out
// content reactively via the getter (no autorun writes the height config slot),
// and leaving grow bakes the height the user was seeing into the slot.
describe('alignments grow-mode reactive height', () => {
  // Before the view is measured, grow's content-height chain would throw
  // (view-geometry getters). The getter is guarded on `view.initialized` and
  // falls back to the slot, so hydrating a grow-mode session never throws.
  it('returns the slot pre-init instead of throwing', () => {
    const { display } = createEnv()
    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)
    // alignments overrides the base height slot default to 250
    expect(display.height).toBe(250)
  })

  it('drives height from content without writing the slot; exit bakes it', () => {
    const { view, display } = createEnv()
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    ])
    expect(view.initialized).toBe(true)

    display.setHeightMode('grow')
    const grown = display.grownHeight
    // The coverage-band content height, distinct from the 250px slot default.
    expect(grown).not.toBe(250)
    // height tracks the content, but the persisted slot is untouched.
    expect(display.height).toBe(grown)
    expect(readConfObject(display.configuration, 'height')).toBe(250)

    // Leaving grow bakes the visual height into the slot (one deliberate write).
    display.setHeightMode('fixed')
    expect(readConfObject(display.configuration, 'height')).toBe(grown)
    expect(display.height).toBe(grown)
  })

  // The promotable cascade can flip a grow track out of grow mode WITHOUT
  // setHeightMode — resetting it to the inherit sentinel or a session-default
  // change flipping a track that follows the default. The bake is a reaction on
  // the resolved mode, so that exit bakes too, instead of snapping to the stale slot.
  it('bakes on a cascade-driven grow exit (reset), not just the menu action', () => {
    const { view, display } = createEnv()
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    ])

    display.setHeightMode('grow')
    const grown = display.grownHeight
    expect(grown).not.toBe(250)
    expect(display.height).toBe(grown)
    expect(readConfObject(display.configuration, 'height')).toBe(250)

    // Reset the slot to its unset sentinel default, exactly as clearing a
    // customized value does. Resolved heightMode falls to 'fixed' with no
    // setHeightMode call, so only the reaction can bake here.
    display.configuration.setSlot('heightMode', undefined)
    expect(display.autoHeight).toBe(false)
    expect(readConfObject(display.configuration, 'height')).toBe(grown)
    expect(display.height).toBe(grown)
  })

  // A drag-resize leaves grow mode AND applies a delta in the same action. The
  // bake must not clobber the drag delta: the height ends at grown + distance,
  // not just the baked grown height.
  it('a drag-resize leaving grow keeps the drag delta on top of the grown height', () => {
    const { view, display } = createEnv()
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    ])

    display.setHeightMode('grow')
    const grown = display.grownHeight
    expect(display.autoHeight).toBe(true)

    display.resizeHeight(40)
    expect(display.autoHeight).toBe(false)
    expect(display.heightMode).toBe('fixed')
    expect(display.height).toBe(grown + 40)
  })
})

// The grow ceiling is the `growMaxHeight` config slot, not a hardcoded constant.
// A pileup deeper than the ceiling is what makes "autogrow" read as inert: the
// track pins to the ceiling and scrolls the rest, which is indistinguishable
// from a fixed track of that height. Raising the slot has to actually raise it.
describe('the grow ceiling', () => {
  // The slot default is written as a literal so the generated config doc shows a
  // number rather than an identifier; this is what keeps it equal to the shared
  // default the canvas display's own slot uses.
  it('defaults to the shared GROW_MAX_HEIGHT', () => {
    const { display } = createEnv()
    expect(display.growMaxHeight).toBe(GROW_MAX_HEIGHT)
  })

  it('pins the track at the ceiling once the pileup outgrows it', () => {
    const { display } = createEnvWithPileup(300)
    display.setHeightMode('grow')
    expect(display.sections.contentHeight).toBeGreaterThan(
      display.growMaxHeight,
    )
    expect(display.height).toBe(display.growMaxHeight)
    expect(display.scrollableHeight).toBeGreaterThan(0)
  })

  it('grows past the default ceiling when the slot is raised', () => {
    const { display } = createEnvWithPileup(300)
    display.setHeightMode('grow')
    const contentHeight = display.sections.contentHeight
    display.configuration.setSlot('growMaxHeight', contentHeight + 100)
    expect(display.height).toBe(contentHeight)
    expect(display.scrollableHeight).toBe(0)
  })

  it('leaves a pileup that already fits under the ceiling alone', () => {
    const { display } = createEnvWithPileup(20)
    display.setHeightMode('grow')
    expect(display.height).toBe(display.sections.contentHeight)
    expect(display.height).toBeLessThan(display.growMaxHeight)
  })
})
