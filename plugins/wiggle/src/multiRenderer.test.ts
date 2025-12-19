import { renderToAbstractCanvas } from '@jbrowse/core/util'
import { Image, createCanvas } from 'canvas'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import multiDensityConfigSchema from './MultiDensityRenderer/configSchema'
import multiLineConfigSchema from './MultiLineRenderer/configSchema'
import multiRowXYConfigSchema from './MultiRowXYPlotRenderer/configSchema'
import { drawDensityArrays } from './drawDensity'
import { drawLineArrays } from './drawLine'
import { drawXYArrays } from './drawXY'

import type { MultiRenderArgsDeserialized } from './types'
import type { Source, WiggleFeatureArrays } from './util'

expect.extend({ toMatchImageSnapshot })

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

function makeMultiRenderProps(
  sources: Source[],
  overrides = {},
): MultiRenderArgsDeserialized {
  const config = multiRowXYConfigSchema.create()
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
    height: 200,
    ticks: { values: [0, 50, 100] },
    displayCrossHatches: false,
    inverted: false,
    sources,
    features: new Map(),
    ...overrides,
  } as MultiRenderArgsDeserialized
}

function makeLineRenderProps(sources: Source[], overrides = {}) {
  const config = multiLineConfigSchema.create()
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
    height: 200,
    ticks: { values: [0, 50, 100] },
    displayCrossHatches: false,
    inverted: false,
    sources,
    features: new Map(),
    ...overrides,
  } as MultiRenderArgsDeserialized
}

function makeDensityRenderProps(sources: Source[], overrides = {}) {
  const config = multiDensityConfigSchema.create()
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
    height: 200,
    ticks: { values: [0, 50, 100] },
    displayCrossHatches: false,
    inverted: false,
    sources,
    features: new Map(),
    ...overrides,
  } as MultiRenderArgsDeserialized
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

describe('Multi renderer tests', () => {
  describe('MultiRowXYPlot with arrays', () => {
    it('renders two sources in separate rows', async () => {
      const sources: Source[] = [
        { name: 'source1', source: 'source1', color: 'red' },
        { name: 'source2', source: 'source2', color: 'blue' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 10,
        regions: [
          { end: 1000, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 200,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        source1: {
          starts: new Int32Array([0, 100, 200, 300]),
          ends: new Int32Array([100, 200, 300, 400]),
          scores: new Float32Array([25, 50, 75, 100]),
        },
        source2: {
          starts: new Int32Array([0, 100, 200, 300]),
          ends: new Int32Array([100, 200, 300, 400]),
          scores: new Float32Array([100, 75, 50, 25]),
        },
      }

      const rowHeight = renderProps.height / sources.length

      const result = await renderToAbstractCanvas(
        100,
        200,
        renderProps,
        ctx => {
          const allReducedFeatures = []
          ctx.save()
          for (const source of sources) {
            const arrays = arraysBySource[source.name]
            if (arrays) {
              const { reducedFeatures } = drawXYArrays(ctx, {
                ...renderProps,
                featureArrays: arrays,
                height: rowHeight,
                color: source.color || 'blue',
              })
              allReducedFeatures.push(reducedFeatures)
            }
            ctx.strokeStyle = 'rgba(200,200,200,0.8)'
            ctx.beginPath()
            ctx.moveTo(0, rowHeight)
            ctx.lineTo(100, rowHeight)
            ctx.stroke()
            ctx.translate(0, rowHeight)
          }
          ctx.restore()
          return { reducedFeatures: allReducedFeatures }
        },
      )

      expect(result.reducedFeatures.length).toBe(2)
      expect(result.reducedFeatures[0]!.starts.length).toBeGreaterThan(0)
      expect(result.reducedFeatures[1]!.starts.length).toBeGreaterThan(0)
    })

    it('renders multiple sources with different colors', async () => {
      const sources: Source[] = [
        { name: 'source1', source: 'source1', color: '#ff0000' },
        { name: 'source2', source: 'source2', color: '#00ff00' },
        { name: 'source3', source: 'source3', color: '#0000ff' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 10,
        regions: [
          { end: 500, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 300,
      })

      const arraysBySource: Record<
        string,
        { starts: Int32Array; ends: Int32Array; scores: Float32Array }
      > = {}
      for (const [i, source] of sources.entries()) {
        arraysBySource[source.name] = {
          starts: new Int32Array([0, 100, 200, 300, 400]),
          ends: new Int32Array([100, 200, 300, 400, 500]),
          scores: new Float32Array([20 + i * 20, 40, 60, 80, 100 - i * 20]),
        }
      }

      const rowHeight = renderProps.height / sources.length

      const result = await renderToAbstractCanvas(50, 300, renderProps, ctx => {
        const allReducedFeatures = []
        ctx.save()
        for (const source of sources) {
          const arrays = arraysBySource[source.name]
          if (arrays) {
            const { reducedFeatures } = drawXYArrays(ctx, {
              ...renderProps,
              featureArrays: arrays,
              height: rowHeight,
              color: source.color || 'blue',
            })
            allReducedFeatures.push(reducedFeatures)
          }
          ctx.translate(0, rowHeight)
        }
        ctx.restore()
        return { reducedFeatures: allReducedFeatures }
      })

      expect(result.reducedFeatures.length).toBe(3)
      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 50, 300),
      ).toMatchImageSnapshot()
    })

    it('handles empty source gracefully', async () => {
      const sources: Source[] = [
        { name: 'source1', source: 'source1', color: 'red' },
        { name: 'empty', source: 'empty', color: 'green' },
        { name: 'source3', source: 'source3', color: 'blue' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 10,
        regions: [
          { end: 200, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 300,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        source1: {
          starts: new Int32Array([0, 50, 100]),
          ends: new Int32Array([50, 100, 150]),
          scores: new Float32Array([50, 75, 100]),
        },
        empty: {
          starts: new Int32Array(0),
          ends: new Int32Array(0),
          scores: new Float32Array(0),
        },
        source3: {
          starts: new Int32Array([0, 50, 100]),
          ends: new Int32Array([50, 100, 150]),
          scores: new Float32Array([100, 75, 50]),
        },
      }

      const rowHeight = renderProps.height / sources.length

      const result = await renderToAbstractCanvas(20, 300, renderProps, ctx => {
        const allReducedFeatures = []
        ctx.save()
        for (const source of sources) {
          const arrays = arraysBySource[source.name]
          if (arrays) {
            const { reducedFeatures } = drawXYArrays(ctx, {
              ...renderProps,
              featureArrays: arrays,
              height: rowHeight,
              color: source.color || 'blue',
            })
            allReducedFeatures.push(reducedFeatures)
          }
          ctx.translate(0, rowHeight)
        }
        ctx.restore()
        return { reducedFeatures: allReducedFeatures }
      })

      expect(result.reducedFeatures.length).toBe(3)
      expect(result.reducedFeatures[1]!.starts.length).toBe(0) // empty source
    })

    it('renders sub-pixel features correctly across sources', async () => {
      const sources: Source[] = [
        { name: 'source1', source: 'source1', color: 'red' },
        { name: 'source2', source: 'source2', color: 'blue' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 10, // at this zoom, 1bp features are 0.1px (sub-pixel)
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 200,
      })

      // Create many 1bp features that will be sub-pixel and overlap in pixel space
      const len = 100
      const starts = new Int32Array(len)
      const ends = new Int32Array(len)
      const scores = new Float32Array(len)
      for (let i = 0; i < len; i++) {
        starts[i] = i // contiguous 1bp features
        ends[i] = i + 1
        scores[i] = 50
      }

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        source1: { starts, ends, scores },
        source2: {
          starts: new Int32Array(starts),
          ends: new Int32Array(ends),
          scores: new Float32Array(Array.from(scores).map(s => s * 1.5)),
        },
      }

      const rowHeight = renderProps.height / sources.length

      const result = await renderToAbstractCanvas(
        10, // 100bp / 10 bpPerPx = 10px wide
        200,
        renderProps,
        ctx => {
          const allReducedFeatures = []
          ctx.save()
          for (const source of sources) {
            const arrays = arraysBySource[source.name]
            if (arrays) {
              const { reducedFeatures } = drawXYArrays(ctx, {
                ...renderProps,
                featureArrays: arrays,
                height: rowHeight,
                color: source.color || 'blue',
              })
              allReducedFeatures.push(reducedFeatures)
            }
            ctx.translate(0, rowHeight)
          }
          ctx.restore()
          return { reducedFeatures: allReducedFeatures }
        },
      )

      // Should have reduced features for both sources
      expect(result.reducedFeatures.length).toBe(2)
      // 100 sub-pixel features should be deduplicated to ~10 (one per pixel column)
      expect(result.reducedFeatures[0]!.starts.length).toBeLessThan(len)
      expect(result.reducedFeatures[0]!.starts.length).toBeGreaterThan(0)
    })
  })

  describe('MultiRowXYPlot additional tests', () => {
    it('renders opposing score patterns across sources', async () => {
      const sources: Source[] = [
        { name: 'source1', source: 'source1', color: 'red' },
        { name: 'source2', source: 'source2', color: 'blue' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 10,
        regions: [
          { end: 400, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 200,
      })

      // Source 1 has ascending scores, source 2 has descending
      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        source1: {
          starts: new Int32Array([0, 100, 200, 300]),
          ends: new Int32Array([100, 200, 300, 400]),
          scores: new Float32Array([25, 50, 75, 100]),
        },
        source2: {
          starts: new Int32Array([0, 100, 200, 300]),
          ends: new Int32Array([100, 200, 300, 400]),
          scores: new Float32Array([100, 75, 50, 25]),
        },
      }

      const rowHeight = renderProps.height / sources.length

      const result = await renderToAbstractCanvas(40, 200, renderProps, ctx => {
        const allReducedFeatures = []
        ctx.save()
        for (const source of sources) {
          const arrays = arraysBySource[source.name]
          if (arrays) {
            const { reducedFeatures } = drawXYArrays(ctx, {
              ...renderProps,
              featureArrays: arrays,
              height: rowHeight,
              color: source.color || 'blue',
            })
            allReducedFeatures.push(reducedFeatures)
          }
          ctx.translate(0, rowHeight)
        }
        ctx.restore()
        return { reducedFeatures: allReducedFeatures }
      })

      expect(result.reducedFeatures.length).toBe(2)
      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 40, 200),
      ).toMatchImageSnapshot()
    })
  })

  describe('image snapshots', () => {
    it('multi-row plot with varying scores per source', async () => {
      const sources: Source[] = [
        { name: 'high', source: 'high', color: '#e41a1c' },
        { name: 'medium', source: 'medium', color: '#377eb8' },
        { name: 'low', source: 'low', color: '#4daf4a' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 5,
        regions: [
          { end: 500, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 300,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        high: {
          starts: new Int32Array([0, 100, 200, 300, 400]),
          ends: new Int32Array([100, 200, 300, 400, 500]),
          scores: new Float32Array([90, 85, 95, 80, 88]),
        },
        medium: {
          starts: new Int32Array([0, 100, 200, 300, 400]),
          ends: new Int32Array([100, 200, 300, 400, 500]),
          scores: new Float32Array([50, 55, 45, 60, 52]),
        },
        low: {
          starts: new Int32Array([0, 100, 200, 300, 400]),
          ends: new Int32Array([100, 200, 300, 400, 500]),
          scores: new Float32Array([15, 20, 10, 25, 18]),
        },
      }

      const rowHeight = renderProps.height / sources.length

      const result = await renderToAbstractCanvas(
        100,
        300,
        renderProps,
        ctx => {
          const allReducedFeatures = []
          ctx.save()
          for (const source of sources) {
            const arrays = arraysBySource[source.name]
            if (arrays) {
              const { reducedFeatures } = drawXYArrays(ctx, {
                ...renderProps,
                featureArrays: arrays,
                height: rowHeight,
                color: source.color || 'blue',
              })
              allReducedFeatures.push(reducedFeatures)
            }
            ctx.strokeStyle = 'rgba(200,200,200,0.8)'
            ctx.beginPath()
            ctx.moveTo(0, rowHeight)
            ctx.lineTo(100, rowHeight)
            ctx.stroke()
            ctx.translate(0, rowHeight)
          }
          ctx.restore()
          return { reducedFeatures: allReducedFeatures }
        },
      )

      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 300),
      ).toMatchImageSnapshot()
    })
  })

  describe('MultiLine renderer tests', () => {
    it('renders multiple line sources overlapping', async () => {
      const sources: Source[] = [
        { name: 'source1', source: 'source1', color: 'red' },
        { name: 'source2', source: 'source2', color: 'blue' },
      ]
      const renderProps = makeLineRenderProps(sources, {
        bpPerPx: 5,
        regions: [
          { end: 500, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        source1: {
          starts: new Int32Array([0, 100, 200, 300, 400]),
          ends: new Int32Array([100, 200, 300, 400, 500]),
          scores: new Float32Array([20, 60, 40, 80, 50]),
        },
        source2: {
          starts: new Int32Array([0, 100, 200, 300, 400]),
          ends: new Int32Array([100, 200, 300, 400, 500]),
          scores: new Float32Array([80, 40, 60, 20, 50]),
        },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const allReducedFeatures = []
          for (const source of sources) {
            const arrays = arraysBySource[source.name]
            if (arrays) {
              const { reducedFeatures } = drawLineArrays(ctx, {
                ...renderProps,
                featureArrays: arrays,
                color: source.color || 'blue',
              })
              allReducedFeatures.push(reducedFeatures)
            }
          }
          return { reducedFeatures: allReducedFeatures }
        },
      )

      expect(result.reducedFeatures.length).toBe(2)
      expect(result.reducedFeatures[0]!.starts.length).toBeGreaterThan(0)
    })

    it('renders line with varying scores', async () => {
      const sources: Source[] = [
        { name: 'wave', source: 'wave', color: '#2196f3' },
      ]
      const renderProps = makeLineRenderProps(sources, {
        bpPerPx: 2,
        regions: [
          { end: 200, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
      })

      // Create a wave pattern
      const len = 20
      const starts = new Int32Array(len)
      const ends = new Int32Array(len)
      const scores = new Float32Array(len)
      for (let i = 0; i < len; i++) {
        starts[i] = i * 10
        ends[i] = (i + 1) * 10
        scores[i] = 50 + 40 * Math.sin((i / len) * Math.PI * 4)
      }

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        wave: { starts, ends, scores },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const allReducedFeatures = []
          for (const source of sources) {
            const arrays = arraysBySource[source.name]
            if (arrays) {
              const { reducedFeatures } = drawLineArrays(ctx, {
                ...renderProps,
                featureArrays: arrays,
                color: source.color || 'blue',
              })
              allReducedFeatures.push(reducedFeatures)
            }
          }
          return { reducedFeatures: allReducedFeatures }
        },
      )

      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 100),
      ).toMatchImageSnapshot()
    })

    it('handles empty line source', async () => {
      const sources: Source[] = [
        { name: 'empty', source: 'empty', color: 'red' },
      ]
      const renderProps = makeLineRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        empty: {
          starts: new Int32Array(0),
          ends: new Int32Array(0),
          scores: new Float32Array(0),
        },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const allReducedFeatures = []
          for (const source of sources) {
            const arrays = arraysBySource[source.name]
            if (arrays) {
              const { reducedFeatures } = drawLineArrays(ctx, {
                ...renderProps,
                featureArrays: arrays,
                color: source.color || 'blue',
              })
              allReducedFeatures.push(reducedFeatures)
            }
          }
          return { reducedFeatures: allReducedFeatures }
        },
      )

      expect(result.reducedFeatures.length).toBe(1)
      expect(result.reducedFeatures[0]!.starts.length).toBe(0)
    })
  })

  describe('Corner cases and edge cases', () => {
    it('handles negative scores correctly', async () => {
      const sources: Source[] = [
        { name: 'negative', source: 'negative', color: 'blue' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
        scaleOpts: {
          domain: [-50, 50],
          range: [0, 100],
          scaleType: 'linear' as const,
        },
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        negative: {
          starts: new Int32Array([0, 25, 50, 75]),
          ends: new Int32Array([25, 50, 75, 100]),
          scores: new Float32Array([-40, -20, 20, 40]),
        },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const arrays = arraysBySource.negative!
          const { reducedFeatures } = drawXYArrays(ctx, {
            ...renderProps,
            featureArrays: arrays,
            color: 'blue',
          })
          return { reducedFeatures }
        },
      )

      expect(result.reducedFeatures.starts.length).toBe(4)
      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 100),
      ).toMatchImageSnapshot()
    })

    it('handles scores exceeding domain (clipping)', async () => {
      const sources: Source[] = [
        { name: 'clipping', source: 'clipping', color: 'red' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
        scaleOpts: {
          domain: [0, 50], // scores will exceed this
          range: [0, 100],
          scaleType: 'linear' as const,
        },
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        clipping: {
          starts: new Int32Array([0, 25, 50, 75]),
          ends: new Int32Array([25, 50, 75, 100]),
          scores: new Float32Array([30, 100, 150, -20]), // 100 and 150 exceed max, -20 below min
        },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const arrays = arraysBySource.clipping!
          const { reducedFeatures } = drawXYArrays(ctx, {
            ...renderProps,
            featureArrays: arrays,
            color: 'red',
          })
          return { reducedFeatures }
        },
      )

      expect(result.reducedFeatures.starts.length).toBe(4)
      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 100),
      ).toMatchImageSnapshot()
    })

    it('handles zero-width features (start === end)', async () => {
      const sources: Source[] = [
        { name: 'zerow', source: 'zerow', color: 'green' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        zerow: {
          starts: new Int32Array([10, 30, 50, 70]),
          ends: new Int32Array([10, 30, 50, 70]), // same as starts
          scores: new Float32Array([50, 75, 25, 100]),
        },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const arrays = arraysBySource.zerow!
          const { reducedFeatures } = drawXYArrays(ctx, {
            ...renderProps,
            featureArrays: arrays,
            color: 'green',
          })
          return { reducedFeatures }
        },
      )

      // Should still render (with minSize)
      expect(result.reducedFeatures.starts.length).toBeGreaterThan(0)
    })

    it('handles reversed region', async () => {
      const sources: Source[] = [
        { name: 'reversed', source: 'reversed', color: 'purple' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          {
            end: 100,
            start: 0,
            refName: 'ctgA',
            assemblyName: 'volvox',
            reversed: true,
          },
        ],
        height: 100,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        reversed: {
          starts: new Int32Array([0, 25, 50, 75]),
          ends: new Int32Array([25, 50, 75, 100]),
          scores: new Float32Array([25, 50, 75, 100]), // ascending
        },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const arrays = arraysBySource.reversed!
          const { reducedFeatures } = drawXYArrays(ctx, {
            ...renderProps,
            featureArrays: arrays,
            color: 'purple',
          })
          return { reducedFeatures }
        },
      )

      expect(result.reducedFeatures.starts.length).toBe(4)
      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 100),
      ).toMatchImageSnapshot()
    })

    it('handles inverted display', async () => {
      const sources: Source[] = [
        { name: 'inverted', source: 'inverted', color: 'orange' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
        inverted: true,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        inverted: {
          starts: new Int32Array([0, 25, 50, 75]),
          ends: new Int32Array([25, 50, 75, 100]),
          scores: new Float32Array([25, 50, 75, 100]),
        },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const arrays = arraysBySource.inverted!
          const { reducedFeatures } = drawXYArrays(ctx, {
            ...renderProps,
            featureArrays: arrays,
            color: 'orange',
          })
          return { reducedFeatures }
        },
      )

      expect(result.reducedFeatures.starts.length).toBe(4)
      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 100),
      ).toMatchImageSnapshot()
    })

    it('handles single feature', async () => {
      const sources: Source[] = [
        { name: 'single', source: 'single', color: 'teal' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        single: {
          starts: new Int32Array([40]),
          ends: new Int32Array([60]),
          scores: new Float32Array([75]),
        },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const arrays = arraysBySource.single!
          const { reducedFeatures } = drawXYArrays(ctx, {
            ...renderProps,
            featureArrays: arrays,
            color: 'teal',
          })
          return { reducedFeatures }
        },
      )

      expect(result.reducedFeatures.starts.length).toBe(1)
    })

    it('handles extremely zoomed out (very high bpPerPx)', async () => {
      const sources: Source[] = [
        { name: 'zoomedout', source: 'zoomedout', color: 'navy' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 1000, // extremely zoomed out
        regions: [
          { end: 100000, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
      })

      // Many features that will all map to sub-pixel
      const len = 1000
      const starts = new Int32Array(len)
      const ends = new Int32Array(len)
      const scores = new Float32Array(len)
      for (let i = 0; i < len; i++) {
        starts[i] = i * 100
        ends[i] = i * 100 + 50
        scores[i] = 50 + Math.random() * 50
      }

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        zoomedout: { starts, ends, scores },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const arrays = arraysBySource.zoomedout!
          const { reducedFeatures } = drawXYArrays(ctx, {
            ...renderProps,
            featureArrays: arrays,
            color: 'navy',
          })
          return { reducedFeatures }
        },
      )

      // Should be heavily deduplicated
      expect(result.reducedFeatures.starts.length).toBeLessThan(len)
    })

    it('handles features with summary data (whiskers mode)', async () => {
      const sources: Source[] = [
        { name: 'whiskers', source: 'whiskers', color: 'brown' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        whiskers: {
          starts: new Int32Array([0, 25, 50, 75]),
          ends: new Int32Array([25, 50, 75, 100]),
          scores: new Float32Array([50, 60, 40, 70]), // avg scores
          minScores: new Float32Array([30, 40, 20, 50]),
          maxScores: new Float32Array([70, 80, 60, 90]),
        },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const arrays = arraysBySource.whiskers!
          const { reducedFeatures } = drawXYArrays(ctx, {
            ...renderProps,
            featureArrays: arrays,
            color: 'brown',
          })
          return { reducedFeatures }
        },
      )

      expect(result.reducedFeatures.starts.length).toBe(4)
      // Should have min/max scores in reduced features
      expect(result.reducedFeatures.minScores).toBeDefined()
      expect(result.reducedFeatures.maxScores).toBeDefined()
    })

    it('handles features partially outside visible region', async () => {
      const sources: Source[] = [
        { name: 'partial', source: 'partial', color: 'pink' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 50, refName: 'ctgA', assemblyName: 'volvox' }, // view starts at 50
        ],
        height: 100,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        partial: {
          starts: new Int32Array([0, 40, 60, 90, 110]),
          ends: new Int32Array([30, 70, 80, 120, 150]),
          scores: new Float32Array([50, 60, 70, 80, 90]),
        },
      }

      const result = await renderToAbstractCanvas(50, 100, renderProps, ctx => {
        const arrays = arraysBySource.partial!
        const { reducedFeatures } = drawXYArrays(ctx, {
          ...renderProps,
          featureArrays: arrays,
          color: 'pink',
        })
        return { reducedFeatures }
      })

      // Should still process all features (filtering happens elsewhere)
      expect(result.reducedFeatures.starts.length).toBeGreaterThan(0)
    })

    it('handles displayCrossHatches option', async () => {
      const sources: Source[] = [
        { name: 'hatches', source: 'hatches', color: 'gray' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
        displayCrossHatches: true,
        ticks: { values: [0, 25, 50, 75, 100] },
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        hatches: {
          starts: new Int32Array([0, 25, 50, 75]),
          ends: new Int32Array([25, 50, 75, 100]),
          scores: new Float32Array([25, 50, 75, 100]),
        },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const arrays = arraysBySource.hatches!
          const { reducedFeatures } = drawXYArrays(ctx, {
            ...renderProps,
            featureArrays: arrays,
            color: 'gray',
          })
          return { reducedFeatures }
        },
      )

      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 100),
      ).toMatchImageSnapshot()
    })

    it('handles line renderer with gaps between features', async () => {
      const sources: Source[] = [
        { name: 'gaps', source: 'gaps', color: 'magenta' },
      ]
      const renderProps = makeLineRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
      })

      // Features with large gaps - line should not connect across gaps
      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        gaps: {
          starts: new Int32Array([0, 30, 60]),
          ends: new Int32Array([10, 40, 70]),
          scores: new Float32Array([50, 80, 30]),
        },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const arrays = arraysBySource.gaps!
          const { reducedFeatures } = drawLineArrays(ctx, {
            ...renderProps,
            featureArrays: arrays,
            color: 'magenta',
          })
          return { reducedFeatures }
        },
      )

      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 100),
      ).toMatchImageSnapshot()
    })

    it('handles density with all same scores', async () => {
      const sources: Source[] = [
        { name: 'uniform', source: 'uniform', color: 'cyan' },
      ]
      const renderProps = makeDensityRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 50,
      })

      // All scores are the same - should render uniform color
      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        uniform: {
          starts: new Int32Array([0, 25, 50, 75]),
          ends: new Int32Array([25, 50, 75, 100]),
          scores: new Float32Array([50, 50, 50, 50]),
        },
      }

      const result = await renderToAbstractCanvas(100, 50, renderProps, ctx => {
        const arrays = arraysBySource.uniform!
        const { reducedFeatures } = drawDensityArrays(ctx, {
          ...renderProps,
          featureArrays: arrays,
        })
        return { reducedFeatures }
      })

      expect(result.reducedFeatures.starts.length).toBe(4)
      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 50),
      ).toMatchImageSnapshot()
    })

    it('handles very small height', async () => {
      const sources: Source[] = [
        { name: 'tiny', source: 'tiny', color: 'lime' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 5, // very small height
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        tiny: {
          starts: new Int32Array([0, 25, 50, 75]),
          ends: new Int32Array([25, 50, 75, 100]),
          scores: new Float32Array([25, 50, 75, 100]),
        },
      }

      const result = await renderToAbstractCanvas(100, 5, renderProps, ctx => {
        const arrays = arraysBySource.tiny!
        const { reducedFeatures } = drawXYArrays(ctx, {
          ...renderProps,
          featureArrays: arrays,
          color: 'lime',
        })
        return { reducedFeatures }
      })

      expect(result.reducedFeatures.starts.length).toBe(4)
    })

    it('handles score of exactly 0', async () => {
      const sources: Source[] = [
        { name: 'zeros', source: 'zeros', color: 'olive' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        zeros: {
          starts: new Int32Array([0, 25, 50, 75]),
          ends: new Int32Array([25, 50, 75, 100]),
          scores: new Float32Array([0, 50, 0, 100]),
        },
      }

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const arrays = arraysBySource.zeros!
          const { reducedFeatures } = drawXYArrays(ctx, {
            ...renderProps,
            featureArrays: arrays,
            color: 'olive',
          })
          return { reducedFeatures }
        },
      )

      expect(result.reducedFeatures.starts.length).toBe(4)
      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 100),
      ).toMatchImageSnapshot()
    })

    it('handles many overlapping sub-pixel features selecting max score', async () => {
      const sources: Source[] = [
        { name: 'overlap', source: 'overlap', color: 'coral' },
      ]
      const renderProps = makeMultiRenderProps(sources, {
        bpPerPx: 100, // very zoomed out
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
      })

      // 10 features all mapping to 1 pixel with different scores
      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        overlap: {
          starts: new Int32Array([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]),
          ends: new Int32Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
          scores: new Float32Array([10, 30, 50, 20, 90, 40, 60, 80, 70, 25]),
        },
      }

      const result = await renderToAbstractCanvas(1, 100, renderProps, ctx => {
        const arrays = arraysBySource.overlap!
        const { reducedFeatures } = drawXYArrays(ctx, {
          ...renderProps,
          featureArrays: arrays,
          color: 'coral',
        })
        return { reducedFeatures }
      })

      // Should have picked max score (90)
      expect(result.reducedFeatures.scores[0]).toBe(90)
    })
  })

  describe('MultiDensity renderer tests', () => {
    it('renders multiple density sources in rows', async () => {
      const sources: Source[] = [
        { name: 'source1', source: 'source1', color: 'red' },
        { name: 'source2', source: 'source2', color: 'blue' },
      ]
      const renderProps = makeDensityRenderProps(sources, {
        bpPerPx: 5,
        regions: [
          { end: 500, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 100,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        source1: {
          starts: new Int32Array([0, 100, 200, 300, 400]),
          ends: new Int32Array([100, 200, 300, 400, 500]),
          scores: new Float32Array([20, 60, 40, 80, 50]),
        },
        source2: {
          starts: new Int32Array([0, 100, 200, 300, 400]),
          ends: new Int32Array([100, 200, 300, 400, 500]),
          scores: new Float32Array([80, 40, 60, 20, 50]),
        },
      }

      const rowHeight = renderProps.height / sources.length

      const result = await renderToAbstractCanvas(
        100,
        100,
        renderProps,
        ctx => {
          const allReducedFeatures = []
          ctx.save()
          for (const source of sources) {
            const arrays = arraysBySource[source.name]
            if (arrays) {
              const { reducedFeatures } = drawDensityArrays(ctx, {
                ...renderProps,
                featureArrays: arrays,
                height: rowHeight,
              })
              allReducedFeatures.push(reducedFeatures)
            }
            ctx.translate(0, rowHeight)
          }
          ctx.restore()
          return { reducedFeatures: allReducedFeatures }
        },
      )

      expect(result.reducedFeatures.length).toBe(2)
      expect(result.reducedFeatures[0]!.starts.length).toBeGreaterThan(0)
    })

    it('renders density with gradient based on score', async () => {
      const sources: Source[] = [
        { name: 'gradient', source: 'gradient', color: 'blue' },
      ]
      const renderProps = makeDensityRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 50,
      })

      // Create ascending score pattern - should show gradient
      const len = 10
      const starts = new Int32Array(len)
      const ends = new Int32Array(len)
      const scores = new Float32Array(len)
      for (let i = 0; i < len; i++) {
        starts[i] = i * 10
        ends[i] = (i + 1) * 10
        scores[i] = (i + 1) * 10 // 10, 20, 30, ..., 100
      }

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        gradient: { starts, ends, scores },
      }

      const result = await renderToAbstractCanvas(100, 50, renderProps, ctx => {
        const allReducedFeatures = []
        for (const source of sources) {
          const arrays = arraysBySource[source.name]
          if (arrays) {
            const { reducedFeatures } = drawDensityArrays(ctx, {
              ...renderProps,
              featureArrays: arrays,
            })
            allReducedFeatures.push(reducedFeatures)
          }
        }
        return { reducedFeatures: allReducedFeatures }
      })

      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 50),
      ).toMatchImageSnapshot()
    })

    it('handles empty density source', async () => {
      const sources: Source[] = [
        { name: 'empty', source: 'empty', color: 'red' },
      ]
      const renderProps = makeDensityRenderProps(sources, {
        bpPerPx: 1,
        regions: [
          { end: 100, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 50,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        empty: {
          starts: new Int32Array(0),
          ends: new Int32Array(0),
          scores: new Float32Array(0),
        },
      }

      const result = await renderToAbstractCanvas(100, 50, renderProps, ctx => {
        const allReducedFeatures = []
        for (const source of sources) {
          const arrays = arraysBySource[source.name]
          if (arrays) {
            const { reducedFeatures } = drawDensityArrays(ctx, {
              ...renderProps,
              featureArrays: arrays,
            })
            allReducedFeatures.push(reducedFeatures)
          }
        }
        return { reducedFeatures: allReducedFeatures }
      })

      expect(result.reducedFeatures.length).toBe(1)
      expect(result.reducedFeatures[0]!.starts.length).toBe(0)
    })

    it('renders three density rows with different patterns', async () => {
      const sources: Source[] = [
        { name: 'high', source: 'high', color: 'red' },
        { name: 'medium', source: 'medium', color: 'green' },
        { name: 'low', source: 'low', color: 'blue' },
      ]
      const renderProps = makeDensityRenderProps(sources, {
        bpPerPx: 5,
        regions: [
          { end: 500, start: 0, refName: 'ctgA', assemblyName: 'volvox' },
        ],
        height: 150,
      })

      const arraysBySource: Record<string, WiggleFeatureArrays> = {
        high: {
          starts: new Int32Array([0, 100, 200, 300, 400]),
          ends: new Int32Array([100, 200, 300, 400, 500]),
          scores: new Float32Array([90, 85, 95, 88, 92]),
        },
        medium: {
          starts: new Int32Array([0, 100, 200, 300, 400]),
          ends: new Int32Array([100, 200, 300, 400, 500]),
          scores: new Float32Array([50, 55, 45, 52, 48]),
        },
        low: {
          starts: new Int32Array([0, 100, 200, 300, 400]),
          ends: new Int32Array([100, 200, 300, 400, 500]),
          scores: new Float32Array([15, 20, 10, 18, 12]),
        },
      }

      const rowHeight = renderProps.height / sources.length

      const result = await renderToAbstractCanvas(
        100,
        150,
        renderProps,
        ctx => {
          const allReducedFeatures = []
          ctx.save()
          for (const source of sources) {
            const arrays = arraysBySource[source.name]
            if (arrays) {
              const { reducedFeatures } = drawDensityArrays(ctx, {
                ...renderProps,
                featureArrays: arrays,
                height: rowHeight,
              })
              allReducedFeatures.push(reducedFeatures)
            }
            ctx.translate(0, rowHeight)
          }
          ctx.restore()
          return { reducedFeatures: allReducedFeatures }
        },
      )

      expect(
        // @ts-expect-error
        imageToBuffer(result.imageData, 100, 150),
      ).toMatchImageSnapshot()
    })
  })
})
