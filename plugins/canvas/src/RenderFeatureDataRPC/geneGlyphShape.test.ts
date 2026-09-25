import { SimpleFeature } from '@jbrowse/core/util'

import { geneGlyphShape } from './geneGlyphShape.ts'

test('geneGlyphShape merges exons across transcripts and falls back to the span', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene1',
    refName: 'chr1',
    start: 100,
    end: 400,
    subfeatures: [
      {
        uniqueId: 'rna1',
        refName: 'chr1',
        start: 100,
        end: 400,
        subfeatures: [
          {
            uniqueId: 'e1',
            refName: 'chr1',
            start: 100,
            end: 150,
            type: 'exon',
          },
          {
            uniqueId: 'e2',
            refName: 'chr1',
            start: 300,
            end: 400,
            type: 'exon',
          },
        ],
      },
      {
        uniqueId: 'rna2',
        refName: 'chr1',
        start: 100,
        end: 400,
        subfeatures: [
          {
            uniqueId: 'e3',
            refName: 'chr1',
            start: 120,
            end: 200,
            type: 'exon',
          },
        ],
      },
    ],
  })
  expect(geneGlyphShape(gene)).toEqual({
    full: [
      [100, 200],
      [300, 400],
    ],
    thin: [],
  })
  const bare = new SimpleFeature({
    uniqueId: 'bare',
    refName: 'chr1',
    start: 5,
    end: 10,
  })
  expect(geneGlyphShape(bare)).toEqual({ full: [[5, 10]], thin: [] })
})

test('geneGlyphShape splits merged exons into CDS and UTR intervals', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene2',
    refName: 'chr1',
    start: 100,
    end: 400,
    subfeatures: [
      {
        uniqueId: 'rna1',
        refName: 'chr1',
        start: 100,
        end: 400,
        subfeatures: [
          {
            uniqueId: 'x1',
            refName: 'chr1',
            start: 100,
            end: 160,
            type: 'exon',
          },
          {
            uniqueId: 'x2',
            refName: 'chr1',
            start: 300,
            end: 400,
            type: 'exon',
          },
          {
            uniqueId: 'c1',
            refName: 'chr1',
            start: 140,
            end: 160,
            type: 'CDS',
          },
          {
            uniqueId: 'c2',
            refName: 'chr1',
            start: 300,
            end: 380,
            type: 'CDS',
          },
        ],
      },
    ],
  })
  expect(geneGlyphShape(gene)).toEqual({
    full: [
      [140, 160],
      [300, 380],
    ],
    thin: [
      [100, 140],
      [380, 400],
    ],
  })
})

test('geneGlyphShape draws a CDS-only annotation full height', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene3',
    refName: 'chr1',
    start: 100,
    end: 200,
    subfeatures: [
      { uniqueId: 'c1', refName: 'chr1', start: 100, end: 150, type: 'CDS' },
      { uniqueId: 'c2', refName: 'chr1', start: 170, end: 200, type: 'CDS' },
    ],
  })
  expect(geneGlyphShape(gene)).toEqual({
    full: [
      [100, 150],
      [170, 200],
    ],
    thin: [],
  })
})

test('geneGlyphShape implies a CDS-only annotation’s UTRs from its own bounds', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene6',
    refName: 'chr1',
    start: 80,
    end: 240,
    subfeatures: [
      { uniqueId: 'c1', refName: 'chr1', start: 100, end: 150, type: 'CDS' },
      { uniqueId: 'c2', refName: 'chr1', start: 170, end: 200, type: 'CDS' },
    ],
  })
  // the ends only — 150..170 is an intron between two CDS pieces, not UTR
  expect(geneGlyphShape(gene)).toEqual({
    full: [
      [100, 150],
      [170, 200],
    ],
    thin: [
      [80, 100],
      [200, 240],
    ],
  })
})

// The subpart rules are the feature track's own (`isCDS`/`isExon`/`isUTR`),
// which is what these two cover: matching `type === 'CDS'` exactly drew the
// first as one flat full-height box, and a transcript naming its UTRs rather
// than its exons lost them entirely in the second.
test('geneGlyphShape reads a lowercase cds the way the feature track does', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene4',
    refName: 'chr1',
    start: 100,
    end: 200,
    subfeatures: [
      { uniqueId: 'e1', refName: 'chr1', start: 100, end: 200, type: 'Exon' },
      { uniqueId: 'c1', refName: 'chr1', start: 140, end: 180, type: 'cds' },
    ],
  })
  expect(geneGlyphShape(gene)).toEqual({
    full: [[140, 180]],
    thin: [
      [100, 140],
      [180, 200],
    ],
  })
})

test('geneGlyphShape draws explicit UTR rows where a transcript names no exons', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene5',
    refName: 'chr1',
    start: 100,
    end: 200,
    subfeatures: [
      {
        uniqueId: 'u1',
        refName: 'chr1',
        start: 100,
        end: 130,
        type: 'five_prime_UTR',
      },
      { uniqueId: 'c1', refName: 'chr1', start: 130, end: 175, type: 'CDS' },
      {
        uniqueId: 'u2',
        refName: 'chr1',
        start: 175,
        end: 200,
        type: 'three_prime_UTR',
      },
    ],
  })
  expect(geneGlyphShape(gene)).toEqual({
    full: [[130, 175]],
    thin: [
      [100, 130],
      [175, 200],
    ],
  })
})

// One rule per transcript, the feature track's: a transcript naming its UTRs
// implies none, one naming exons implies its overhang, and a region coding in
// either reads full. Read gene-wide, the explicit UTRs of the first transcript
// used to switch implication off for the second.
test('geneGlyphShape lets each transcript decide its own UTRs', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene7',
    refName: 'chr1',
    start: 100,
    end: 400,
    subfeatures: [
      {
        uniqueId: 'rna1',
        refName: 'chr1',
        start: 100,
        end: 300,
        subfeatures: [
          {
            uniqueId: 'u1',
            refName: 'chr1',
            start: 100,
            end: 150,
            type: 'five_prime_UTR',
          },
          {
            uniqueId: 'c1',
            refName: 'chr1',
            start: 150,
            end: 300,
            type: 'CDS',
          },
        ],
      },
      {
        uniqueId: 'rna2',
        refName: 'chr1',
        start: 200,
        end: 400,
        subfeatures: [
          {
            uniqueId: 'x1',
            refName: 'chr1',
            start: 200,
            end: 400,
            type: 'exon',
          },
          {
            uniqueId: 'c2',
            refName: 'chr1',
            start: 200,
            end: 350,
            type: 'CDS',
          },
        ],
      },
    ],
  })
  expect(geneGlyphShape(gene)).toEqual({
    full: [[150, 350]],
    thin: [
      [100, 150],
      [350, 400],
    ],
  })
})
