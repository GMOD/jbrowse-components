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

            // from BCL10 http://localhost:3001/?config=test_data%2Fconfig_demo.json&session=share-stBb1dYlIN&password=rwNsf
            new SimpleFeature({
              source: 'BestRefSeq',
              type: 'gene',
              start: 85731458,
              end: 85742315,
              strand: -1,
              phase: 0,
              refName: 'NC_000001.10',
              id: 'gene1109',
              dbxref: ['GeneID:8915', 'HGNC:HGNC:989', 'MIM:603517'],
              name: 'BCL10',
              description: 'BCL10 immune signaling adaptor',
              gbkey: 'Gene',
              gene: 'BCL10',
              gene_biotype: 'protein_coding',
              gene_synonym: [
                'c-E10',
                'CARMEN',
                'CIPER',
                'CLAP',
                'IMD37',
                'mE10',
              ],
              subfeatures: [
                {
                  source: 'BestRefSeq',
                  type: 'mRNA',
                  start: 85731458,
                  end: 85742315,
                  strand: -1,
                  phase: 0,
                  refName: 'NC_000001.10',
                  id: 'mRNA2437',
                  parent: 'gene1109',
                  dbxref: [
                    'GeneID:8915',
                    'Genbank:NM_003921.5',
                    'HGNC:HGNC:989',
                    'MIM:603517',
                  ],
                  name: 'NM_003921.5',
                  gbkey: 'mRNA',
                  gene: 'BCL10',
                  product:
                    'BCL10 immune signaling adaptor, transcript variant 1',
                  tag: 'RefSeq Select',
                  transcript_id: 'NM_003921.5',
                  subfeatures: [
                    {
                      start: 85731458,
                      end: 85733309,
                      strand: -1,
                      type: 'three_prime_UTR',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0_three_prime_UTR_0',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0',
                    },
                    {
                      source: 'BestRefSeq',
                      type: 'exon',
                      start: 85731458,
                      end: 85733665,
                      strand: -1,
                      phase: 0,
                      refName: 'NC_000001.10',
                      parent: 'mRNA2437',
                      dbxref: [
                        'GeneID:8915',
                        'Genbank:NM_003921.5',
                        'HGNC:HGNC:989',
                        'MIM:603517',
                      ],
                      gbkey: 'mRNA',
                      gene: 'BCL10',
                      product:
                        'BCL10 immune signaling adaptor, transcript variant 1',
                      tag: 'RefSeq Select',
                      transcript_id: 'NM_003921.5',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0-0',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0',
                    },
                    {
                      source: 'BestRefSeq',
                      type: 'CDS',
                      start: 85733309,
                      end: 85733665,
                      strand: -1,
                      phase: 2,
                      refName: 'NC_000001.10',
                      id: 'CDS2350',
                      parent: 'mRNA2437',
                      dbxref: [
                        'CCDS:CCDS704.1',
                        'GeneID:8915',
                        'Genbank:NP_003912.1',
                        'HGNC:HGNC:989',
                        'MIM:603517',
                      ],
                      name: 'NP_003912.1',
                      note: 'isoform 1 is encoded by transcript variant 1',
                      gbkey: 'CDS',
                      gene: 'BCL10',
                      product: 'B-cell lymphoma/leukemia 10 isoform 1',
                      protein_id: 'NP_003912.1',
                      tag: 'RefSeq Select',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0-1',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0',
                    },
                    {
                      source: 'BestRefSeq',
                      type: 'CDS',
                      start: 85736300,
                      end: 85736589,
                      strand: -1,
                      phase: 0,
                      refName: 'NC_000001.10',
                      id: 'CDS2350',
                      parent: 'mRNA2437',
                      dbxref: [
                        'CCDS:CCDS704.1',
                        'GeneID:8915',
                        'Genbank:NP_003912.1',
                        'HGNC:HGNC:989',
                        'MIM:603517',
                      ],
                      name: 'NP_003912.1',
                      note: 'isoform 1 is encoded by transcript variant 1',
                      gbkey: 'CDS',
                      gene: 'BCL10',
                      product: 'B-cell lymphoma/leukemia 10 isoform 1',
                      protein_id: 'NP_003912.1',
                      tag: 'RefSeq Select',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0-2',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0',
                    },
                    {
                      source: 'BestRefSeq',
                      type: 'CDS',
                      start: 85741978,
                      end: 85742035,
                      strand: -1,
                      phase: 0,
                      refName: 'NC_000001.10',
                      id: 'CDS2350',
                      parent: 'mRNA2437',
                      dbxref: [
                        'CCDS:CCDS704.1',
                        'GeneID:8915',
                        'Genbank:NP_003912.1',
                        'HGNC:HGNC:989',
                        'MIM:603517',
                      ],
                      name: 'NP_003912.1',
                      note: 'isoform 1 is encoded by transcript variant 1',
                      gbkey: 'CDS',
                      gene: 'BCL10',
                      product: 'B-cell lymphoma/leukemia 10 isoform 1',
                      protein_id: 'NP_003912.1',
                      tag: 'RefSeq Select',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0-3',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0',
                    },
                    {
                      source: 'BestRefSeq',
                      type: 'exon',
                      start: 85736300,
                      end: 85736589,
                      strand: -1,
                      phase: 0,
                      refName: 'NC_000001.10',
                      parent: 'mRNA2437',
                      dbxref: [
                        'GeneID:8915',
                        'Genbank:NM_003921.5',
                        'HGNC:HGNC:989',
                        'MIM:603517',
                      ],
                      gbkey: 'mRNA',
                      gene: 'BCL10',
                      product:
                        'BCL10 immune signaling adaptor, transcript variant 1',
                      tag: 'RefSeq Select',
                      transcript_id: 'NM_003921.5',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0-4',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0',
                    },
                    {
                      source: 'BestRefSeq',
                      type: 'exon',
                      start: 85741978,
                      end: 85742315,
                      strand: -1,
                      phase: 0,
                      refName: 'NC_000001.10',
                      parent: 'mRNA2437',
                      dbxref: [
                        'GeneID:8915',
                        'Genbank:NM_003921.5',
                        'HGNC:HGNC:989',
                        'MIM:603517',
                      ],
                      gbkey: 'mRNA',
                      gene: 'BCL10',
                      product:
                        'BCL10 immune signaling adaptor, transcript variant 1',
                      tag: 'RefSeq Select',
                      transcript_id: 'NM_003921.5',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0-5',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0',
                    },
                    {
                      start: 85742035,
                      end: 85742315,
                      strand: -1,
                      type: 'five_prime_UTR',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0_five_prime_UTR_2',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0',
                    },
                  ],
                  uniqueId:
                    'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-0',
                  parentId:
                    'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480',
                },
                {
                  source: 'BestRefSeq',
                  type: 'mRNA',
                  start: 85731458,
                  end: 85742315,
                  strand: -1,
                  phase: 0,
                  refName: 'NC_000001.10',
                  id: 'mRNA2436',
                  parent: 'gene1109',
                  dbxref: [
                    'GeneID:8915',
                    'Genbank:NM_001320715.2',
                    'HGNC:HGNC:989',
                    'MIM:603517',
                  ],
                  name: 'NM_001320715.2',
                  gbkey: 'mRNA',
                  gene: 'BCL10',
                  product:
                    'BCL10 immune signaling adaptor, transcript variant 2',
                  transcript_id: 'NM_001320715.2',
                  subfeatures: [
                    {
                      start: 85731458,
                      end: 85733309,
                      strand: -1,
                      type: 'three_prime_UTR',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1_three_prime_UTR_0',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1',
                    },
                    {
                      source: 'BestRefSeq',
                      type: 'exon',
                      start: 85731458,
                      end: 85733632,
                      strand: -1,
                      phase: 0,
                      refName: 'NC_000001.10',
                      parent: 'mRNA2436',
                      dbxref: [
                        'GeneID:8915',
                        'Genbank:NM_001320715.2',
                        'HGNC:HGNC:989',
                        'MIM:603517',
                      ],
                      gbkey: 'mRNA',
                      gene: 'BCL10',
                      product:
                        'BCL10 immune signaling adaptor, transcript variant 2',
                      transcript_id: 'NM_001320715.2',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1-0',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1',
                    },
                    {
                      source: 'BestRefSeq',
                      type: 'CDS',
                      start: 85733309,
                      end: 85733632,
                      strand: -1,
                      phase: 2,
                      refName: 'NC_000001.10',
                      id: 'CDS2349',
                      parent: 'mRNA2436',
                      dbxref: [
                        'GeneID:8915',
                        'Genbank:NP_001307644.1',
                        'HGNC:HGNC:989',
                        'MIM:603517',
                      ],
                      name: 'NP_001307644.1',
                      note: 'isoform 2 is encoded by transcript variant 2',
                      gbkey: 'CDS',
                      gene: 'BCL10',
                      product: 'B-cell lymphoma/leukemia 10 isoform 2',
                      protein_id: 'NP_001307644.1',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1-1',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1',
                    },
                    {
                      source: 'BestRefSeq',
                      type: 'CDS',
                      start: 85736300,
                      end: 85736589,
                      strand: -1,
                      phase: 0,
                      refName: 'NC_000001.10',
                      id: 'CDS2349',
                      parent: 'mRNA2436',
                      dbxref: [
                        'GeneID:8915',
                        'Genbank:NP_001307644.1',
                        'HGNC:HGNC:989',
                        'MIM:603517',
                      ],
                      name: 'NP_001307644.1',
                      note: 'isoform 2 is encoded by transcript variant 2',
                      gbkey: 'CDS',
                      gene: 'BCL10',
                      product: 'B-cell lymphoma/leukemia 10 isoform 2',
                      protein_id: 'NP_001307644.1',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1-2',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1',
                    },
                    {
                      source: 'BestRefSeq',
                      type: 'CDS',
                      start: 85741978,
                      end: 85742035,
                      strand: -1,
                      phase: 0,
                      refName: 'NC_000001.10',
                      id: 'CDS2349',
                      parent: 'mRNA2436',
                      dbxref: [
                        'GeneID:8915',
                        'Genbank:NP_001307644.1',
                        'HGNC:HGNC:989',
                        'MIM:603517',
                      ],
                      name: 'NP_001307644.1',
                      note: 'isoform 2 is encoded by transcript variant 2',
                      gbkey: 'CDS',
                      gene: 'BCL10',
                      product: 'B-cell lymphoma/leukemia 10 isoform 2',
                      protein_id: 'NP_001307644.1',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1-3',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1',
                    },
                    {
                      source: 'BestRefSeq',
                      type: 'exon',
                      start: 85736300,
                      end: 85736589,
                      strand: -1,
                      phase: 0,
                      refName: 'NC_000001.10',
                      parent: 'mRNA2436',
                      dbxref: [
                        'GeneID:8915',
                        'Genbank:NM_001320715.2',
                        'HGNC:HGNC:989',
                        'MIM:603517',
                      ],
                      gbkey: 'mRNA',
                      gene: 'BCL10',
                      product:
                        'BCL10 immune signaling adaptor, transcript variant 2',
                      transcript_id: 'NM_001320715.2',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1-4',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1',
                    },
                    {
                      source: 'BestRefSeq',
                      type: 'exon',
                      start: 85741978,
                      end: 85742315,
                      strand: -1,
                      phase: 0,
                      refName: 'NC_000001.10',
                      parent: 'mRNA2436',
                      dbxref: [
                        'GeneID:8915',
                        'Genbank:NM_001320715.2',
                        'HGNC:HGNC:989',
                        'MIM:603517',
                      ],
                      gbkey: 'mRNA',
                      gene: 'BCL10',
                      product:
                        'BCL10 immune signaling adaptor, transcript variant 2',
                      transcript_id: 'NM_001320715.2',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1-5',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1',
                    },
                    {
                      start: 85742035,
                      end: 85742315,
                      strand: -1,
                      type: 'five_prime_UTR',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1_five_prime_UTR_2',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1',
                    },
                  ],
                  uniqueId:
                    'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480-1',
                  parentId:
                    'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480',
                },
              ],
              uniqueId:
                'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-294046480',
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
