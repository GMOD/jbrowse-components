import PluginManager from '@jbrowse/core/PluginManager'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import PrecomputedLayout from '@jbrowse/core/util/layouts/PrecomputedLayout'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { fireEvent, render } from '@testing-library/react'

import SvgRendererConfigSchema from '../configSchema'
import Rendering from './SvgFeatureRendering'
import SvgOverlay from './SvgOverlay'
import { computeLayouts, createRenderConfigContext } from './util'

import type { Feature } from '@jbrowse/core/util/simpleFeature'

import '@testing-library/jest-dom'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()
const theme = createJBrowseTheme()

function setupLayout({
  features,
  region,
  config,
  bpPerPx,
}: {
  features: Map<string, Feature>
  region: { refName: string; start: number; end: number; assemblyName: string }
  config: ReturnType<typeof SvgRendererConfigSchema.create>
  bpPerPx: number
}) {
  const layout = new GranularRectLayout({ pitchX: 1, pitchY: 1 })
  const configContext = createRenderConfigContext(config)
  computeLayouts({
    features,
    bpPerPx,
    region,
    config,
    configContext,
    layout,
  })
  return { layout, configContext }
}

test('no features', () => {
  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      features={new Map()}
      regions={[
        { refName: 'zonk', start: 0, end: 300, assemblyName: 'volvox' },
      ]}
      layout={
        new PrecomputedLayout({
          rectangles: {},
          totalHeight: 20,
          maxHeightReached: false,
        })
      }
      config={SvgRendererConfigSchema.create(undefined, { pluginManager })}
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('one feature', () => {
  const features = new Map([
    [
      'one',
      new SimpleFeature({
        refName: 'zonk',
        uniqueId: 'one',
        start: 1,
        end: 3,
      }),
    ],
  ])
  const region = {
    refName: 'zonk',
    start: 0,
    end: 1000,
    assemblyName: 'volvox',
  }
  const config = SvgRendererConfigSchema.create(undefined, { pluginManager })
  const bpPerPx = 3
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('click on one feature, and do not re-render', () => {
  let counter = 0
  const features = new Map([
    [
      'one',
      new SimpleFeature({
        refName: 'zonk',
        uniqueId: 'one',
        start: 1,
        end: 3,
      }),
    ],
    [
      'two',
      new SimpleFeature({
        refName: 'zonk',
        uniqueId: 'two',
        start: 1,
        end: 3,
      }),
    ],
    [
      'three',
      new SimpleFeature({
        refName: 'zonk',
        uniqueId: 'three',
        start: 1,
        end: 3,
      }),
    ],
  ])
  const region = {
    refName: 'zonk',
    start: 0,
    end: 1000,
    assemblyName: 'volvox',
  }
  const config = SvgRendererConfigSchema.create(undefined, { pluginManager })
  const bpPerPx = 3
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container, getByTestId } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
      detectRerender={() => counter++}
    />,
  )
  fireEvent.click(getByTestId('box-one'))
  expect(counter).toBe(3)

  expect(container).toMatchSnapshot()
})

test('one feature (compact mode)', () => {
  const config = SvgRendererConfigSchema.create(
    { displayMode: 'compact' },
    { pluginManager },
  )
  const features = new Map([
    [
      'one',
      new SimpleFeature({
        type: 'mRNA',
        refName: 'zonk',
        start: 5975,
        end: 9744,
        score: 0.84,
        strand: 1,
        name: 'au9.g1002.t1',
        uniqueId: 'one',
        subfeatures: [
          {
            refName: 'zonk',
            type: 'five_prime_UTR',
            start: 5975,
            end: 6109,
            score: 0.98,
            strand: 1,
          },
          {
            refName: 'zonk',
            type: 'start_codon',
            start: 6110,
            end: 6112,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 6110,
            end: 6148,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 6615,
            end: 6683,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 6758,
            end: 7040,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 7142,
            end: 7319,
            score: 1,
            strand: 1,
            phase: 2,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 7411,
            end: 7687,
            score: 1,
            strand: 1,
            phase: 1,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 7748,
            end: 7850,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 7953,
            end: 8098,
            score: 1,
            strand: 1,
            phase: 2,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 8166,
            end: 8320,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 8419,
            end: 8614,
            score: 1,
            strand: 1,
            phase: 1,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 8708,
            end: 8811,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 8927,
            end: 9239,
            score: 1,
            strand: 1,
            phase: 1,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 9414,
            end: 9494,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'stop_codon',
            start: 9492,
            end: 9494,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'three_prime_UTR',
            start: 9495,
            end: 9744,
            score: 0.86,
            strand: 1,
          },
        ],
      }),
    ],
  ])
  const region = {
    refName: 'zonk',
    start: 0,
    end: 1000,
    assemblyName: 'volvox',
  }
  const bpPerPx = 3
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  // reducedRepresentation of the transcript is just a box
  expect(container).toMatchSnapshot()
})

test('processed transcript (reducedRepresentation mode)', () => {
  const config = SvgRendererConfigSchema.create(
    { displayMode: 'reducedRepresentation' },
    { pluginManager },
  )
  const features = new Map([
    [
      'one',
      new SimpleFeature({
        refName: 'zonk',
        uniqueId: 'one',
        start: 1,
        end: 3,
      }),
    ],
  ])
  const region = {
    refName: 'zonk',
    start: 0,
    end: 1000,
    assemblyName: 'volvox',
  }
  const bpPerPx = 3
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('processed transcript', () => {
  const config = SvgRendererConfigSchema.create(undefined, { pluginManager })
  const features = new Map([
    [
      'one',
      new SimpleFeature({
        refName: 'zonk',
        type: 'mRNA',
        start: 5975,
        end: 9744,
        score: 0.84,
        strand: 1,
        name: 'au9.g1002.t1',
        uniqueId: 'one',
        subfeatures: [
          {
            refName: 'zonk',
            type: 'five_prime_UTR',
            start: 5975,
            end: 6109,
            score: 0.98,
            strand: 1,
          },
          {
            refName: 'zonk',
            type: 'start_codon',
            start: 6110,
            end: 6112,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 6110,
            end: 6148,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 6615,
            end: 6683,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 6758,
            end: 7040,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 7142,
            end: 7319,
            score: 1,
            strand: 1,
            phase: 2,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 7411,
            end: 7687,
            score: 1,
            strand: 1,
            phase: 1,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 7748,
            end: 7850,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 7953,
            end: 8098,
            score: 1,
            strand: 1,
            phase: 2,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 8166,
            end: 8320,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 8419,
            end: 8614,
            score: 1,
            strand: 1,
            phase: 1,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 8708,
            end: 8811,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 8927,
            end: 9239,
            score: 1,
            strand: 1,
            phase: 1,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 9414,
            end: 9494,
            score: 1,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'stop_codon',
            start: 9492,
            end: 9494,
            strand: 1,
            phase: 0,
          },
          {
            refName: 'zonk',
            type: 'three_prime_UTR',
            start: 9495,
            end: 9744,
            score: 0.86,
            strand: 1,
          },
        ],
      }),
    ],
  ])
  const region = {
    refName: 'zonk',
    start: 0,
    end: 1000,
    assemblyName: 'volvox',
  }
  const bpPerPx = 3
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('processed transcript (exons + impliedUTR)', () => {
  const config = SvgRendererConfigSchema.create(undefined, { pluginManager })
  const region = { refName: 'ctgA', start: 0, end: 300, assemblyName: 'volvox' }
  // Simplified test case with exons and CDS to test impliedUTR generation
  const features = new Map([
    [
      'gene1',
      new SimpleFeature({
        uniqueId: 'gene1',
        refName: 'ctgA',
        type: 'gene',
        start: 10,
        end: 200,
        strand: 1,
        name: 'TestGene',
        subfeatures: [
          {
            uniqueId: 'mrna1',
            refName: 'ctgA',
            type: 'mRNA',
            start: 10,
            end: 200,
            strand: 1,
            name: 'TestTranscript',
            subfeatures: [
              // Exons that define the full transcript extent
              {
                uniqueId: 'exon1',
                refName: 'ctgA',
                type: 'exon',
                start: 10,
                end: 50,
                strand: 1,
              },
              {
                uniqueId: 'exon2',
                refName: 'ctgA',
                type: 'exon',
                start: 80,
                end: 120,
                strand: 1,
              },
              {
                uniqueId: 'exon3',
                refName: 'ctgA',
                type: 'exon',
                start: 150,
                end: 200,
                strand: 1,
              },
              // CDS that doesn't cover full exon extent - should create implied UTRs
              {
                uniqueId: 'cds1',
                refName: 'ctgA',
                type: 'CDS',
                start: 30,
                end: 50,
                strand: 1,
                phase: 0,
              },
              {
                uniqueId: 'cds2',
                refName: 'ctgA',
                type: 'CDS',
                start: 80,
                end: 120,
                strand: 1,
                phase: 0,
              },
              {
                uniqueId: 'cds3',
                refName: 'ctgA',
                type: 'CDS',
                start: 150,
                end: 180,
                strand: 1,
                phase: 0,
              },
            ],
          },
        ],
      }),
    ],
  ])
  const bpPerPx = 1
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  expect(container).toMatchSnapshot()
})

test.skip('original processed transcript (exons + impliedUTR) - complex case', () => {
  const config = SvgRendererConfigSchema.create(undefined, { pluginManager })
  // Feature spans start: 23279535, end: 23299359, refName: NC_000001.10
  const region = {
    refName: 'NC_000001.10',
    start: 23279000,
    end: 23300000,
    assemblyName: 'volvox',
  }
  const features = new Map([
    [
      'one',

      // from LACTBL1 http://localhost:3000/?config=test_data%2Fconfig_demo.json&session=share-ka-YgPvBsB&password=syjLw
      new SimpleFeature({
        source: 'BestRefSeq',
        type: 'gene',
        start: 23279535,
        end: 23299359,
        strand: -1,
        phase: 0,
        refName: 'NC_000001.10',
        id: 'gene407',
        dbxref: ['GeneID:646262', 'HGNC:HGNC:35445'],
        name: 'LACTBL1',
        description: 'lactamase beta like 1',
        gbkey: 'Gene',
        gene: 'LACTBL1',
        gene_biotype: 'protein_coding',
        subfeatures: [
          {
            source: 'BestRefSeq',
            type: 'mRNA',
            start: 23279535,
            end: 23299359,
            strand: -1,
            phase: 0,
            refName: 'NC_000001.10',
            id: 'mRNA779',
            parent: 'gene407',
            dbxref: [
              'GeneID:646262',
              'Genbank:NM_001289974.2',
              'HGNC:HGNC:35445',
            ],
            name: 'NM_001289974.2',
            gbkey: 'mRNA',
            gene: 'LACTBL1',
            product: 'lactamase beta like 1',
            tag: 'RefSeq Select',
            transcript_id: 'NM_001289974.2',
            subfeatures: [
              {
                source: 'BestRefSeq',
                type: 'exon',
                start: 23279535,
                end: 23280517,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NM_001289974.2',
                  'HGNC:HGNC:35445',
                ],
                gbkey: 'mRNA',
                gene: 'LACTBL1',
                product: 'lactamase beta like 1',
                tag: 'RefSeq Select',
                transcript_id: 'NM_001289974.2',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-0',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23279535,
                end: 23280517,
                strand: -1,
                phase: 1,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-1',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23281813,
                end: 23281919,
                strand: -1,
                phase: 2,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-2',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23285177,
                end: 23285413,
                strand: -1,
                phase: 1,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-3',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23286434,
                end: 23286592,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-4',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23289599,
                end: 23289709,
                strand: -1,
                phase: 2,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-5',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23291782,
                end: 23291918,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-6',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23298797,
                end: 23298809,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-7',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23279535,
                end: 23280517,
                strand: -1,
                phase: 1,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-8',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23281813,
                end: 23281919,
                strand: -1,
                phase: 2,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-9',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23285177,
                end: 23285413,
                strand: -1,
                phase: 1,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-10',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23286434,
                end: 23286592,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-11',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23289599,
                end: 23289709,
                strand: -1,
                phase: 2,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-12',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23291782,
                end: 23291918,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-13',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'CDS',
                start: 23298797,
                end: 23298809,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                id: 'CDS763',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NP_001276903.1',
                  'HGNC:HGNC:35445',
                ],
                name: 'NP_001276903.1',
                gbkey: 'CDS',
                gene: 'LACTBL1',
                product: 'putative beta-lactamase-like 1',
                protein_id: 'NP_001276903.1',
                tag: 'RefSeq Select',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-14',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'exon',
                start: 23281813,
                end: 23281919,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NM_001289974.2',
                  'HGNC:HGNC:35445',
                ],
                gbkey: 'mRNA',
                gene: 'LACTBL1',
                product: 'lactamase beta like 1',
                tag: 'RefSeq Select',
                transcript_id: 'NM_001289974.2',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-15',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'exon',
                start: 23285177,
                end: 23285413,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NM_001289974.2',
                  'HGNC:HGNC:35445',
                ],
                gbkey: 'mRNA',
                gene: 'LACTBL1',
                product: 'lactamase beta like 1',
                tag: 'RefSeq Select',
                transcript_id: 'NM_001289974.2',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-16',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'exon',
                start: 23286434,
                end: 23286592,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NM_001289974.2',
                  'HGNC:HGNC:35445',
                ],
                gbkey: 'mRNA',
                gene: 'LACTBL1',
                product: 'lactamase beta like 1',
                tag: 'RefSeq Select',
                transcript_id: 'NM_001289974.2',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-17',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'exon',
                start: 23289599,
                end: 23289709,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NM_001289974.2',
                  'HGNC:HGNC:35445',
                ],
                gbkey: 'mRNA',
                gene: 'LACTBL1',
                product: 'lactamase beta like 1',
                tag: 'RefSeq Select',
                transcript_id: 'NM_001289974.2',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-18',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'exon',
                start: 23291782,
                end: 23291918,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NM_001289974.2',
                  'HGNC:HGNC:35445',
                ],
                gbkey: 'mRNA',
                gene: 'LACTBL1',
                product: 'lactamase beta like 1',
                tag: 'RefSeq Select',
                transcript_id: 'NM_001289974.2',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-19',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'exon',
                start: 23298797,
                end: 23298924,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NM_001289974.2',
                  'HGNC:HGNC:35445',
                ],
                gbkey: 'mRNA',
                gene: 'LACTBL1',
                product: 'lactamase beta like 1',
                tag: 'RefSeq Select',
                transcript_id: 'NM_001289974.2',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-20',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
              {
                source: 'BestRefSeq',
                type: 'exon',
                start: 23299264,
                end: 23299359,
                strand: -1,
                phase: 0,
                refName: 'NC_000001.10',
                parent: 'mRNA779',
                dbxref: [
                  'GeneID:646262',
                  'Genbank:NM_001289974.2',
                  'HGNC:HGNC:35445',
                ],
                gbkey: 'mRNA',
                gene: 'LACTBL1',
                product: 'lactamase beta like 1',
                tag: 'RefSeq Select',
                transcript_id: 'NM_001289974.2',
                uniqueId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-21',
                parentId:
                  'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
              },
            ],
            uniqueId:
              'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
            parentId:
              'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116',
          },
        ],
        uniqueId:
          'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116',
      }),
    ],
  ])
  const bpPerPx = 3
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  // finds that the color3 is outputted for impliedUTRs
  expect(container).toContainHTML('#357089')

  expect(container).toMatchSnapshot()
})

// hacks existence of getFeatureByID
test('svg selected', () => {
  const { container } = render(
    <svg>
      <SvgOverlay
        blockKey="block1"
        region={{
          refName: 'zonk',
          start: 0,
          end: 1000,
          assemblyName: 'volvox',
        }}
        displayModel={{
          getFeatureByID: () => [0, 0, 10, 10],
          featureIdUnderMouse: 'one',
          selectedFeatureId: 'one',
        }}
        bpPerPx={3}
      />
    </svg>,
  )

  expect(container).toMatchSnapshot()
})

test('gene with CDS children', () => {
  const config = SvgRendererConfigSchema.create(undefined, { pluginManager })
  const features = new Map([
    [
      'one',
      new SimpleFeature({
        refName: 'zonk',
        type: 'gene',
        start: 5975,
        end: 9744,
        strand: 1,
        uniqueId: 'one',
        subfeatures: [
          {
            refName: 'zonk',
            type: 'CDS',
            start: 6110,
            end: 6148,
            strand: 1,
          },
          {
            refName: 'zonk',
            type: 'CDS',
            start: 6615,
            end: 6683,
            strand: 1,
          },
        ],
      }),
    ],
  ])
  const region = {
    refName: 'zonk',
    start: 0,
    end: 1000,
    assemblyName: 'volvox',
  }
  const bpPerPx = 3
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('gene with multiple transcripts', () => {
  const config = SvgRendererConfigSchema.create(undefined, { pluginManager })
  const features = new Map([
    [
      'gene1',
      new SimpleFeature({
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
      }),
    ],
  ])
  const region = { refName: 'ctgA', start: 0, end: 200, assemblyName: 'volvox' }
  const bpPerPx = 1
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('gene with transcript and UTRs', () => {
  const config = SvgRendererConfigSchema.create(undefined, { pluginManager })
  const features = new Map([
    [
      'gene1',
      new SimpleFeature({
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
      }),
    ],
  ])
  const region = { refName: 'ctgA', start: 0, end: 200, assemblyName: 'volvox' }
  const bpPerPx = 1
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('forward and reverse strand genes', () => {
  const config = SvgRendererConfigSchema.create(undefined, { pluginManager })
  const features = new Map([
    [
      'gene1',
      new SimpleFeature({
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
      }),
    ],
    [
      'gene2',
      new SimpleFeature({
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
      }),
    ],
  ])
  const region = { refName: 'ctgA', start: 0, end: 200, assemblyName: 'volvox' }
  const bpPerPx = 1
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('multiple overlapping features get stacked', () => {
  const config = SvgRendererConfigSchema.create(undefined, { pluginManager })
  const features = new Map([
    [
      'test1',
      new SimpleFeature({
        uniqueId: 'test1',
        refName: 'ctgA',
        start: 20,
        end: 80,
        name: 'Feature1',
      }),
    ],
    [
      'test2',
      new SimpleFeature({
        uniqueId: 'test2',
        refName: 'ctgA',
        start: 60,
        end: 120,
        name: 'Feature2',
      }),
    ],
    [
      'test3',
      new SimpleFeature({
        uniqueId: 'test3',
        refName: 'ctgA',
        start: 100,
        end: 180,
        name: 'Feature3',
      }),
    ],
  ])
  const region = { refName: 'ctgA', start: 0, end: 200, assemblyName: 'volvox' }
  const bpPerPx = 1
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('longest transcript mode', () => {
  const config = SvgRendererConfigSchema.create(
    { geneGlyphMode: 'longest' },
    { pluginManager },
  )
  const features = new Map([
    [
      'gene1',
      new SimpleFeature({
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
      }),
    ],
  ])
  const region = { refName: 'ctgA', start: 0, end: 200, assemblyName: 'volvox' }
  const bpPerPx = 1
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('segments feature (no CDS)', () => {
  const config = SvgRendererConfigSchema.create(undefined, { pluginManager })
  const features = new Map([
    [
      'gene1',
      new SimpleFeature({
        uniqueId: 'gene1',
        refName: 'ctgA',
        type: 'gene',
        start: 10,
        end: 180,
        strand: 1,
        name: 'NonCodingGene',
        subfeatures: [
          {
            uniqueId: 'ncrna1',
            refName: 'ctgA',
            type: 'ncRNA',
            start: 10,
            end: 180,
            strand: 1,
            name: 'NonCoding-Transcript',
            subfeatures: [
              {
                uniqueId: 'exon1',
                refName: 'ctgA',
                type: 'exon',
                start: 10,
                end: 60,
                strand: 1,
              },
              {
                uniqueId: 'exon2',
                refName: 'ctgA',
                type: 'exon',
                start: 100,
                end: 180,
                strand: 1,
              },
            ],
          },
        ],
      }),
    ],
  ])
  const region = { refName: 'ctgA', start: 0, end: 200, assemblyName: 'volvox' }
  const bpPerPx = 1
  const { layout, configContext } = setupLayout({
    features,
    region,
    config,
    bpPerPx,
  })

  const { container } = render(
    <Rendering
      theme={theme}
      blockKey="hello"
      colorByCDS={false}
      regions={[region]}
      layout={layout}
      features={features}
      config={config}
      configContext={configContext}
      bpPerPx={bpPerPx}
    />,
  )

  expect(container).toMatchSnapshot()
})
