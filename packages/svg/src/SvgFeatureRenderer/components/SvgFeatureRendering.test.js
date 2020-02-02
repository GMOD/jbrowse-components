import GranularRectLayout from '@gmod/jbrowse-core/util/layouts/GranularRectLayout'
import PrecomputedLayout from '@gmod/jbrowse-core/util/layouts/PrecomputedLayout'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import React from 'react'
import { render } from '@testing-library/react'
import SvgRendererConfigSchema from '../configSchema'
import Rendering, { SvgMouseover, SvgSelected } from './SvgFeatureRendering'

// these tests do very little, let's try to expand them at some point
test('no features', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      region={{ refName: 'zonk', start: 0, end: 300 }}
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
      region={{ refName: 'zonk', start: 0, end: 1000 }}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([['one', new SimpleFeature({ id: 'one', start: 1, end: 3 })]])
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
      region={{ refName: 'zonk', start: 0, end: 1000 }}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              data: {
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
              },
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
      region={{ refName: 'zonk', start: 0, end: 1000 }}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([['one', new SimpleFeature({ id: 'one', start: 1, end: 3 })]])
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
      region={{ refName: 'zonk', start: 0, end: 1000 }}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              data: {
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
              },
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

test('svg selected', () => {
  const blockLayoutFeatures = new Map()
  const layout = new Map()
  layout.set('one', [0, 0, 10, 10])
  blockLayoutFeatures.set('block1', layout)

  const { container } = render(
    <svg>
      <SvgMouseover
        width={500}
        height={500}
        blockKey="block1"
        region={{ refName: 'zonk', start: 0, end: 1000 }}
        trackModel={{ blockLayoutFeatures, featureIdUnderMouse: 'one' }}
        config={SvgRendererConfigSchema.create({})}
        bpPerPx={3}
      />
      <SvgSelected
        width={500}
        height={500}
        blockKey="block1"
        region={{ refName: 'zonk', start: 0, end: 1000 }}
        trackModel={{ blockLayoutFeatures, selectedFeatureId: 'one' }}
        config={SvgRendererConfigSchema.create({})}
        bpPerPx={3}
      />
    </svg>,
  )

  expect(container.firstChild).toMatchSnapshot()
})

test('svg broken rendering', () => {
  const feats = [
    {
      source: 'RefSeq',
      type: 'region',
      start: 0,
      end: 27754200,
      strand: 1,
      phase: 0,
      refName: 'NC_037638.1',
      dbxref: 'taxon:7460',
      name: 'LG1',
      'collection-date': '2003',
      country: 'USA',
      gbkey: 'Src',
      genome: 'chromosome',
      'isolation-source': 'bee hive',
      'linkage-group': 'LG1',
      mol_type: 'genomic DNA',
      sex: 'male',
      strain: 'DH4',
      'tissue-type': 'whole body',
      uniqueId: 'offset-1450768',
    },
    {
      source: 'RefSeq',
      type: 'cDNA_match',
      start: 821804,
      end: 824037,
      score: 2210,
      strand: -1,
      phase: 0,
      refName: 'NC_037638.1',
      target: 'NM_001141964.1 1 2248 +',
      assembly_bases_aln: '2233',
      assembly_bases_seq: '2233',
      consensus_splices: '0',
      exon_identity: '0.991103',
      for_remapping: '2',
      gap_count: '3',
      identity: '0.991103',
      idty: '0.991103',
      matches: '2228',
      num_ident: '2228',
      num_mismatch: '5',
      pct_coverage: '99.3327',
      pct_coverage_hiqual: '99.3327',
      pct_identity_gap: '99.1103',
      pct_identity_ungap: '99.7761',
      product_coverage: '1',
      rank: '1',
      splices: '0',
      weighted_identity: '0.987151',
      gap: 'M1121 I8 M176 I1 M781 I6 M155',
      uniqueId: 'offset-9275948',
    },
    {
      source: 'Gnomon',
      type: 'gene',
      start: 9272,
      end: 12174,
      strand: -1,
      phase: 0,
      refName: 'NC_037638.1',
      id: 'gene14',
      dbxref: ['BEEBASE:GB42195', 'GeneID:551580'],
      name: 'LOC551580',
      gbkey: 'Gene',
      gene: 'LOC551580',
      gene_biotype: 'protein_coding',
      uniqueId: 'offset-1451231',
    },
  ]
  const region = {
    refName: 'NC_037638.1',
    start: 0,
    end: 140000,
    assemblyName: 'amel',
  }
  const bpPerPx = 100
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      region={region}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      config={SvgRendererConfigSchema.create({})}
      bpPerPx={bpPerPx}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})
