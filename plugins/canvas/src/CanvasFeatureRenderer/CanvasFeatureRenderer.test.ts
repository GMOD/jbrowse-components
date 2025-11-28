import { renderToAbstractCanvas } from '@jbrowse/core/util'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { Image, createCanvas } from 'canvas'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import { computeLayouts } from './computeLayouts'
import configSchema from './configSchema'
import { makeImageData } from './makeImageData'
import { createRenderConfigContext } from './renderConfig'

expect.extend({ toMatchImageSnapshot })

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

function canvasToBuffer(canvas: ReturnType<typeof createCanvas>) {
  return canvas.toBuffer('image/png')
}

const defaultTheme = {
  palette: {
    primary: { main: '#0d233f' },
    secondary: { main: '#721e63' },
    tertiary: { main: '#135560' },
    quaternary: { main: '#FFB11D' },
    text: { primary: '#000' },
    framesCDS: [{ main: '#00f' }, { main: '#0f0' }, { main: '#f00' }],
  },
}

function createRenderArgs(
  features: Map<string, SimpleFeature>,
  region: { refName: string; start: number; end: number; assemblyName: string },
  configOverrides: Record<string, unknown> = {},
) {
  const config = configSchema.create(configOverrides, {})
  const bpPerPx = 1
  const layout = new GranularRectLayout({ pitchX: 1, pitchY: 1 })
  const configContext = createRenderConfigContext(config)

  return {
    features,
    bpPerPx,
    region: { ...region, reversed: false },
    config,
    configContext,
    layout,
    displayMode: configContext.displayMode,
    theme: defaultTheme,
  }
}

describe('CanvasFeatureRenderer', () => {
  describe('computeLayouts', () => {
    test('simple box feature', () => {
      const feature = new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 100,
        end: 200,
        name: 'TestFeature',
      })
      const features = new Map([['test1', feature]])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 1000,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region)

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      expect(layoutRecords).toHaveLength(1)
      expect(layoutRecords[0]!.feature.id()).toBe('test1')
      expect(layoutRecords[0]!.layout.width).toBe(100)
      expect(layoutRecords[0]!.topPx).toBe(0)
    })

    test('multiple features get stacked', () => {
      const feature1 = new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 100,
        end: 200,
        name: 'Feature1',
      })
      const feature2 = new SimpleFeature({
        uniqueId: 'test2',
        refName: 'ctgA',
        start: 150,
        end: 250,
        name: 'Feature2',
      })
      const features = new Map([
        ['test1', feature1],
        ['test2', feature2],
      ])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 1000,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region)

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      expect(layoutRecords).toHaveLength(2)
      expect(layoutRecords[0]!.topPx).not.toBe(layoutRecords[1]!.topPx)
    })
  })

  describe('makeImageData', () => {
    test('simple box feature returns flatbush items', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 100,
        end: 200,
        name: 'TestFeature',
        description: 'A test feature',
      })
      const features = new Map([['test1', feature]])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 1000,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region)

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      const width = (region.end - region.start) / args.bpPerPx

      const result = await renderToAbstractCanvas(
        width,
        100,
        { highResolutionScaling: 1 },
        ctx =>
          makeImageData({
            ctx,
            layoutRecords,
            canvasWidth: width,
            renderArgs: {
              ...args,
              features,
              regions: [args.region],
            },
            configContext: args.configContext,
          }),
      )

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.featureId).toBe('test1')
      expect(result.items[0]!.label).toBe('TestFeature')
      expect(result.items[0]!.description).toBe('A test feature')
      expect(result.items[0]!.startBp).toBe(100)
      expect(result.items[0]!.endBp).toBe(200)
      expect(result.flatbush).toBeDefined()
    })

    test('feature with _mouseOver attribute', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 100,
        end: 200,
        name: 'TestFeature',
        _mouseOver: 'Custom mouseover text',
      })
      const features = new Map([['test1', feature]])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 1000,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region)

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      const width = (region.end - region.start) / args.bpPerPx

      const result = await renderToAbstractCanvas(
        width,
        100,
        { highResolutionScaling: 1 },
        ctx =>
          makeImageData({
            ctx,
            layoutRecords,
            canvasWidth: width,
            renderArgs: {
              ...args,
              features,
              regions: [args.region],
            },
            configContext: args.configContext,
          }),
      )

      expect(result.items[0]!.mouseOver).toBe('Custom mouseover text')
    })

    test('gene with mRNA transcript creates subfeature info', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'gene1',
        refName: 'ctgA',
        type: 'gene',
        start: 100,
        end: 500,
        name: 'TestGene',
        subfeatures: [
          {
            uniqueId: 'mrna1',
            refName: 'ctgA',
            type: 'mRNA',
            start: 100,
            end: 500,
            name: 'TestTranscript',
            subfeatures: [
              {
                uniqueId: 'cds1',
                refName: 'ctgA',
                type: 'CDS',
                start: 150,
                end: 250,
                phase: 0,
              },
              {
                uniqueId: 'cds2',
                refName: 'ctgA',
                type: 'CDS',
                start: 300,
                end: 400,
                phase: 0,
              },
            ],
          },
        ],
      })
      const features = new Map([['gene1', feature]])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 1000,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region)

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      const width = (region.end - region.start) / args.bpPerPx

      const result = await renderToAbstractCanvas(
        width,
        100,
        { highResolutionScaling: 1 },
        ctx =>
          makeImageData({
            ctx,
            layoutRecords,
            canvasWidth: width,
            renderArgs: {
              ...args,
              features,
              regions: [args.region],
            },
            configContext: args.configContext,
          }),
      )

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.featureId).toBe('gene1')
      expect(result.subfeatureInfos).toHaveLength(1)
      expect(result.subfeatureInfos[0]!.name).toBe('TestTranscript')
      expect(result.subfeatureInfos[0]!.type).toBe('mRNA')
      expect(result.subfeatureInfos[0]!.parentFeatureId).toBe('gene1')
    })

    test('compact display mode', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 100,
        end: 200,
        name: 'TestFeature',
      })
      const features = new Map([['test1', feature]])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 1000,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region, {
        displayMode: 'compact',
      })

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      expect(layoutRecords[0]!.layout.height).toBe(5)
    })

    test('label truncation for long names', async () => {
      const longName = 'A'.repeat(60)
      const feature = new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 100,
        end: 200,
        name: longName,
      })
      const features = new Map([['test1', feature]])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 1000,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region)

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      const width = (region.end - region.start) / args.bpPerPx

      const result = await renderToAbstractCanvas(
        width,
        100,
        { highResolutionScaling: 1 },
        ctx =>
          makeImageData({
            ctx,
            layoutRecords,
            canvasWidth: width,
            renderArgs: {
              ...args,
              features,
              regions: [args.region],
            },
            configContext: args.configContext,
          }),
      )

      expect(result.items[0]!.label).toBe(longName)
      expect(result.items[0]!.label!.length).toBe(60)
    })

    test('snapshot of flatbush items structure', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 100,
        end: 200,
        name: 'TestFeature',
        note: 'Test description',
      })
      const features = new Map([['test1', feature]])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 1000,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region)

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      const width = (region.end - region.start) / args.bpPerPx

      const result = await renderToAbstractCanvas(
        width,
        100,
        { highResolutionScaling: 1 },
        ctx =>
          makeImageData({
            ctx,
            layoutRecords,
            canvasWidth: width,
            renderArgs: {
              ...args,
              features,
              regions: [args.region],
            },
            configContext: args.configContext,
          }),
      )

      expect(result.items).toMatchSnapshot()
      expect(result.subfeatureInfos).toMatchSnapshot()
    })
  })

  describe('canvas snapshots', () => {
    test('simple box feature rendering', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 50,
        end: 150,
        name: 'SimpleFeature',
      })
      const features = new Map([['test1', feature]])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 200,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region)

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      const width = region.end - region.start
      const height = 50
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')

      makeImageData({
        ctx: ctx as unknown as CanvasRenderingContext2D,
        layoutRecords,
        canvasWidth: width,
        renderArgs: {
          ...args,
          features,
          regions: [args.region],
        },
        configContext: args.configContext,
      })

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })

    test('multiple overlapping features', async () => {
      const feature1 = new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 20,
        end: 80,
        name: 'Feature1',
      })
      const feature2 = new SimpleFeature({
        uniqueId: 'test2',
        refName: 'ctgA',
        start: 60,
        end: 120,
        name: 'Feature2',
      })
      const feature3 = new SimpleFeature({
        uniqueId: 'test3',
        refName: 'ctgA',
        start: 100,
        end: 180,
        name: 'Feature3',
      })
      const features = new Map([
        ['test1', feature1],
        ['test2', feature2],
        ['test3', feature3],
      ])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 200,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region)

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      const width = region.end - region.start
      const height = 100
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')

      makeImageData({
        ctx: ctx as unknown as CanvasRenderingContext2D,
        layoutRecords,
        canvasWidth: width,
        renderArgs: {
          ...args,
          features,
          regions: [args.region],
        },
        configContext: args.configContext,
      })

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })

    test('gene with transcript and CDS', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'gene1',
        refName: 'ctgA',
        type: 'gene',
        start: 10,
        end: 180,
        name: 'TestGene',
        subfeatures: [
          {
            uniqueId: 'mrna1',
            refName: 'ctgA',
            type: 'mRNA',
            start: 10,
            end: 180,
            name: 'Transcript-1',
            subfeatures: [
              {
                uniqueId: 'utr1',
                refName: 'ctgA',
                type: 'five_prime_UTR',
                start: 10,
                end: 30,
              },
              {
                uniqueId: 'cds1',
                refName: 'ctgA',
                type: 'CDS',
                start: 30,
                end: 70,
                phase: 0,
              },
              {
                uniqueId: 'cds2',
                refName: 'ctgA',
                type: 'CDS',
                start: 100,
                end: 150,
                phase: 0,
              },
              {
                uniqueId: 'utr2',
                refName: 'ctgA',
                type: 'three_prime_UTR',
                start: 150,
                end: 180,
              },
            ],
          },
        ],
      })
      const features = new Map([['gene1', feature]])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 200,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region)

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      const width = region.end - region.start
      const height = 50
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')

      makeImageData({
        ctx: ctx as unknown as CanvasRenderingContext2D,
        layoutRecords,
        canvasWidth: width,
        renderArgs: {
          ...args,
          features,
          regions: [args.region],
        },
        configContext: args.configContext,
      })

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })

    test('compact display mode', async () => {
      const feature1 = new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 20,
        end: 80,
        name: 'Feature1',
      })
      const feature2 = new SimpleFeature({
        uniqueId: 'test2',
        refName: 'ctgA',
        start: 60,
        end: 120,
        name: 'Feature2',
      })
      const features = new Map([
        ['test1', feature1],
        ['test2', feature2],
      ])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 200,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region, { displayMode: 'compact' })

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      const width = region.end - region.start
      const height = 50
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')

      makeImageData({
        ctx: ctx as unknown as CanvasRenderingContext2D,
        layoutRecords,
        canvasWidth: width,
        renderArgs: {
          ...args,
          features,
          regions: [args.region],
        },
        configContext: args.configContext,
      })

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })

    test('gene with multiple transcripts', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'gene1',
        refName: 'ctgA',
        type: 'gene',
        start: 10,
        end: 180,
        strand: 1,
        name: 'MultiTranscriptGene',
        subfeatures: [
          {
            uniqueId: 'mrna1',
            refName: 'ctgA',
            type: 'mRNA',
            start: 10,
            end: 180,
            strand: 1,
            name: 'Transcript-1',
            subfeatures: [
              {
                uniqueId: 'cds1a',
                refName: 'ctgA',
                type: 'CDS',
                start: 20,
                end: 60,
                strand: 1,
                phase: 0,
              },
              {
                uniqueId: 'cds1b',
                refName: 'ctgA',
                type: 'CDS',
                start: 120,
                end: 170,
                strand: 1,
                phase: 0,
              },
            ],
          },
          {
            uniqueId: 'mrna2',
            refName: 'ctgA',
            type: 'mRNA',
            start: 10,
            end: 150,
            strand: 1,
            name: 'Transcript-2',
            subfeatures: [
              {
                uniqueId: 'cds2a',
                refName: 'ctgA',
                type: 'CDS',
                start: 30,
                end: 80,
                strand: 1,
                phase: 0,
              },
              {
                uniqueId: 'cds2b',
                refName: 'ctgA',
                type: 'CDS',
                start: 100,
                end: 140,
                strand: 1,
                phase: 0,
              },
            ],
          },
        ],
      })
      const features = new Map([['gene1', feature]])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 200,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region)

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      const width = region.end - region.start
      const height = 80
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')

      makeImageData({
        ctx: ctx as unknown as CanvasRenderingContext2D,
        layoutRecords,
        canvasWidth: width,
        renderArgs: {
          ...args,
          features,
          regions: [args.region],
        },
        configContext: args.configContext,
      })

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })

    test('transcript arrows on forward and reverse strand', async () => {
      const forwardGene = new SimpleFeature({
        uniqueId: 'gene1',
        refName: 'ctgA',
        type: 'gene',
        start: 10,
        end: 90,
        strand: 1,
        name: 'ForwardGene',
        subfeatures: [
          {
            uniqueId: 'mrna1',
            refName: 'ctgA',
            type: 'mRNA',
            start: 10,
            end: 90,
            strand: 1,
            name: 'Forward-Transcript',
            subfeatures: [
              {
                uniqueId: 'cds1',
                refName: 'ctgA',
                type: 'CDS',
                start: 20,
                end: 80,
                strand: 1,
                phase: 0,
              },
            ],
          },
        ],
      })
      const reverseGene = new SimpleFeature({
        uniqueId: 'gene2',
        refName: 'ctgA',
        type: 'gene',
        start: 110,
        end: 190,
        strand: -1,
        name: 'ReverseGene',
        subfeatures: [
          {
            uniqueId: 'mrna2',
            refName: 'ctgA',
            type: 'mRNA',
            start: 110,
            end: 190,
            strand: -1,
            name: 'Reverse-Transcript',
            subfeatures: [
              {
                uniqueId: 'cds2',
                refName: 'ctgA',
                type: 'CDS',
                start: 120,
                end: 180,
                strand: -1,
                phase: 0,
              },
            ],
          },
        ],
      })
      const features = new Map([
        ['gene1', forwardGene],
        ['gene2', reverseGene],
      ])
      const region = {
        refName: 'ctgA',
        start: 0,
        end: 200,
        assemblyName: 'volvox',
      }
      const args = createRenderArgs(features, region)

      const layoutRecords = computeLayouts({
        features,
        bpPerPx: args.bpPerPx,
        region: args.region,
        config: args.config,
        configContext: args.configContext,
        layout: args.layout,
      })

      const width = region.end - region.start
      const height = 50
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')

      makeImageData({
        ctx: ctx as unknown as CanvasRenderingContext2D,
        layoutRecords,
        canvasWidth: width,
        renderArgs: {
          ...args,
          features,
          regions: [args.region],
        },
        configContext: args.configContext,
      })

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })
  })
})
