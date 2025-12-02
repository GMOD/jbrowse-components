import GranularRectLayout from '../../util/layouts/GranularRectLayout'
import MultiLayout from '../../util/layouts/MultiLayout'

import { LayoutSession } from './LayoutSession'

import type { CachedLayout, LayoutSessionProps } from './LayoutSession'

// Create a testable subclass that doesn't use readConfObject
class TestableLayoutSession extends LayoutSession {
  private testConfig = {
    maxHeight: 600,
    displayMode: 'normal',
    noSpacing: false,
  }

  makeLayout() {
    return new MultiLayout(GranularRectLayout, {
      maxHeight: this.testConfig.maxHeight,
      displayMode: this.testConfig.displayMode,
      pitchX: this.props.bpPerPx,
      pitchY: this.testConfig.noSpacing ? 1 : 3,
    })
  }

  cachedLayoutIsValid(cachedLayout: CachedLayout) {
    // Simplified validation that doesn't use readConfObject
    if (cachedLayout.props.bpPerPx !== this.props.bpPerPx) {
      return false
    }

    // Check if current regions overlap with the cached coordinate range
    const region = this.props.regions[0]
    if (region) {
      const hasOverlap =
        region.end > cachedLayout.minCoord && cachedLayout.maxCoord > region.start
      if (!hasOverlap) {
        return false
      }
    }

    return true
  }
}

function createProps(
  start: number,
  end: number,
  bpPerPx = 1,
): LayoutSessionProps {
  return {
    regions: [{ refName: 'chr1', start, end, assemblyName: 'hg38' }],
    config: {} as any,
    bpPerPx,
  }
}

describe('LayoutSession', () => {
  describe('layout caching', () => {
    test('creates new layout when bpPerPx changes', () => {
      const session = new TestableLayoutSession(createProps(0, 10000, 1))
      const layout1 = session.layout

      session.update(createProps(0, 10000, 2))
      const layout2 = session.layout

      expect(layout1).not.toBe(layout2)
    })

    test('reuses layout when scrolling within overlapping region', () => {
      const session = new TestableLayoutSession(createProps(0, 10000))
      const layout1 = session.layout

      // Scroll slightly - still overlaps with original region
      session.update(createProps(5000, 15000))
      const layout2 = session.layout

      expect(layout1).toBe(layout2)
    })

    test('creates new layout when jumping to non-overlapping region', () => {
      const session = new TestableLayoutSession(createProps(0, 10000))
      const layout1 = session.layout

      // Jump far away - no overlap with original region
      session.update(createProps(1000000, 1010000))
      const layout2 = session.layout

      expect(layout1).not.toBe(layout2)
    })
  })

  describe('coordinate tracking', () => {
    test('tracks min/max coordinates as regions expand', () => {
      const session = new TestableLayoutSession(createProps(5000, 10000))
      session.layout

      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.minCoord).toBe(5000)
      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.maxCoord).toBe(10000)

      // Scroll left
      session.update(createProps(2000, 7000))
      session.layout

      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.minCoord).toBe(2000)
      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.maxCoord).toBe(10000)

      // Scroll right
      session.update(createProps(8000, 15000))
      session.layout

      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.minCoord).toBe(2000)
      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.maxCoord).toBe(15000)
    })

    test('resets min/max when layout is recreated after jump', () => {
      const session = new TestableLayoutSession(createProps(0, 10000))
      session.layout

      // Scroll to expand range
      session.update(createProps(5000, 20000))
      session.layout

      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.minCoord).toBe(0)
      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.maxCoord).toBe(20000)

      // Jump far away
      session.update(createProps(1000000, 1010000))
      session.layout

      // Min/max should be reset to the new region
      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.minCoord).toBe(1000000)
      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.maxCoord).toBe(1010000)
    })
  })

  describe('edge cases', () => {
    test('handles adjacent but non-overlapping regions as jump', () => {
      const session = new TestableLayoutSession(createProps(0, 10000))
      const layout1 = session.layout

      // Region starts exactly where previous ended - no overlap
      session.update(createProps(10000, 20000))
      const layout2 = session.layout

      // Adjacent regions don't overlap, so new layout should be created
      expect(layout1).not.toBe(layout2)
    })

    test('handles region that touches edge of tracked range', () => {
      const session = new TestableLayoutSession(createProps(5000, 10000))
      session.layout

      // Expand tracked range
      session.update(createProps(0, 7000))
      session.layout

      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.minCoord).toBe(0)
      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.maxCoord).toBe(10000)

      // New region overlaps by 1bp with tracked range
      session.update(createProps(9999, 15000))
      const layout = session.layout

      // Should still be the same layout (overlaps)
      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.maxCoord).toBe(15000)
      expect(layout).toBeDefined()
    })

    test('continuous scrolling expands tracked range', () => {
      const session = new TestableLayoutSession(createProps(0, 1000))
      session.layout

      // Simulate continuous scrolling right
      for (let i = 1; i <= 10; i++) {
        session.update(createProps(i * 500, i * 500 + 1000))
        session.layout
      }

      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.minCoord).toBe(0)
      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.maxCoord).toBe(6000) // 5000 + 1000
    })

    test('large jump after extensive scrolling creates new layout', () => {
      const session = new TestableLayoutSession(createProps(0, 1000))
      const layout1 = session.layout

      // Scroll extensively
      for (let i = 1; i <= 100; i++) {
        session.update(createProps(i * 500, i * 500 + 1000))
        session.layout
      }

      // @ts-expect-error accessing private property for testing
      const maxAfterScrolling = session.cachedLayout.maxCoord

      // Jump far beyond the tracked range
      session.update(createProps(maxAfterScrolling + 100000, maxAfterScrolling + 101000))
      const layout2 = session.layout

      expect(layout1).not.toBe(layout2)
    })
  })

  describe('layoutWasReset flag', () => {
    test('flag is NOT set on initial layout creation', () => {
      const session = new TestableLayoutSession(createProps(0, 10000))
      session.layout

      // On first load there are no stale blocks, so no reset signal needed
      expect(session.layoutWasReset).toBe(false)
    })

    test('flag is cleared by checkAndClearLayoutWasReset', () => {
      const session = new TestableLayoutSession(createProps(0, 10000))
      session.layout

      // Force a reset by jumping
      session.update(createProps(1000000, 1010000))
      session.layout

      expect(session.checkAndClearLayoutWasReset()).toBe(true)
      expect(session.layoutWasReset).toBe(false)
      expect(session.checkAndClearLayoutWasReset()).toBe(false)
    })

    test('flag is not set during normal scrolling', () => {
      const session = new TestableLayoutSession(createProps(0, 10000))
      session.layout

      // Scroll within overlapping region
      session.update(createProps(5000, 15000))
      session.layout

      expect(session.layoutWasReset).toBe(false)
    })

    test('flag is set when layout is reset due to jump', () => {
      const session = new TestableLayoutSession(createProps(0, 10000))
      session.layout

      // Jump far away
      session.update(createProps(1000000, 1010000))
      session.layout

      expect(session.layoutWasReset).toBe(true)
    })

    test('flag is set when bpPerPx changes', () => {
      const session = new TestableLayoutSession(createProps(0, 10000, 1))
      session.layout

      // Change zoom level
      session.update(createProps(0, 10000, 2))
      session.layout

      expect(session.layoutWasReset).toBe(true)
    })
  })

  describe('realistic navigation scenarios', () => {
    // Simulate a 1000px wide view at 10 bp/px = 10000 bp visible at a time
    const bpPerPx = 10
    const viewWidthBp = 10000

    function regionAt(offsetPx: number) {
      const start = offsetPx * bpPerPx
      const end = start + viewWidthBp
      return createProps(start, end, bpPerPx)
    }

    test('jumping between bookmarks at same zoom triggers layout reset', () => {
      const session = new TestableLayoutSession(regionAt(0))

      // Initial view at position 0
      session.layout
      expect(session.layoutWasReset).toBe(false)

      // User clicks bookmark at chr1:500000 (offsetPx ~50000)
      session.update(regionAt(50000))
      session.layout
      expect(session.layoutWasReset).toBe(true)
      session.checkAndClearLayoutWasReset()

      // User clicks another bookmark at chr1:2000000 (offsetPx ~200000)
      session.update(regionAt(200000))
      session.layout
      expect(session.layoutWasReset).toBe(true)
      session.checkAndClearLayoutWasReset()

      // User clicks "back" to return to chr1:500000
      session.update(regionAt(50000))
      session.layout
      expect(session.layoutWasReset).toBe(true)
    })

    test('clicking on search result far away triggers reset', () => {
      const session = new TestableLayoutSession(regionAt(0))

      // User is viewing start of chromosome
      session.layout
      session.checkAndClearLayoutWasReset()

      // Scroll a bit to the right (overlapping, no reset)
      session.update(regionAt(500))
      session.layout
      expect(session.layoutWasReset).toBe(false)

      // User searches for gene and clicks result at 5Mbp
      session.update(regionAt(500000))
      session.layout
      expect(session.layoutWasReset).toBe(true)
    })

    test('navigating between chromosomes triggers reset', () => {
      // Simulating chromosome navigation by using very different coordinates
      const session = new TestableLayoutSession(regionAt(0))

      // Viewing chr1:0-10000
      session.layout

      // User switches to chr2 (simulated as a large coordinate jump)
      // In reality this would be a different refName, but for layout purposes
      // it would be at offsetPx 0 for that chromosome
      session.update(regionAt(100000000)) // 1 billion bp away
      session.layout
      expect(session.layoutWasReset).toBe(true)
    })

    test('feature click navigation within same region does not reset', () => {
      const session = new TestableLayoutSession(regionAt(1000))

      // User viewing a region
      session.layout

      // User clicks a feature that centers the view nearby (still overlapping)
      session.update(regionAt(1200))
      session.layout
      expect(session.layoutWasReset).toBe(false)

      // Another nearby click
      session.update(regionAt(1400))
      session.layout
      expect(session.layoutWasReset).toBe(false)

      // The tracked range should have expanded
      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.minCoord).toBe(10000) // 1000 * 10
      // @ts-expect-error accessing private property for testing
      expect(session.cachedLayout.maxCoord).toBe(24000) // 1400 * 10 + 10000
    })

    test('session with multiple blocks rendering in sequence', () => {
      // Simulates how blocks render: multiple blocks at different positions
      // but all within the visible region
      const session = new TestableLayoutSession(regionAt(0))

      // Block 1 renders (leftmost)
      session.layout
      const layout1 = session.cachedLayout?.layout

      // Block 2 renders (middle) - same session, slightly offset
      session.update(createProps(3000, 13000, bpPerPx))
      session.layout
      expect(session.layoutWasReset).toBe(false)
      expect(session.cachedLayout?.layout).toBe(layout1) // same layout object

      // Block 3 renders (rightmost)
      session.update(createProps(6000, 16000, bpPerPx))
      session.layout
      expect(session.layoutWasReset).toBe(false)
      expect(session.cachedLayout?.layout).toBe(layout1) // still same layout

      // User jumps to distant location - all blocks will re-render
      session.update(regionAt(100000))
      session.layout
      expect(session.layoutWasReset).toBe(true)
      expect(session.cachedLayout?.layout).not.toBe(layout1) // new layout
    })

    test('back/forward navigation pattern', () => {
      const session = new TestableLayoutSession(regionAt(0))

      // Track layout instances to verify they're different after reset
      session.layout
      const layout1 = session.cachedLayout?.layout

      // Navigate to location A
      session.update(regionAt(50000))
      session.layout
      expect(session.layoutWasReset).toBe(true)
      session.checkAndClearLayoutWasReset()
      const layout2 = session.cachedLayout?.layout
      expect(layout2).not.toBe(layout1)

      // Navigate to location B
      session.update(regionAt(100000))
      session.layout
      expect(session.layoutWasReset).toBe(true)
      session.checkAndClearLayoutWasReset()
      const layout3 = session.cachedLayout?.layout
      expect(layout3).not.toBe(layout2)

      // Press "back" to location A
      session.update(regionAt(50000))
      session.layout
      expect(session.layoutWasReset).toBe(true)
      session.checkAndClearLayoutWasReset()

      // Press "back" again to original location
      session.update(regionAt(0))
      session.layout
      expect(session.layoutWasReset).toBe(true)
    })
  })
})
