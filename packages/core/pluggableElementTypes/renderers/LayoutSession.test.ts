import { LayoutSession } from './LayoutSession'
import GranularRectLayout from '../../util/layouts/GranularRectLayout'
import MultiLayout from '../../util/layouts/MultiLayout'

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
    return cachedLayout.props.bpPerPx === this.props.bpPerPx
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

    test('reuses layout when jumping to non-overlapping region (no reset on coordinate jump)', () => {
      const session = new TestableLayoutSession(createProps(0, 10000))
      const layout1 = session.layout

      // Jump far away - layout is still reused (memory cleanup via discardRange)
      session.update(createProps(1000000, 1010000))
      const layout2 = session.layout

      // Layout should be reused - only bpPerPx/config changes trigger reset
      expect(layout1).toBe(layout2)
    })
  })

  describe('layoutWasReset flag', () => {
    test('flag is NOT set on initial layout creation', () => {
      const session = new TestableLayoutSession(createProps(0, 10000))
      void session.layout

      // On first load there are no stale blocks, so no reset signal needed
      expect(session.layoutWasReset).toBe(false)
    })

    test('flag is cleared by checkAndClearLayoutWasReset', () => {
      const session = new TestableLayoutSession(createProps(0, 10000, 1))
      void session.layout

      // Force a reset by changing bpPerPx
      session.update(createProps(0, 10000, 2))
      void session.layout

      expect(session.checkAndClearLayoutWasReset()).toBe(true)
      expect(session.layoutWasReset).toBe(false)
      expect(session.checkAndClearLayoutWasReset()).toBe(false)
    })

    test('flag is not set during normal scrolling', () => {
      const session = new TestableLayoutSession(createProps(0, 10000))
      void session.layout

      // Scroll within overlapping region
      session.update(createProps(5000, 15000))
      void session.layout

      expect(session.layoutWasReset).toBe(false)
    })

    test('flag is NOT set when jumping to distant region (coordinate jumps do not reset)', () => {
      const session = new TestableLayoutSession(createProps(0, 10000))
      void session.layout

      // Jump far away - should NOT reset (memory cleanup via discardRange instead)
      session.update(createProps(1000000, 1010000))
      void session.layout

      expect(session.layoutWasReset).toBe(false)
    })

    test('flag is set when bpPerPx changes', () => {
      const session = new TestableLayoutSession(createProps(0, 10000, 1))
      void session.layout

      // Change zoom level
      session.update(createProps(0, 10000, 2))
      void session.layout

      expect(session.layoutWasReset).toBe(true)
    })
  })

  describe('disparate regions in same view', () => {
    test('disparate regions should share the same layout without reset', () => {
      // Scenario: displayedRegions = [chr1:1-100, chr1:5000-5100]
      // Blocks render from different parts of the view, but they're all
      // part of the same logical view and should share the same layout
      const session = new TestableLayoutSession(createProps(1, 100, 1))

      // First block renders (region 1)
      void session.layout
      const layout1 = session.cachedLayout?.layout
      expect(session.layoutWasReset).toBe(false)

      // Second block renders from a disparate region (region 2)
      // This should NOT trigger a reset - it's part of the same view
      session.update(createProps(5000, 5100, 1))
      void session.layout

      expect(session.layoutWasReset).toBe(false)
      expect(session.cachedLayout?.layout).toBe(layout1)
    })

    test('multiple disparate regions all share same layout', () => {
      const session = new TestableLayoutSession(createProps(0, 100, 1))
      void session.layout
      const layout1 = session.cachedLayout?.layout

      // Simulate multiple blocks from disparate regions
      const disparateRegions: [number, number][] = [
        [1000, 1100],
        [5000, 5100],
        [10000, 10100],
        [50000, 50100],
      ]

      for (const [start, end] of disparateRegions) {
        session.update(createProps(start, end, 1))
        void session.layout
        expect(session.layoutWasReset).toBe(false)
        expect(session.cachedLayout?.layout).toBe(layout1)
      }
    })

    test('disparate regions reset when bpPerPx changes', () => {
      const session = new TestableLayoutSession(createProps(0, 100, 1))
      void session.layout
      const layout1 = session.cachedLayout?.layout

      // Render disparate region at same bpPerPx - no reset
      session.update(createProps(5000, 5100, 1))
      void session.layout
      expect(session.layoutWasReset).toBe(false)

      // Change bpPerPx - should reset
      session.update(createProps(5000, 5100, 2))
      void session.layout
      expect(session.layoutWasReset).toBe(true)
      expect(session.cachedLayout?.layout).not.toBe(layout1)
    })
  })

  describe('realistic navigation scenarios', () => {
    const bpPerPx = 10
    const viewWidthBp = 10000

    function regionAt(offsetPx: number) {
      const start = offsetPx * bpPerPx
      const end = start + viewWidthBp
      return createProps(start, end, bpPerPx)
    }

    test('navigation preserves layout (cleanup via discardRange)', () => {
      const session = new TestableLayoutSession(regionAt(0))

      // Initial view at position 0
      void session.layout
      const layout1 = session.cachedLayout?.layout
      expect(session.layoutWasReset).toBe(false)

      // User clicks bookmark at chr1:500000
      session.update(regionAt(50000))
      void session.layout
      // Layout is preserved - discardRange handles cleanup
      expect(session.layoutWasReset).toBe(false)
      expect(session.cachedLayout?.layout).toBe(layout1)

      // User clicks another bookmark at chr1:2000000
      session.update(regionAt(200000))
      void session.layout
      expect(session.layoutWasReset).toBe(false)
      expect(session.cachedLayout?.layout).toBe(layout1)
    })

    test('zoom changes trigger reset', () => {
      const session = new TestableLayoutSession(regionAt(0))
      void session.layout
      const layout1 = session.cachedLayout?.layout

      // User zooms in (bpPerPx decreases)
      session.update(createProps(0, 5000, 5))
      void session.layout
      expect(session.layoutWasReset).toBe(true)
      expect(session.cachedLayout?.layout).not.toBe(layout1)
    })

    test('session with multiple blocks from same view', () => {
      const session = new TestableLayoutSession(regionAt(0))

      // Block 1 renders (leftmost)
      void session.layout
      const layout1 = session.cachedLayout?.layout

      // Block 2 renders (middle) - same session, slightly offset
      session.update(createProps(3000, 13000, bpPerPx))
      void session.layout
      expect(session.layoutWasReset).toBe(false)
      expect(session.cachedLayout?.layout).toBe(layout1)

      // Block 3 renders (rightmost)
      session.update(createProps(6000, 16000, bpPerPx))
      void session.layout
      expect(session.layoutWasReset).toBe(false)
      expect(session.cachedLayout?.layout).toBe(layout1)
    })
  })
})
