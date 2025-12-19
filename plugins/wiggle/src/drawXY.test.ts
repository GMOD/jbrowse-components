import { renderToAbstractCanvas } from '@jbrowse/core/util'
import { Image, createCanvas } from 'canvas'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import configSchema from './XYPlotRenderer/configSchema'
import { drawXYArrays } from './drawXY'

expect.extend({ toMatchImageSnapshot })

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

function makeRenderProps(overrides = {}) {
  const config = configSchema.create()
  return {
    regions: [
      {
        end: 1000,
        start: 0,
        refName: 'ctgA',
        assemblyName: 'volvox',
      },
    ],
    scaleOpts: {
      domain: [0, 100],
      range: [0, 100],
      scaleType: 'linear' as const,
    },
    config,
    bpPerPx: 1,
    highResolutionScaling: 1,
    height: 100,
    ticks: { values: [0, 100] },
    displayCrossHatches: false,
    inverted: false,
    ...overrides,
  }
}

function imageToBuffer(
  img: InstanceType<typeof Image>,
  width: number,
  height: number,
) {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  // eslint-disable-next-line no-restricted-globals
  return Buffer.from(
    canvas.toDataURL().replace(/^data:image\/\w+;base64,/, ''),
    'base64',
  )
}

describe('drawXYArrays', () => {
  describe('pixel dedup path', () => {
    it('renders sub-pixel features that tile contiguously', async () => {
      // 1000 features, each 1bp wide, at bpPerPx=10 means each feature is 0.1px
      const len = 1000
      const starts = new Int32Array(len)
      const ends = new Int32Array(len)
      const scores = new Float32Array(len)

      for (let i = 0; i < len; i++) {
        starts[i] = i
        ends[i] = i + 1
        scores[i] = 50
      }

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 10, // features are 0.1px wide
        regions: [
          { end: 1000, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(100, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      expect(result.reducedFeatures.starts.length).toBeGreaterThan(0)
      expect(result).toMatchSnapshot({ imageData: expect.any(Object) })
    })

    it('renders sub-pixel features with gaps correctly', async () => {
      // Features with gaps between them - each feature is 1bp, at bpPerPx=10 they are 0.1px
      const starts = new Int32Array([0, 20, 40, 60, 80])
      const ends = new Int32Array([1, 21, 41, 61, 81])
      const scores = new Float32Array([50, 50, 50, 50, 50])

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 10, // each 1bp feature is 0.1px wide (sub-pixel)
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(10, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      // Each feature maps to a different pixel column (0, 2, 4, 6, 8)
      // so we should have 5 reduced features
      expect(result.reducedFeatures.starts.length).toBe(5)
      expect(result).toMatchSnapshot({ imageData: expect.any(Object) })
    })

    it('handles features spanning multiple pixels when first feature is sub-pixel', async () => {
      // First feature is sub-pixel (0.5px), but later features span multiple pixels
      // This tests the fix where pixel dedup marks all columns a feature covers
      const starts = new Int32Array([0, 10, 100])
      const ends = new Int32Array([5, 20, 200]) // at bpPerPx=10: 0.5px, 1px, 10px
      const scores = new Float32Array([50, 60, 70])

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 10, // first feature is 0.5px (sub-pixel), triggers pixel dedup
        regions: [
          { end: 200, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(20, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      // All pixel columns covered by features should have data
      // Feature 0: pixel 0, Feature 1: pixels 1-2, Feature 2: pixels 10-20
      expect(result.reducedFeatures.starts.length).toBeGreaterThan(0)
      expect(result).toMatchSnapshot({ imageData: expect.any(Object) })
    })

    it('correctly assigns max score when multiple features map to same pixel', async () => {
      // Multiple sub-pixel features mapping to same pixel column
      const starts = new Int32Array([0, 1, 2, 3, 4])
      const ends = new Int32Array([1, 2, 3, 4, 5])
      const scores = new Float32Array([10, 50, 30, 80, 20]) // max is 80 at index 3

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 10, // all 5 features map to pixel column 0
        regions: [
          { end: 10, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(1, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      // Should have used the max score (80) for pixel column 0
      expect(result.reducedFeatures.scores[0]).toBe(80)
    })
  })

  describe('non-pixel-dedup path (features >= 1px)', () => {
    it('renders features larger than 1px', async () => {
      const starts = new Int32Array([0, 100, 200])
      const ends = new Int32Array([100, 200, 300])
      const scores = new Float32Array([30, 60, 90])

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 1, // each 100bp feature is 100px wide
        regions: [
          { end: 300, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(300, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      expect(result.reducedFeatures.starts).toEqual([0, 100, 200])
      expect(result).toMatchSnapshot({ imageData: expect.any(Object) })
    })

    it('renders features with gaps using fudge factor', async () => {
      // Features with small gaps that fudge factor should help cover
      const starts = new Int32Array([0, 110, 220])
      const ends = new Int32Array([100, 210, 300])
      const scores = new Float32Array([50, 50, 50])

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 1,
        regions: [
          { end: 300, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(300, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      expect(result.reducedFeatures.starts.length).toBe(3)
      expect(result).toMatchSnapshot({ imageData: expect.any(Object) })
    })
  })

  describe('edge cases', () => {
    it('handles empty feature arrays', async () => {
      const featureArrays = {
        starts: new Int32Array(0),
        ends: new Int32Array(0),
        scores: new Float32Array(0),
      }
      const renderProps = makeRenderProps()

      const result = await renderToAbstractCanvas(100, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      expect(result.reducedFeatures.starts).toEqual([])
      expect(result.reducedFeatures.ends).toEqual([])
      expect(result.reducedFeatures.scores).toEqual([])
    })

    it('handles single feature', async () => {
      const featureArrays = {
        starts: new Int32Array([50]),
        ends: new Int32Array([100]),
        scores: new Float32Array([75]),
      }
      const renderProps = makeRenderProps({
        bpPerPx: 1,
        regions: [
          { end: 200, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(200, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      expect(result.reducedFeatures.starts.length).toBe(1)
      expect(result).toMatchSnapshot({ imageData: expect.any(Object) })
    })

    it('handles reversed region', async () => {
      const starts = new Int32Array([0, 50, 100])
      const ends = new Int32Array([50, 100, 150])
      const scores = new Float32Array([30, 60, 90])

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 1,
        regions: [
          {
            end: 150,
            start: 0,
            refName: 'ctgA',
            assemblyName: 'volvox',
            reversed: true,
          },
        ],
      })

      const result = await renderToAbstractCanvas(150, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      expect(result.reducedFeatures.starts.length).toBe(3)
      expect(result).toMatchSnapshot({ imageData: expect.any(Object) })
    })
  })

  describe('image snapshot tests', () => {
    it('pixel dedup: contiguous sub-pixel features should have no gaps', async () => {
      // 100 contiguous 1bp features at bpPerPx=10 (0.1px each)
      // Should render as a solid filled area with no gaps
      const len = 100
      const starts = new Int32Array(len)
      const ends = new Int32Array(len)
      const scores = new Float32Array(len)

      for (let i = 0; i < len; i++) {
        starts[i] = i
        ends[i] = i + 1
        scores[i] = 50
      }

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 10,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(10, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 10, 100),
      ).toMatchImageSnapshot()
    })

    it('pixel dedup: variable width features should cover all pixels', async () => {
      // First feature is sub-pixel (triggers pixel dedup), but later features
      // span multiple pixels. This tests the fix where we mark all columns.
      const starts = new Int32Array([0, 10, 50])
      const ends = new Int32Array([5, 20, 100]) // 0.5px, 1px, 5px at bpPerPx=10
      const scores = new Float32Array([30, 60, 90])

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 10,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(10, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      // Should have no gaps - all pixel columns 0-9 should be filled
      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 10, 100),
      ).toMatchImageSnapshot()
    })

    it('pixel dedup: features with gaps should show gaps', async () => {
      // Features with intentional gaps between them
      // Gaps should be visible in the rendered output
      const starts = new Int32Array([0, 30, 60])
      const ends = new Int32Array([10, 40, 70])
      const scores = new Float32Array([50, 50, 50])

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 10,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(10, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      // Should show gaps between features (columns 1-2, 4-5, 7-9 empty)
      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 10, 100),
      ).toMatchImageSnapshot()
    })

    it('non-pixel-dedup: large features should render correctly', async () => {
      // Features larger than 1px use non-pixel-dedup path
      const starts = new Int32Array([0, 50, 100])
      const ends = new Int32Array([50, 100, 150])
      const scores = new Float32Array([25, 50, 75])

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 1,
        regions: [
          { end: 150, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(150, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 150, 100),
      ).toMatchImageSnapshot()
    })

    it('varying scores should show height differences', async () => {
      // Features with different scores should render at different heights
      const starts = new Int32Array([0, 25, 50, 75])
      const ends = new Int32Array([25, 50, 75, 100])
      const scores = new Float32Array([20, 40, 60, 80])

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(100, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 100),
      ).toMatchImageSnapshot()
    })

    it('pixel dedup: max score selection when multiple features overlap', async () => {
      // Multiple sub-pixel features at same location with different scores
      // Should use the max score for rendering
      const starts = new Int32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      const ends = new Int32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      // Scores: low, high, low, high pattern - pixel should show max
      const scores = new Float32Array([20, 80, 20, 80, 20, 80, 20, 80, 20, 80])

      const featureArrays = { starts, ends, scores }
      const renderProps = makeRenderProps({
        bpPerPx: 10, // all 10 features map to pixel 0
        regions: [
          { end: 10, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
      })

      const result = await renderToAbstractCanvas(1, 100, renderProps, ctx =>
        drawXYArrays(ctx, { ...renderProps, featureArrays, color: 'blue' }),
      )

      // Should render at max score height (80)
      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 1, 100),
      ).toMatchImageSnapshot()
    })
  })
})
