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
})
