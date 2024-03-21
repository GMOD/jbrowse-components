import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import PrecomputedLayout from '@jbrowse/core/util/layouts/PrecomputedLayout'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

// locals
import SvgRendererConfigSchema from '../configSchema'
import Rendering from './SvgFeatureRendering'
import SvgOverlay from './SvgOverlay'

import '@testing-library/jest-dom'

test('no features', () => {
  const { container } = render(
    <Rendering
      blockKey="hello"
      colorByCDS={false}
      features={new Map()}
      regions={[
        { assemblyName: 'volvox', end: 300, refName: 'zonk', start: 0 },
      ]}
      layout={
        new PrecomputedLayout({
          containsNoTransferables: true,
          maxHeightReached: false,
          rectangles: {},
          totalHeight: 20,
        })
      }
      viewParams={{ end: 50000, offsetPx: 0, offsetPx1: 5000, start: 0 }}
      config={SvgRendererConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('one feature', () => {
  const { container } = render(
    <Rendering
      blockKey="hello"
      colorByCDS={false}
      regions={[
        { assemblyName: 'volvox', end: 1000, refName: 'zonk', start: 0 },
      ]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      viewParams={{ end: 50000, offsetPx: 0, offsetPx1: 5000, start: 0 }}
      features={
        new Map([
          ['one', new SimpleFeature({ end: 3, start: 1, uniqueId: 'one' })],
        ])
      }
      config={SvgRendererConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('click on one feature, and do not re-render', () => {
  let counter = 0
  const { container, getByTestId } = render(
    <Rendering
      blockKey="hello"
      colorByCDS={false}
      regions={[
        { assemblyName: 'volvox', end: 1000, refName: 'zonk', start: 0 },
      ]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      viewParams={{ end: 50000, offsetPx: 0, offsetPx1: 5000, start: 0 }}
      features={
        new Map([
          ['one', new SimpleFeature({ end: 3, start: 1, uniqueId: 'one' })],
          ['two', new SimpleFeature({ end: 3, start: 1, uniqueId: 'two' })],
          ['three', new SimpleFeature({ end: 3, start: 1, uniqueId: 'three' })],
        ])
      }
      config={SvgRendererConfigSchema.create({})}
      bpPerPx={3}
      detectRerender={() => counter++}
    />,
  )
  fireEvent.click(getByTestId('box-one'))
  expect(counter).toBe(3)

  expect(container).toMatchSnapshot()
})

test('one feature (compact mode)', () => {
  const config = SvgRendererConfigSchema.create({ displayMode: 'compact' })

  const { container } = render(
    <Rendering
      blockKey="hello"
      colorByCDS={false}
      regions={[
        { assemblyName: 'volvox', end: 1000, refName: 'zonk', start: 0 },
      ]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      viewParams={{ end: 50000, offsetPx: 0, offsetPx1: 5000, start: 0 }}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              end: 9744,
              name: 'au9.g1002.t1',
              score: 0.84,
              start: 5975,
              strand: 1,
              subfeatures: [
                {
                  end: 6109,
                  score: 0.98,
                  start: 5975,
                  strand: 1,
                  type: 'five_prime_UTR',
                },
                {
                  end: 6112,
                  phase: 0,
                  start: 6110,
                  strand: 1,
                  type: 'start_codon',
                },
                {
                  end: 6148,
                  phase: 0,
                  score: 1,
                  start: 6110,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 6683,
                  phase: 0,
                  score: 1,
                  start: 6615,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 7040,
                  phase: 0,
                  score: 1,
                  start: 6758,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 7319,
                  phase: 2,
                  score: 1,
                  start: 7142,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 7687,
                  phase: 1,
                  score: 1,
                  start: 7411,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 7850,
                  phase: 0,
                  score: 1,
                  start: 7748,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 8098,
                  phase: 2,
                  score: 1,
                  start: 7953,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 8320,
                  phase: 0,
                  score: 1,
                  start: 8166,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 8614,
                  phase: 1,
                  score: 1,
                  start: 8419,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 8811,
                  phase: 0,
                  score: 1,
                  start: 8708,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 9239,
                  phase: 1,
                  score: 1,
                  start: 8927,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 9494,
                  phase: 0,
                  score: 1,
                  start: 9414,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 9494,
                  phase: 0,
                  start: 9492,
                  strand: 1,
                  type: 'stop_codon',
                },
                {
                  end: 9744,
                  score: 0.86,
                  start: 9495,
                  strand: 1,
                  type: 'three_prime_UTR',
                },
              ],
              type: 'mRNA',
              uniqueId: 'one',
            }),
          ],
        ])
      }
      config={config}
      bpPerPx={3}
    />,
  )

  // reducedRepresentation of the transcript is just a box
  expect(container).toMatchSnapshot()
})

test('processed transcript (reducedRepresentation mode)', () => {
  const config = SvgRendererConfigSchema.create({
    displayMode: 'reducedRepresentation',
  })
  const { container } = render(
    <Rendering
      blockKey="hello"
      colorByCDS={false}
      regions={[
        { assemblyName: 'volvox', end: 1000, refName: 'zonk', start: 0 },
      ]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      viewParams={{ end: 50000, offsetPx: 0, offsetPx1: 5000, start: 0 }}
      features={
        new Map([
          ['one', new SimpleFeature({ end: 3, start: 1, uniqueId: 'one' })],
        ])
      }
      config={config}
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('processed transcript', () => {
  const { container } = render(
    <Rendering
      blockKey="hello"
      colorByCDS={false}
      regions={[
        { assemblyName: 'volvox', end: 1000, refName: 'zonk', start: 0 },
      ]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      viewParams={{ end: 50000, offsetPx: 0, offsetPx1: 5000, start: 0 }}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              end: 9744,
              name: 'au9.g1002.t1',
              score: 0.84,
              start: 5975,
              strand: 1,
              subfeatures: [
                {
                  end: 6109,
                  score: 0.98,
                  start: 5975,
                  strand: 1,
                  type: 'five_prime_UTR',
                },
                {
                  end: 6112,
                  phase: 0,
                  start: 6110,
                  strand: 1,
                  type: 'start_codon',
                },
                {
                  end: 6148,
                  phase: 0,
                  score: 1,
                  start: 6110,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 6683,
                  phase: 0,
                  score: 1,
                  start: 6615,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 7040,
                  phase: 0,
                  score: 1,
                  start: 6758,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 7319,
                  phase: 2,
                  score: 1,
                  start: 7142,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 7687,
                  phase: 1,
                  score: 1,
                  start: 7411,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 7850,
                  phase: 0,
                  score: 1,
                  start: 7748,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 8098,
                  phase: 2,
                  score: 1,
                  start: 7953,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 8320,
                  phase: 0,
                  score: 1,
                  start: 8166,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 8614,
                  phase: 1,
                  score: 1,
                  start: 8419,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 8811,
                  phase: 0,
                  score: 1,
                  start: 8708,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 9239,
                  phase: 1,
                  score: 1,
                  start: 8927,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 9494,
                  phase: 0,
                  score: 1,
                  start: 9414,
                  strand: 1,
                  type: 'CDS',
                },
                {
                  end: 9494,
                  phase: 0,
                  start: 9492,
                  strand: 1,
                  type: 'stop_codon',
                },
                {
                  end: 9744,
                  score: 0.86,
                  start: 9495,
                  strand: 1,
                  type: 'three_prime_UTR',
                },
              ],
              type: 'mRNA',
              uniqueId: 'one',
            }),
          ],
        ])
      }
      config={SvgRendererConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('processed transcript (exons + impliedUTR)', () => {
  const { container } = render(
    <Rendering
      blockKey="hello"
      colorByCDS={false}
      regions={[
        { assemblyName: 'volvox', end: 1000, refName: 'zonk', start: 0 },
      ]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      viewParams={{ end: 50000, offsetPx: 0, offsetPx1: 5000, start: 0 }}
      features={
        new Map([
          [
            'one',

            // from LACTBL1 http://localhost:3000/?config=test_data%2Fconfig_demo.json&session=share-ka-YgPvBsB&password=syjLw
            new SimpleFeature({
              dbxref: ['GeneID:646262', 'HGNC:HGNC:35445'],
              description: 'lactamase beta like 1',
              end: 23299359,
              gbkey: 'Gene',
              gene: 'LACTBL1',
              gene_biotype: 'protein_coding',
              id: 'gene407',
              name: 'LACTBL1',
              phase: 0,
              refName: 'NC_000001.10',
              source: 'BestRefSeq',
              start: 23279535,
              strand: -1,
              subfeatures: [
                {
                  dbxref: [
                    'GeneID:646262',
                    'Genbank:NM_001289974.2',
                    'HGNC:HGNC:35445',
                  ],
                  end: 23299359,
                  gbkey: 'mRNA',
                  gene: 'LACTBL1',
                  id: 'mRNA779',
                  name: 'NM_001289974.2',
                  parent: 'gene407',
                  parentId:
                    'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116',
                  phase: 0,
                  product: 'lactamase beta like 1',
                  refName: 'NC_000001.10',
                  source: 'BestRefSeq',
                  start: 23279535,
                  strand: -1,
                  subfeatures: [
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NM_001289974.2',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23280517,
                      gbkey: 'mRNA',
                      gene: 'LACTBL1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'lactamase beta like 1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23279535,
                      strand: -1,
                      tag: 'RefSeq Select',
                      transcript_id: 'NM_001289974.2',
                      type: 'exon',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-0',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23280517,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 1,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23279535,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-1',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23281919,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 2,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23281813,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-2',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23285413,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 1,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23285177,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-3',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23286592,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23286434,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-4',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23289709,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 2,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23289599,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-5',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23291918,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23291782,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-6',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23298809,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23298797,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-7',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23280517,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 1,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23279535,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-8',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23281919,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 2,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23281813,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-9',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23285413,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 1,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23285177,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-10',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23286592,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23286434,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-11',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23289709,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 2,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23289599,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-12',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23291918,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23291782,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-13',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NP_001276903.1',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23298809,
                      gbkey: 'CDS',
                      gene: 'LACTBL1',
                      id: 'CDS763',
                      name: 'NP_001276903.1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'putative beta-lactamase-like 1',
                      protein_id: 'NP_001276903.1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23298797,
                      strand: -1,
                      tag: 'RefSeq Select',
                      type: 'CDS',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-14',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NM_001289974.2',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23281919,
                      gbkey: 'mRNA',
                      gene: 'LACTBL1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'lactamase beta like 1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23281813,
                      strand: -1,
                      tag: 'RefSeq Select',
                      transcript_id: 'NM_001289974.2',
                      type: 'exon',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-15',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NM_001289974.2',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23285413,
                      gbkey: 'mRNA',
                      gene: 'LACTBL1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'lactamase beta like 1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23285177,
                      strand: -1,
                      tag: 'RefSeq Select',
                      transcript_id: 'NM_001289974.2',
                      type: 'exon',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-16',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NM_001289974.2',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23286592,
                      gbkey: 'mRNA',
                      gene: 'LACTBL1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'lactamase beta like 1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23286434,
                      strand: -1,
                      tag: 'RefSeq Select',
                      transcript_id: 'NM_001289974.2',
                      type: 'exon',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-17',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NM_001289974.2',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23289709,
                      gbkey: 'mRNA',
                      gene: 'LACTBL1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'lactamase beta like 1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23289599,
                      strand: -1,
                      tag: 'RefSeq Select',
                      transcript_id: 'NM_001289974.2',
                      type: 'exon',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-18',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NM_001289974.2',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23291918,
                      gbkey: 'mRNA',
                      gene: 'LACTBL1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'lactamase beta like 1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23291782,
                      strand: -1,
                      tag: 'RefSeq Select',
                      transcript_id: 'NM_001289974.2',
                      type: 'exon',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-19',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NM_001289974.2',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23298924,
                      gbkey: 'mRNA',
                      gene: 'LACTBL1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'lactamase beta like 1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23298797,
                      strand: -1,
                      tag: 'RefSeq Select',
                      transcript_id: 'NM_001289974.2',
                      type: 'exon',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-20',
                    },
                    {
                      dbxref: [
                        'GeneID:646262',
                        'Genbank:NM_001289974.2',
                        'HGNC:HGNC:35445',
                      ],
                      end: 23299359,
                      gbkey: 'mRNA',
                      gene: 'LACTBL1',
                      parent: 'mRNA779',
                      parentId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                      phase: 0,
                      product: 'lactamase beta like 1',
                      refName: 'NC_000001.10',
                      source: 'BestRefSeq',
                      start: 23299264,
                      strand: -1,
                      tag: 'RefSeq Select',
                      transcript_id: 'NM_001289974.2',
                      type: 'exon',
                      uniqueId:
                        'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0-21',
                    },
                  ],
                  tag: 'RefSeq Select',
                  transcript_id: 'NM_001289974.2',
                  type: 'mRNA',
                  uniqueId:
                    'type-Gff3TabixAdapter;type-Gff3TabixAdapter;uri-https://s3.amazonaws.com/jbrowse.org/genomes/hg19/nc-offset-107608116-0',
                },
              ],
              type: 'gene',
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

  expect(container).toMatchSnapshot()
})

// hacks existence of getFeatureByID
test('svg selected', () => {
  const { container } = render(
    <svg>
      <SvgOverlay
        blockKey="block1"
        region={{
          assemblyName: 'volvox',
          end: 1000,
          refName: 'zonk',
          start: 0,
        }}
        displayModel={{
          featureIdUnderMouse: 'one',
          getFeatureByID: () => [0, 0, 10, 10],
          selectedFeatureId: 'one',
        }}
        bpPerPx={3}
      />
    </svg>,
  )

  expect(container).toMatchSnapshot()
})
