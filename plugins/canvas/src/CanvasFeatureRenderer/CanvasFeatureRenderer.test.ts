import PluginManager from '@jbrowse/core/PluginManager'
import { renderToAbstractCanvas } from '@jbrowse/core/util'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { Image, createCanvas } from 'canvas'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import configSchema from './configSchema'
import { STRAND_ARROW_WIDTH, getStrandArrowPadding } from './glyphs/glyphUtils'
import { layoutFeatures } from './layout/layoutFeatures'
import { makeImageData } from './makeImageData'
import { createRenderConfigContext } from './renderConfig'

import type { FloatingLabelData } from './floatingLabels'

interface LayoutSerializableData {
  refName?: string
  floatingLabels?: FloatingLabelData[]
  totalFeatureHeight?: number
  totalLayoutWidth?: number
  actualTopPx?: number
  featureWidth?: number
  featureStartBp?: number
  featureEndBp?: number
}

const pluginManager = new PluginManager([])
pluginManager.configure()

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

const defaultRegion = {
  refName: 'ctgA',
  start: 0,
  end: 1000,
  assemblyName: 'volvox',
}

function createRenderArgs(
  features: Map<string, SimpleFeature>,
  region = defaultRegion,
  configOverrides: Record<string, unknown> = {},
  reversed = false,
) {
  const config = configSchema.create(configOverrides, { pluginManager })
  const bpPerPx = 1
  const layout = new GranularRectLayout<LayoutSerializableData>({
    pitchX: 1,
    pitchY: 1,
  })
  const configContext = createRenderConfigContext(config)

  return {
    features,
    bpPerPx,
    region: { ...region, reversed },
    config,
    configContext,
    layout,
    displayMode: configContext.displayMode,
    theme: defaultTheme,
  }
}

function doLayout(
  args: ReturnType<typeof createRenderArgs>,
  features: Map<string, SimpleFeature>,
) {
  return layoutFeatures({
    features,
    bpPerPx: args.bpPerPx,
    region: args.region,
    configContext: args.configContext,
    layout: args.layout,
    pluginManager,
  })
}

async function renderAndGetResult(
  args: ReturnType<typeof createRenderArgs>,
  features: Map<string, SimpleFeature>,
  layoutRecords: ReturnType<typeof layoutFeatures>,
  height = 100,
) {
  const width = (args.region.end - args.region.start) / args.bpPerPx
  return renderToAbstractCanvas(
    width,
    height,
    { highResolutionScaling: 1 },
    ctx =>
      makeImageData({
        ctx,
        layoutRecords,
        canvasWidth: width,
        renderArgs: { ...args, features, regions: [args.region] },
        configContext: args.configContext,
      }),
  )
}

function renderToCanvas(
  args: ReturnType<typeof createRenderArgs>,
  features: Map<string, SimpleFeature>,
  layoutRecords: ReturnType<typeof layoutFeatures>,
  height: number,
) {
  const width = args.region.end - args.region.start
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  makeImageData({
    ctx: ctx as unknown as CanvasRenderingContext2D,
    layoutRecords,
    canvasWidth: width,
    renderArgs: { ...args, features, regions: [args.region] },
    configContext: args.configContext,
  })
  return canvas
}

describe('CanvasFeatureRenderer', () => {
  describe('layoutFeatures', () => {
    test('simple box feature', () => {
      const feature = new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 100,
        end: 200,
        name: 'TestFeature',
      })
      const features = new Map([['test1', feature]])
      const args = createRenderArgs(features)
      const layoutRecords = doLayout(args, features)

      expect(layoutRecords).toHaveLength(1)
      expect(layoutRecords[0]!.feature.id()).toBe('test1')
      expect(layoutRecords[0]!.layout.width).toBe(100)
      expect(layoutRecords[0]!.topPx).toBe(0)
      expect(layoutRecords[0]!.layout.glyphType).toBe('Box')
    })

    test('layout stores glyphType for use during drawing', () => {
      const geneFeature = new SimpleFeature({
        uniqueId: 'gene1',
        refName: 'ctgA',
        type: 'gene',
        start: 100,
        end: 500,
        subfeatures: [
          {
            uniqueId: 'mrna1',
            refName: 'ctgA',
            type: 'mRNA',
            start: 100,
            end: 500,
            subfeatures: [
              {
                uniqueId: 'cds1',
                refName: 'ctgA',
                type: 'CDS',
                start: 150,
                end: 450,
                phase: 0,
              },
            ],
          },
        ],
      })
      const features = new Map([['gene1', geneFeature]])
      const args = createRenderArgs(features)
      const layoutRecords = doLayout(args, features)

      expect(layoutRecords).toHaveLength(1)
      const geneLayout = layoutRecords[0]!.layout
      expect(geneLayout.glyphType).toBe('Subfeatures')
      expect(geneLayout.children).toHaveLength(1)
      expect(geneLayout.children[0]!.glyphType).toBe('ProcessedTranscript')
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
      const args = createRenderArgs(features)
      const layoutRecords = doLayout(args, features)

      expect(layoutRecords).toHaveLength(2)
      expect(layoutRecords[0]!.topPx).not.toBe(layoutRecords[1]!.topPx)
    })

    test('featureStartBp/featureEndBp in layout metadata stores actual feature coordinates', () => {
      const forwardFeature = new SimpleFeature({
        uniqueId: 'forward1',
        refName: 'ctgA',
        start: 100,
        end: 200,
        name: 'ForwardFeature',
        strand: 1,
      })
      const reverseFeature = new SimpleFeature({
        uniqueId: 'reverse1',
        refName: 'ctgA',
        start: 300,
        end: 400,
        name: 'ReverseFeature',
        strand: -1,
      })
      const features = new Map([
        ['forward1', forwardFeature],
        ['reverse1', reverseFeature],
      ])
      const args = createRenderArgs(features)
      doLayout(args, features)

      // Forward strand: stores actual feature coordinates
      const forwardMeta = args.layout.getSerializableDataByID('forward1')!
      expect(forwardMeta.featureStartBp).toBe(100)
      expect(forwardMeta.featureEndBp).toBe(200)

      // Reverse strand: also stores actual feature coordinates (not layout coords)
      const reverseMeta = args.layout.getSerializableDataByID('reverse1')!
      expect(reverseMeta.featureStartBp).toBe(300)
      expect(reverseMeta.featureEndBp).toBe(400)
    })
  })

  describe('getStrandArrowPadding', () => {
    test('forward strand in non-reversed region has arrow on visual right', () => {
      const result = getStrandArrowPadding(1, false)
      expect(result.visualSide).toBe('right')
      expect(result.width).toBe(STRAND_ARROW_WIDTH)
      expect(result.left).toBe(0)
      expect(result.right).toBe(STRAND_ARROW_WIDTH)
    })

    test('reverse strand in non-reversed region has arrow on visual left', () => {
      const result = getStrandArrowPadding(-1, false)
      expect(result.visualSide).toBe('left')
      expect(result.width).toBe(STRAND_ARROW_WIDTH)
      expect(result.left).toBe(STRAND_ARROW_WIDTH)
      expect(result.right).toBe(0)
    })

    test('forward strand in reversed region has arrow on visual left', () => {
      const result = getStrandArrowPadding(1, true)
      expect(result.visualSide).toBe('left')
      expect(result.width).toBe(STRAND_ARROW_WIDTH)
      expect(result.left).toBe(STRAND_ARROW_WIDTH)
      expect(result.right).toBe(0)
    })

    test('reverse strand in reversed region has arrow on visual right', () => {
      const result = getStrandArrowPadding(-1, true)
      expect(result.visualSide).toBe('right')
      expect(result.width).toBe(STRAND_ARROW_WIDTH)
      expect(result.left).toBe(0)
      expect(result.right).toBe(STRAND_ARROW_WIDTH)
    })

    test('no strand (0) has no arrow', () => {
      const result = getStrandArrowPadding(0, false)
      expect(result.visualSide).toBe(null)
      expect(result.width).toBe(0)
      expect(result.left).toBe(0)
      expect(result.right).toBe(0)
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
      const args = createRenderArgs(features)
      const layoutRecords = doLayout(args, features)
      const result = await renderAndGetResult(args, features, layoutRecords)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.featureId).toBe('test1')
      expect(result.items[0]!.tooltip).toBe('TestFeature<br/>A test feature')
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
      const args = createRenderArgs(features)
      const layoutRecords = doLayout(args, features)
      const result = await renderAndGetResult(args, features, layoutRecords)

      expect(result.items[0]!.tooltip).toBe('Custom mouseover text')
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
      const args = createRenderArgs(features)
      const layoutRecords = doLayout(args, features)
      const result = await renderAndGetResult(args, features, layoutRecords)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.featureId).toBe('gene1')
      expect(result.subfeatureInfos).toHaveLength(1)
      expect(result.subfeatureInfos[0]!.type).toBe('mRNA')
    })

    test('subfeatureInfos has all required fields for click handling', async () => {
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
                end: 450,
                phase: 0,
              },
            ],
          },
        ],
      })
      const features = new Map([['gene1', feature]])
      const args = createRenderArgs(features)
      const layoutRecords = doLayout(args, features)
      const result = await renderAndGetResult(args, features, layoutRecords)

      expect(result.subfeatureInfos).toHaveLength(1)
      const subInfo = result.subfeatureInfos[0]!

      // These fields are required for click handling to work
      expect(subInfo.featureId).toBe('mrna1')
      expect(subInfo.parentFeatureId).toBe('gene1')
      expect(subInfo.type).toBe('mRNA')
      expect(typeof subInfo.leftPx).toBe('number')
      expect(typeof subInfo.topPx).toBe('number')
      expect(typeof subInfo.rightPx).toBe('number')
      expect(typeof subInfo.bottomPx).toBe('number')
    })

    test('subfeature floating labels include parentFeatureId and tooltip for mouseover', async () => {
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
                end: 450,
                phase: 0,
              },
            ],
          },
        ],
      })
      const features = new Map([['gene1', feature]])
      const args = createRenderArgs(features, defaultRegion, {
        subfeatureLabels: 'below',
      })
      const layoutRecords = doLayout(args, features)
      await renderAndGetResult(args, features, layoutRecords)

      const layoutData = args.layout.getSerializableDataByID('mrna1')
      expect(layoutData).toBeDefined()
      expect(layoutData!.floatingLabels).toBeDefined()
      expect(layoutData!.floatingLabels!.length).toBeGreaterThan(0)
      expect(layoutData!.floatingLabels![0]!.parentFeatureId).toBe('gene1')
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
      const args = createRenderArgs(features, defaultRegion, {
        displayMode: 'compact',
      })
      const layoutRecords = doLayout(args, features)

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
      const args = createRenderArgs(features)
      const layoutRecords = doLayout(args, features)
      const result = await renderAndGetResult(args, features, layoutRecords)

      expect(result.items[0]!.tooltip).toBe(longName)
      expect(result.items[0]!.tooltip!.length).toBe(60)
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
      const args = createRenderArgs(features)
      const layoutRecords = doLayout(args, features)
      const result = await renderAndGetResult(args, features, layoutRecords)

      expect(result.items).toMatchSnapshot()
      expect(result.subfeatureInfos).toMatchSnapshot()
    })
  })

  describe('canvas snapshots', () => {
    const snapshotRegion = {
      refName: 'ctgA',
      start: 0,
      end: 200,
      assemblyName: 'volvox',
    }

    test('simple box feature rendering', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 50,
        end: 150,
        name: 'SimpleFeature',
      })
      const features = new Map([['test1', feature]])
      const args = createRenderArgs(features, snapshotRegion)
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 50)

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
      const args = createRenderArgs(features, snapshotRegion)
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 100)

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })

    test('gene with transcript and CDS', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'gene1',
        refName: 'ctgA',
        type: 'gene',
        start: 10,
        end: 180,
        strand: 1,
        name: 'TestGene',
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
                uniqueId: 'utr1',
                refName: 'ctgA',
                type: 'five_prime_UTR',
                start: 10,
                end: 30,
                strand: 1,
              },
              {
                uniqueId: 'cds1',
                refName: 'ctgA',
                type: 'CDS',
                start: 30,
                end: 70,
                strand: 1,
                phase: 0,
              },
              {
                uniqueId: 'cds2',
                refName: 'ctgA',
                type: 'CDS',
                start: 100,
                end: 150,
                strand: 1,
                phase: 0,
              },
              {
                uniqueId: 'utr2',
                refName: 'ctgA',
                type: 'three_prime_UTR',
                start: 150,
                end: 180,
                strand: 1,
              },
            ],
          },
        ],
      })
      const features = new Map([['gene1', feature]])
      const args = createRenderArgs(features, snapshotRegion)
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 50)

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
      const args = createRenderArgs(features, snapshotRegion, {
        displayMode: 'compact',
      })
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 50)

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
      const args = createRenderArgs(features, snapshotRegion)
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 80)

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })

    test('longest transcript mode', async () => {
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
            end: 100,
            strand: 1,
            name: 'Short-Transcript',
            subfeatures: [
              {
                uniqueId: 'cds1',
                refName: 'ctgA',
                type: 'CDS',
                start: 20,
                end: 90,
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
            end: 180,
            strand: 1,
            name: 'Long-Transcript',
            subfeatures: [
              {
                uniqueId: 'cds2',
                refName: 'ctgA',
                type: 'CDS',
                start: 30,
                end: 170,
                strand: 1,
                phase: 0,
              },
            ],
          },
        ],
      })
      const features = new Map([['gene1', feature]])
      const args = createRenderArgs(features, snapshotRegion, {
        geneGlyphMode: 'longest',
      })
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 50)

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })

    test('reducedRepresentation mode with gene', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'gene1',
        refName: 'ctgA',
        type: 'gene',
        start: 20,
        end: 180,
        strand: 1,
        name: 'TestGene',
        subfeatures: [
          {
            uniqueId: 'mrna1',
            refName: 'ctgA',
            type: 'mRNA',
            start: 20,
            end: 180,
            strand: 1,
            subfeatures: [
              {
                uniqueId: 'cds1',
                refName: 'ctgA',
                type: 'CDS',
                start: 40,
                end: 160,
                strand: 1,
                phase: 0,
              },
            ],
          },
        ],
      })
      const features = new Map([['gene1', feature]])
      const args = createRenderArgs(features, snapshotRegion, {
        displayMode: 'reducedRepresentation',
      })
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 50)

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
      const args = createRenderArgs(features, snapshotRegion)
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 50)

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })
  })
})
