import PluginManager from '@jbrowse/core/PluginManager'
import { renderToAbstractCanvas } from '@jbrowse/core/util'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { Image, createCanvas } from 'canvas'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import MatureProteinRegionGlyph from './MatureProteinRegionGlyph'
import registerGlyphs from './index'
import configSchema from '../CanvasFeatureRenderer/configSchema'
import { layoutFeatures } from '../CanvasFeatureRenderer/layoutFeatures'
import { makeImageData } from '../CanvasFeatureRenderer/makeImageData'
import { createRenderConfigContext } from '../CanvasFeatureRenderer/renderConfig'

import type { FloatingLabelData } from '../CanvasFeatureRenderer/floatingLabels'

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
registerGlyphs(pluginManager)
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
    pluginManager,
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
    config: args.config,
    configContext: args.configContext,
    layout: args.layout,
    pluginManager: args.pluginManager,
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

describe('MatureProteinRegionGlyph', () => {
  describe('match function', () => {
    test('matches CDS with mature_protein_region_of_CDS subfeatures', () => {
      const feature = createSimpleCDSWithMatureRegions()
      expect(MatureProteinRegionGlyph.match!(feature)).toBe(true)
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
      expect(MatureProteinRegionGlyph.match!(feature)).toBe(true)
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
      expect(MatureProteinRegionGlyph.match!(feature)).toBe(false)
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
      expect(MatureProteinRegionGlyph.match!(feature)).toBe(false)
    })

    test('does not match CDS without subfeatures', () => {
      const feature = new SimpleFeature({
        uniqueId: 'cds-empty',
        refName: 'ctgA',
        type: 'CDS',
        start: 100,
        end: 300,
      })
      expect(MatureProteinRegionGlyph.match!(feature)).toBe(false)
    })
  })

  describe('getChildFeatures function', () => {
    test('returns only mature protein region subfeatures', () => {
      const feature = new SimpleFeature({
        uniqueId: 'cds-mixed',
        refName: 'ctgA',
        type: 'CDS',
        start: 100,
        end: 500,
        subfeatures: [
          {
            uniqueId: 'mature-1',
            refName: 'ctgA',
            type: 'mature_protein_region_of_CDS',
            start: 100,
            end: 200,
          },
          {
            uniqueId: 'exon-1',
            refName: 'ctgA',
            type: 'exon',
            start: 200,
            end: 300,
          },
          {
            uniqueId: 'mature-2',
            refName: 'ctgA',
            type: 'mature_protein_region',
            start: 300,
            end: 400,
          },
        ],
      })
      const config = configSchema.create({}, { pluginManager })
      const children = MatureProteinRegionGlyph.getChildFeatures!(
        feature,
        config,
      )
      expect(children).toHaveLength(2)
      expect(children[0]!.get('type')).toBe('mature_protein_region_of_CDS')
      expect(children[1]!.get('type')).toBe('mature_protein_region')
    })

    test('returns empty array for CDS without mature protein subfeatures', () => {
      const feature = new SimpleFeature({
        uniqueId: 'cds-no-mature',
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
      const config = configSchema.create({}, { pluginManager })
      const children = MatureProteinRegionGlyph.getChildFeatures!(
        feature,
        config,
      )
      expect(children).toHaveLength(0)
    })
  })

  describe('getHeightMultiplier function', () => {
    test('returns 1 for CDS without mature protein children', () => {
      const feature = new SimpleFeature({
        uniqueId: 'cds-empty',
        refName: 'ctgA',
        type: 'CDS',
        start: 100,
        end: 300,
      })
      const config = configSchema.create({}, { pluginManager })
      const multiplier = MatureProteinRegionGlyph.getHeightMultiplier!(
        feature,
        config,
      )
      expect(multiplier).toBe(1)
    })

    test('returns number of children for normal display', () => {
      const feature = createSimpleCDSWithMatureRegions()
      const config = configSchema.create({}, { pluginManager })
      const multiplier = MatureProteinRegionGlyph.getHeightMultiplier!(
        feature,
        config,
      )
      expect(multiplier).toBe(3)
    })

    test('returns double for below labels', () => {
      const feature = createSimpleCDSWithMatureRegions()
      const config = configSchema.create(
        { subfeatureLabels: 'below' },
        { pluginManager },
      )
      const multiplier = MatureProteinRegionGlyph.getHeightMultiplier!(
        feature,
        config,
      )
      expect(multiplier).toBe(6)
    })
  })

  describe('getSubfeatureMouseover function', () => {
    test('returns product and protein_id', () => {
      const feature = new SimpleFeature({
        uniqueId: 'mature-1',
        refName: 'ctgA',
        type: 'mature_protein_region_of_CDS',
        start: 100,
        end: 200,
        product: 'capsid protein 1A',
        protein_id: 'NP_740412.1',
      })
      const result = MatureProteinRegionGlyph.getSubfeatureMouseover!(feature)
      expect(result).toBe('capsid protein 1A (NP_740412.1)')
    })

    test('returns only product when no protein_id', () => {
      const feature = new SimpleFeature({
        uniqueId: 'mature-1',
        refName: 'ctgA',
        type: 'mature_protein_region_of_CDS',
        start: 100,
        end: 200,
        product: 'capsid protein',
      })
      const result = MatureProteinRegionGlyph.getSubfeatureMouseover!(feature)
      expect(result).toBe('capsid protein')
    })

    test('returns only protein_id when no product', () => {
      const feature = new SimpleFeature({
        uniqueId: 'mature-1',
        refName: 'ctgA',
        type: 'mature_protein_region_of_CDS',
        start: 100,
        end: 200,
        protein_id: 'NP_123456.1',
      })
      const result = MatureProteinRegionGlyph.getSubfeatureMouseover!(feature)
      expect(result).toBe('(NP_123456.1)')
    })

    test('returns undefined when no product or protein_id', () => {
      const feature = new SimpleFeature({
        uniqueId: 'mature-1',
        refName: 'ctgA',
        type: 'mature_protein_region_of_CDS',
        start: 100,
        end: 200,
      })
      const result = MatureProteinRegionGlyph.getSubfeatureMouseover!(feature)
      expect(result).toBeUndefined()
    })
  })

  describe('layout integration', () => {
    test('CDS with mature proteins gets correct height multiplier applied', () => {
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
      expect(cdsLayout.children).toHaveLength(5)
    })
  })

  describe('rendering integration', () => {
    test('creates subfeature info for mature protein regions', async () => {
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

      expect(result.subfeatureInfos.length).toBeGreaterThan(0)
      const matureRegionInfos = result.subfeatureInfos.filter(
        info => info.type === 'mature_protein_region_of_CDS',
      )
      expect(matureRegionInfos).toHaveLength(3)
    })

    test('mouseover text includes product and protein_id', async () => {
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

      const proteinAInfo = result.subfeatureInfos.find(info =>
        info.displayLabel.includes('protein A'),
      )
      expect(proteinAInfo).toBeDefined()
      expect(proteinAInfo!.displayLabel).toContain('PROT_A')
    })

    test('floating labels created for below mode', async () => {
      const feature = createSimpleCDSWithMatureRegions()
      const features = new Map([['cds-simple', feature]])
      const args = createRenderArgs(
        features,
        { ...defaultRegion, start: 0, end: 600 },
        { subfeatureLabels: 'below' },
      )
      const layoutRecords = doLayout(args, features)
      await renderAndGetResult(args, features, layoutRecords, 200)

      const layoutData = args.layout.getSerializableDataByID('mature-a')
      expect(layoutData).toBeDefined()
      expect(layoutData!.floatingLabels).toBeDefined()
      expect(layoutData!.floatingLabels!.length).toBeGreaterThan(0)
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
