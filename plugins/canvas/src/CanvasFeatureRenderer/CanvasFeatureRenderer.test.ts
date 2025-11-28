import { renderToAbstractCanvas } from '@jbrowse/core/util'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { Image, createCanvas } from 'canvas'

import { computeLayouts } from './computeLayouts'
import configSchema from './configSchema'
import { makeImageData } from './makeImageData'

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

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

  return {
    features,
    bpPerPx,
    region: { ...region, reversed: false },
    config,
    layout,
    displayMode: 'normal',
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
          }),
      )

      expect(result.items).toMatchSnapshot()
      expect(result.subfeatureInfos).toMatchSnapshot()
    })
  })
})
