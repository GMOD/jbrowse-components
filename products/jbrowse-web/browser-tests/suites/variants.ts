import {
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

// Multi-sample variant with a pinned (overflowing) row height. The rows are
// 8px × ~1000 samples ≫ the 200px track, so the display must scroll — used to
// assert the scroll structure stays correct (regression guard for the
// "per track scrollbars" report: a spurious second bar on the outer container).
const overflowingMultiSampleSpec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_test_vcf',
          displaySnapshot: {
            type: 'LinearMultiSampleVariantDisplay',
            rowHeight: 8,
            height: 200,
          },
        },
      ],
    },
  ],
}

// Plain LinearVariantDisplay (canvas basic) with a short track so its labelled
// variants stack past the viewport and it scrolls. Used to guard the GPU/DOM
// scroll-tear fix: the label overlay must track model.scrollTop (like the GPU
// canvas), not ride the native compositor scroll.
const overflowingPlainVariantSpec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_filtered_vcf',
          displaySnapshot: { type: 'LinearVariantDisplay', height: 40 },
        },
      ],
    },
  ],
}

const suite: TestSuite = {
  name: 'Variants Track',
  tests: [
    // Regression guard for the "variants separated from their labels" tear: the
    // sticky GPU canvas paints from model.scrollTop while the DOM label overlay
    // used to ride the native (compositor) scroll, so a scroll faster than the
    // main thread could service pulled the two apart. We simulate that lag by
    // freezing the DOM->model rAF sync (so model.scrollTop stays 0) and then
    // scrolling the native container: the sticky canvas must not move, and the
    // labels must stay locked to it (before the fix they moved by -scroll).
    {
      name: 'variant labels stay locked to the canvas during scroll',
      fn: async page => {
        await navigateWithSessionSpec(page, overflowingPlainVariantSpec)
        await findByTestId(
          page,
          'display-volvox_filtered_vcf-LinearVariantDisplay-done',
        )
        await waitForDataLoaded(page)

        const res = await page.evaluate(() => {
          const canvas = document.querySelector('canvas')
          let el = canvas?.parentElement ?? null
          while (el && !/auto|scroll/.test(getComputedStyle(el).overflowY)) {
            el = el.parentElement
          }
          // a floating label div carries an inline translate() transform
          const label = [...document.querySelectorAll('div')].find(d =>
            d.style.transform.includes('translate('),
          )
          if (!el || !canvas || !label) {
            return { setupFailed: true }
          }
          const labelBefore = label.getBoundingClientRect().top
          const canvasBefore = canvas.getBoundingClientRect().top
          const origRaf = window.requestAnimationFrame
          window.requestAnimationFrame = () => 0
          el.scrollTop = 60
          const labelMoved = label.getBoundingClientRect().top - labelBefore
          const canvasMoved = canvas.getBoundingClientRect().top - canvasBefore
          window.requestAnimationFrame = origRaf
          el.scrollTop = 0
          return {
            overflow: el.scrollHeight - el.clientHeight,
            labelMoved,
            canvasMoved,
          }
        })

        if (res.setupFailed) {
          throw new Error('could not locate scroll container, canvas, or label')
        }
        if ((res.overflow ?? 0) < 60) {
          throw new Error(
            `display did not overflow enough to scroll (${res.overflow}px)`,
          )
        }
        if (Math.abs(res.canvasMoved!) > 1) {
          throw new Error(`sticky canvas moved ${res.canvasMoved}px (expected 0)`)
        }
        if (Math.abs(res.labelMoved!) > 1) {
          throw new Error(
            `label tore from its glyph: moved ${res.labelMoved}px (expected ~0) — overlay is riding native scroll instead of model.scrollTop`,
          )
        }
      },
    },

    lgvSnapshotTest({
      name: 'assembly aliases VCF track',
      snapshot: 'variants-assembly-aliases',
      loc: 'ctgA:1..50,001',
      tracks: ['volvox_filtered_vcf_assembly_alias'],
    }),

    // The plain multi-sample variant display scrolls in its own native
    // overflow container (sticky canvas), and the outer TrackRenderingContainer
    // must NOT be a scroll port — otherwise both render a scrollbar. See the
    // "no pinned top band -> native scroll" rule in VariantComponent.tsx.
    {
      name: 'multi-sample variant scrolls natively without a second scrollbar',
      fn: async page => {
        await navigateWithSessionSpec(page, overflowingMultiSampleSpec)
        await findByTestId(page, 'variant-display-done')
        await waitForDataLoaded(page)

        const checks = await page.evaluate(() => {
          const css = (el: Element, p: string) =>
            getComputedStyle(el).getPropertyValue(p)
          const outer = document.querySelector(
            '[data-testid^="trackRenderingContainer"]',
          )
          const canvas = document.querySelector(
            '[data-testid="variant_canvas"]',
          )
          const scrollContainer = canvas?.parentElement?.parentElement ?? null
          return {
            outerOverflowY: outer ? css(outer, 'overflow-y') : null,
            outerOverflows: outer
              ? outer.scrollHeight > outer.clientHeight
              : null,
            canvasPosition: canvas ? css(canvas, 'position') : null,
            innerOverflowY: scrollContainer
              ? css(scrollContainer, 'overflow-y')
              : null,
            innerOverflows: scrollContainer
              ? scrollContainer.scrollHeight > scrollContainer.clientHeight
              : null,
          }
        })

        // outer container is not a scroll port (a spurious second scrollbar)
        if (checks.outerOverflowY !== 'hidden') {
          throw new Error(
            `outer TrackRenderingContainer overflow-y expected 'hidden', got '${checks.outerOverflowY}'`,
          )
        }
        if (checks.outerOverflows) {
          throw new Error(
            'outer TrackRenderingContainer is overflowing — spurious native scrollbar',
          )
        }
        // the display owns one native scroll container with a sticky canvas
        if (checks.canvasPosition !== 'sticky') {
          throw new Error(
            `variant canvas position expected 'sticky', got '${checks.canvasPosition}'`,
          )
        }
        if (checks.innerOverflowY !== 'auto') {
          throw new Error(
            `variant scroll container overflow-y expected 'auto', got '${checks.innerOverflowY}'`,
          )
        }
        if (!checks.innerOverflows) {
          throw new Error(
            'variant scroll container is not overflowing — the pinned rowHeight should exceed the viewport',
          )
        }
      },
    },
  ],
}

export default suite
