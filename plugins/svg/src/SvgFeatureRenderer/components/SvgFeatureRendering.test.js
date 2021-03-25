import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import PrecomputedLayout from '@jbrowse/core/util/layouts/PrecomputedLayout'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import React from 'react'
import { render } from '@testing-library/react'
import SvgRendererConfigSchema from '../configSchema'
import Rendering from './SvgFeatureRendering'
import SvgOverlay from './SvgOverlay'

import '@testing-library/jest-dom/extend-expect'

test('no features', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 300 }]}
      layout={new PrecomputedLayout({ rectangles: {}, totalHeight: 20 })}
      config={{}}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})

test('one feature', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 1000 }]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([
          ['one', new SimpleFeature({ uniqueId: 'one', start: 1, end: 3 })],
        ])
      }
      config={SvgRendererConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})

test('one feature (compact mode)', () => {
  const config = SvgRendererConfigSchema.create({ displayMode: 'compact' })

  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 1000 }]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              type: 'mRNA',
              start: 5975,
              end: 9744,
              score: 0.84,
              strand: 1,
              name: 'au9.g1002.t1',
              uniqueId: 'one',
              subfeatures: [
                {
                  type: 'five_prime_UTR',
                  start: 5975,
                  end: 6109,
                  score: 0.98,
                  strand: 1,
                },
                {
                  type: 'start_codon',
                  start: 6110,
                  end: 6112,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 6110,
                  end: 6148,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 6615,
                  end: 6683,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 6758,
                  end: 7040,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 7142,
                  end: 7319,
                  score: 1,
                  strand: 1,
                  phase: 2,
                },
                {
                  type: 'CDS',
                  start: 7411,
                  end: 7687,
                  score: 1,
                  strand: 1,
                  phase: 1,
                },
                {
                  type: 'CDS',
                  start: 7748,
                  end: 7850,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 7953,
                  end: 8098,
                  score: 1,
                  strand: 1,
                  phase: 2,
                },
                {
                  type: 'CDS',
                  start: 8166,
                  end: 8320,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 8419,
                  end: 8614,
                  score: 1,
                  strand: 1,
                  phase: 1,
                },
                {
                  type: 'CDS',
                  start: 8708,
                  end: 8811,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 8927,
                  end: 9239,
                  score: 1,
                  strand: 1,
                  phase: 1,
                },
                {
                  type: 'CDS',
                  start: 9414,
                  end: 9494,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'stop_codon',
                  start: 9492,
                  end: 9494,
                  strand: 1,
                  phase: 0,
                },
                {
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
      }
      config={config}
      bpPerPx={3}
    />,
  )

  // reducedRepresentation of the transcript is just a box
  expect(container.firstChild).toMatchSnapshot()
})

test('processed transcript (reducedRepresentation mode)', () => {
  const config = SvgRendererConfigSchema.create({
    displayMode: 'reducedRepresentation',
  })
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 1000 }]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([
          ['one', new SimpleFeature({ uniqueId: 'one', start: 1, end: 3 })],
        ])
      }
      config={config}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})

test('processed transcript', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 1000 }]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              type: 'mRNA',
              start: 5975,
              end: 9744,
              score: 0.84,
              strand: 1,
              name: 'au9.g1002.t1',
              uniqueId: 'one',
              subfeatures: [
                {
                  type: 'five_prime_UTR',
                  start: 5975,
                  end: 6109,
                  score: 0.98,
                  strand: 1,
                },
                {
                  type: 'start_codon',
                  start: 6110,
                  end: 6112,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 6110,
                  end: 6148,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 6615,
                  end: 6683,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 6758,
                  end: 7040,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 7142,
                  end: 7319,
                  score: 1,
                  strand: 1,
                  phase: 2,
                },
                {
                  type: 'CDS',
                  start: 7411,
                  end: 7687,
                  score: 1,
                  strand: 1,
                  phase: 1,
                },
                {
                  type: 'CDS',
                  start: 7748,
                  end: 7850,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 7953,
                  end: 8098,
                  score: 1,
                  strand: 1,
                  phase: 2,
                },
                {
                  type: 'CDS',
                  start: 8166,
                  end: 8320,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 8419,
                  end: 8614,
                  score: 1,
                  strand: 1,
                  phase: 1,
                },
                {
                  type: 'CDS',
                  start: 8708,
                  end: 8811,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 8927,
                  end: 9239,
                  score: 1,
                  strand: 1,
                  phase: 1,
                },
                {
                  type: 'CDS',
                  start: 9414,
                  end: 9494,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'stop_codon',
                  start: 9492,
                  end: 9494,
                  strand: 1,
                  phase: 0,
                },
                {
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
      }
      config={SvgRendererConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})

test('processed transcript (exons + impliedUTR)', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 1000 }]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([
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
      }
      config={SvgRendererConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  // finds that the color3 is outputted for impliedUTRs
  expect(container).toContainHTML('#357089')

  expect(container.firstChild).toMatchSnapshot()
})

test('svg selected', () => {
  const blockLayoutFeatures = new Map()
  const layout = new Map()
  layout.set('one', [0, 0, 10, 10])
  blockLayoutFeatures.set('block1', layout)

  const { container } = render(
    <svg>
      <SvgOverlay
        width={500}
        height={500}
        blockKey="block1"
        region={{ refName: 'zonk', start: 0, end: 1000 }}
        displayModel={{
          blockLayoutFeatures,
          featureIdUnderMouse: 'one',
          selectedFeatureId: 'one',
        }}
        config={SvgRendererConfigSchema.create({})}
        bpPerPx={3}
      />
    </svg>,
  )

  expect(container.firstChild).toMatchSnapshot()
})
