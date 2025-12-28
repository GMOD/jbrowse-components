import PluginManager from '@jbrowse/core/PluginManager'
import { renderToAbstractCanvas } from '@jbrowse/core/util'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { Image, createCanvas } from 'canvas'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import { matureProteinRegionGlyph } from './matureProteinRegion'
import configSchema from '../configSchema'
import { layoutFeatures } from '../layoutFeatures'
import { makeImageData } from '../makeImageData'
import { createRenderConfigContext } from '../renderConfig'

import type { FloatingLabelData } from '../floatingLabels'

interface LayoutSerializableData {
  refName?: string
  floatingLabels?: FloatingLabelData[]
  totalFeatureHeight?: number
  totalLayoutWidth?: number
  actualTopPx?: number
  featureWidth?: number
  leftPadding?: number
}

const pluginManager = new PluginManager([])
pluginManager.createPluggableElements()
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
    text: { primary: '#000', secondary: '#666' },
    framesCDS: [{ main: '#00f' }, { main: '#0f0' }, { main: '#f00' }],
    grey: { 300: '#e0e0e0', 500: '#9e9e9e' },
  },
}

const defaultRegion = {
  refName: 'NC_001430.1',
  start: 0,
  end: 8000,
  assemblyName: 'enterovirus',
}

function createRenderArgs(
  features: Map<string, SimpleFeature>,
  region = defaultRegion,
  configOverrides: Record<string, unknown> = {},
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
    region: { ...region, reversed: false },
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
    pluginManager,
    features,
    bpPerPx: args.bpPerPx,
    region: args.region,
    configContext: args.configContext,
    layout: args.layout,
  })
}

async function renderAndGetResult(
  args: ReturnType<typeof createRenderArgs>,
  features: Map<string, SimpleFeature>,
  layoutRecords: ReturnType<typeof layoutFeatures>,
  height = 200,
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
  const width = Math.min(args.region.end - args.region.start, 1000)
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

function createViralPolyproteinFeature() {
  return new SimpleFeature({
    uniqueId: 'gene-HEVDgp1',
    refName: 'NC_001430.1',
    type: 'gene',
    start: 726,
    end: 7311,
    strand: 1,
    name: 'HEVDgp1',
    subfeatures: [
      {
        uniqueId: 'cds-NP_040760.1',
        refName: 'NC_001430.1',
        type: 'CDS',
        start: 726,
        end: 7311,
        strand: 1,
        phase: 0,
        name: 'NP_040760.1',
        product: 'genome polyprotein',
        subfeatures: [
          {
            uniqueId: 'mature-vp0',
            refName: 'NC_001430.1',
            type: 'mature_protein_region_of_CDS',
            start: 726,
            end: 1683,
            strand: 1,
            product: 'protein VP0',
            protein_id: 'YP_009020592.1',
          },
          {
            uniqueId: 'mature-1a',
            refName: 'NC_001430.1',
            type: 'mature_protein_region_of_CDS',
            start: 726,
            end: 933,
            strand: 1,
            product: 'capsid protein 1A',
            protein_id: 'NP_740412.1',
          },
          {
            uniqueId: 'mature-1b',
            refName: 'NC_001430.1',
            type: 'mature_protein_region_of_CDS',
            start: 933,
            end: 1683,
            strand: 1,
            product: 'capsid protein 1B',
            protein_id: 'NP_740413.1',
          },
          {
            uniqueId: 'mature-1c',
            refName: 'NC_001430.1',
            type: 'mature_protein_region_of_CDS',
            start: 1683,
            end: 2409,
            strand: 1,
            product: 'capsid protein 1C',
            protein_id: 'NP_740739.1',
          },
          {
            uniqueId: 'mature-1d',
            refName: 'NC_001430.1',
            type: 'mature_protein_region_of_CDS',
            start: 2409,
            end: 3339,
            strand: 1,
            product: 'capsid protein 1D',
            protein_id: 'NP_740742.1',
          },
        ],
      },
    ],
  })
}

function createSimpleCDSWithMatureRegions() {
  return new SimpleFeature({
    uniqueId: 'cds-simple',
    refName: 'NC_001430.1',
    type: 'CDS',
    start: 100,
    end: 500,
    strand: 1,
    phase: 0,
    name: 'SimplePolyprotein',
    subfeatures: [
      {
        uniqueId: 'mature-a',
        refName: 'NC_001430.1',
        type: 'mature_protein_region_of_CDS',
        start: 100,
        end: 250,
        strand: 1,
        product: 'protein A',
        protein_id: 'PROT_A',
      },
      {
        uniqueId: 'mature-b',
        refName: 'NC_001430.1',
        type: 'mature_protein_region_of_CDS',
        start: 250,
        end: 400,
        strand: 1,
        product: 'protein B',
        protein_id: 'PROT_B',
      },
      {
        uniqueId: 'mature-c',
        refName: 'NC_001430.1',
        type: 'mature_protein_region_of_CDS',
        start: 400,
        end: 500,
        strand: 1,
        product: 'protein C',
        protein_id: 'PROT_C',
      },
    ],
  })
}

describe('matureProteinRegionGlyph', () => {
  describe('match function', () => {
    const configContext = createRenderConfigContext(
      configSchema.create({}, { pluginManager }),
    )

    test('matches CDS with mature_protein_region_of_CDS subfeatures', () => {
      const feature = createSimpleCDSWithMatureRegions()
      expect(matureProteinRegionGlyph.match(feature, configContext)).toBe(true)
    })

    test('matches CDS with mature_protein_region subfeatures', () => {
      const feature = new SimpleFeature({
        uniqueId: 'cds-alt',
        refName: 'ctgA',
        type: 'CDS',
        start: 100,
        end: 300,
        subfeatures: [
          {
            uniqueId: 'mature-1',
            refName: 'ctgA',
            type: 'mature_protein_region',
            start: 100,
            end: 200,
          },
        ],
      })
      expect(matureProteinRegionGlyph.match(feature, configContext)).toBe(true)
    })

    test('does not match CDS without mature protein subfeatures', () => {
      const feature = new SimpleFeature({
        uniqueId: 'cds-normal',
        refName: 'ctgA',
        type: 'CDS',
        start: 100,
        end: 300,
        subfeatures: [
          {
            uniqueId: 'exon-1',
            refName: 'ctgA',
            type: 'exon',
            start: 100,
            end: 300,
          },
        ],
      })
      expect(matureProteinRegionGlyph.match(feature, configContext)).toBe(false)
    })

    test('does not match non-CDS features', () => {
      const feature = new SimpleFeature({
        uniqueId: 'gene-1',
        refName: 'ctgA',
        type: 'gene',
        start: 100,
        end: 300,
        subfeatures: [
          {
            uniqueId: 'mature-1',
            refName: 'ctgA',
            type: 'mature_protein_region_of_CDS',
            start: 100,
            end: 200,
          },
        ],
      })
      expect(matureProteinRegionGlyph.match(feature, configContext)).toBe(false)
    })

    test('does not match CDS without subfeatures', () => {
      const feature = new SimpleFeature({
        uniqueId: 'cds-empty',
        refName: 'ctgA',
        type: 'CDS',
        start: 100,
        end: 300,
      })
      expect(matureProteinRegionGlyph.match(feature, configContext)).toBe(false)
    })
  })

  describe('layout function', () => {
    test('creates layout with children for each mature protein region', () => {
      const feature = createSimpleCDSWithMatureRegions()
      const configContext = createRenderConfigContext(
        configSchema.create({}, { pluginManager }),
      )

      const layout = matureProteinRegionGlyph.layout({
        feature,
        bpPerPx: 1,
        reversed: false,
        configContext,
      })

      expect(layout.glyphType).toBe('MatureProteinRegion')
      expect(layout.children).toHaveLength(3)
    })

    test('height scales with number of children', () => {
      const feature = createSimpleCDSWithMatureRegions()
      const configContext = createRenderConfigContext(
        configSchema.create({}, { pluginManager }),
      )

      const layout = matureProteinRegionGlyph.layout({
        feature,
        bpPerPx: 1,
        reversed: false,
        configContext,
      })

      // 3 children * base height
      expect(layout.height).toBeGreaterThan(0)
      expect(layout.totalLayoutHeight).toBe(layout.height)
    })

    test('height doubles with below labels', () => {
      const feature = createSimpleCDSWithMatureRegions()
      const configContext = createRenderConfigContext(
        configSchema.create({ subfeatureLabels: 'below' }, { pluginManager }),
      )

      const layoutBelow = matureProteinRegionGlyph.layout({
        feature,
        bpPerPx: 1,
        reversed: false,
        configContext,
      })

      const configContextNormal = createRenderConfigContext(
        configSchema.create({}, { pluginManager }),
      )
      const layoutNormal = matureProteinRegionGlyph.layout({
        feature,
        bpPerPx: 1,
        reversed: false,
        configContext: configContextNormal,
      })

      expect(layoutBelow.height).toBe(layoutNormal.height * 2)
    })
  })

  describe('layout integration', () => {
    test('CDS with mature proteins gets correct layout', () => {
      const feature = createSimpleCDSWithMatureRegions()
      const features = new Map([['cds-simple', feature]])
      const args = createRenderArgs(features, {
        ...defaultRegion,
        start: 0,
        end: 600,
      })
      const layoutRecords = doLayout(args, features)

      expect(layoutRecords).toHaveLength(1)
      const layout = layoutRecords[0]!.layout
      expect(layout.glyphType).toBe('MatureProteinRegion')
      expect(layout.children).toHaveLength(3)
    })

    test('gene containing CDS with mature proteins lays out correctly', () => {
      const feature = createViralPolyproteinFeature()
      const features = new Map([['gene-HEVDgp1', feature]])
      const args = createRenderArgs(features)
      const layoutRecords = doLayout(args, features)

      expect(layoutRecords).toHaveLength(1)
      const geneLayout = layoutRecords[0]!.layout
      expect(geneLayout.glyphType).toBe('Subfeatures')
      expect(geneLayout.children).toHaveLength(1)

      const cdsLayout = geneLayout.children[0]!
      expect(cdsLayout.glyphType).toBe('MatureProteinRegion')
      expect(cdsLayout.children).toHaveLength(5)
    })
  })

  describe('rendering integration', () => {
    test('renders without errors', async () => {
      const feature = createSimpleCDSWithMatureRegions()
      const features = new Map([['cds-simple', feature]])
      const args = createRenderArgs(features, {
        ...defaultRegion,
        start: 0,
        end: 600,
      })
      const layoutRecords = doLayout(args, features)
      const result = await renderAndGetResult(
        args,
        features,
        layoutRecords,
        100,
      )

      expect(result.items.length).toBeGreaterThan(0)
    })
  })

  describe('canvas snapshots', () => {
    const snapshotRegion = {
      refName: 'NC_001430.1',
      start: 0,
      end: 600,
      assemblyName: 'enterovirus',
    }

    test('simple CDS with three mature protein regions', async () => {
      const feature = createSimpleCDSWithMatureRegions()
      const features = new Map([['cds-simple', feature]])
      const args = createRenderArgs(features, snapshotRegion)
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 100)

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })

    test('CDS with mature proteins and below labels', async () => {
      const feature = createSimpleCDSWithMatureRegions()
      const features = new Map([['cds-simple', feature]])
      const args = createRenderArgs(features, snapshotRegion, {
        subfeatureLabels: 'below',
      })
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 200)

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })

    test('CDS with mature proteins and overlay labels', async () => {
      const feature = createSimpleCDSWithMatureRegions()
      const features = new Map([['cds-simple', feature]])
      const args = createRenderArgs(features, snapshotRegion, {
        subfeatureLabels: 'overlay',
      })
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 100)

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })

    test('gene containing CDS with mature protein regions', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'gene-1',
        refName: 'NC_001430.1',
        type: 'gene',
        start: 50,
        end: 550,
        strand: 1,
        name: 'TestGene',
        subfeatures: [
          {
            uniqueId: 'cds-1',
            refName: 'NC_001430.1',
            type: 'CDS',
            start: 50,
            end: 550,
            strand: 1,
            phase: 0,
            name: 'Polyprotein',
            subfeatures: [
              {
                uniqueId: 'mature-x',
                refName: 'NC_001430.1',
                type: 'mature_protein_region_of_CDS',
                start: 50,
                end: 200,
                strand: 1,
                product: 'protein X',
              },
              {
                uniqueId: 'mature-y',
                refName: 'NC_001430.1',
                type: 'mature_protein_region_of_CDS',
                start: 200,
                end: 400,
                strand: 1,
                product: 'protein Y',
              },
              {
                uniqueId: 'mature-z',
                refName: 'NC_001430.1',
                type: 'mature_protein_region_of_CDS',
                start: 400,
                end: 550,
                strand: 1,
                product: 'protein Z',
              },
            ],
          },
        ],
      })
      const features = new Map([['gene-1', feature]])
      const args = createRenderArgs(features, snapshotRegion)
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 120)

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })

    test('reverse strand CDS with mature proteins', async () => {
      const feature = new SimpleFeature({
        uniqueId: 'cds-reverse',
        refName: 'NC_001430.1',
        type: 'CDS',
        start: 100,
        end: 500,
        strand: -1,
        phase: 0,
        subfeatures: [
          {
            uniqueId: 'mature-r1',
            refName: 'NC_001430.1',
            type: 'mature_protein_region_of_CDS',
            start: 100,
            end: 300,
            strand: -1,
            product: 'reverse protein 1',
          },
          {
            uniqueId: 'mature-r2',
            refName: 'NC_001430.1',
            type: 'mature_protein_region_of_CDS',
            start: 300,
            end: 500,
            strand: -1,
            product: 'reverse protein 2',
          },
        ],
      })
      const features = new Map([['cds-reverse', feature]])
      const args = createRenderArgs(features, snapshotRegion)
      const layoutRecords = doLayout(args, features)
      const canvas = renderToCanvas(args, features, layoutRecords, 80)

      expect(canvasToBuffer(canvas)).toMatchImageSnapshot()
    })
  })
})
