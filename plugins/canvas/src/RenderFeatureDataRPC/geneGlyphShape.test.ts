import { SimpleFeature } from '@jbrowse/core/util'

import { geneGlyphShape, hasGeneParts } from './geneGlyphShape.ts'

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

// A GENCODE gene with a coding isoform beside a retained-intron one: the
// non-coding transcript's exons are untranslated wherever no isoform codes
// them, so they belong in `thin`, not nowhere.
test('geneGlyphShape draws a non-coding isoform’s exons beside a coding one', () => {
  const gene = new SimpleFeature({
    uniqueId: 'g',
    refName: 'chr1',
    start: 100,
    end: 1000,
    strand: 1,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 'coding',
        refName: 'chr1',
        start: 100,
        end: 1000,
        type: 'mRNA',
        subfeatures: [
          {
            uniqueId: 'e1',
            refName: 'chr1',
            start: 100,
            end: 300,
            type: 'exon',
          },
          {
            uniqueId: 'e2',
            refName: 'chr1',
            start: 800,
            end: 1000,
            type: 'exon',
          },
          {
            uniqueId: 'c1',
            refName: 'chr1',
            start: 200,
            end: 300,
            type: 'CDS',
          },
          {
            uniqueId: 'c2',
            refName: 'chr1',
            start: 800,
            end: 900,
            type: 'CDS',
          },
        ],
      },
      {
        uniqueId: 'retained',
        refName: 'chr1',
        start: 100,
        end: 800,
        type: 'mRNA',
        subfeatures: [
          {
            uniqueId: 'r1',
            refName: 'chr1',
            start: 300,
            end: 800,
            type: 'exon',
          },
        ],
      },
    ],
  })
  expect(geneGlyphShape(gene)).toEqual({
    full: [
      [200, 300],
      [800, 900],
    ],
    thin: [
      [100, 200],
      [300, 800],
      [900, 1000],
    ],
  })
})

// `impliedUTRs` is the display's slot: off, a transcript naming no UTR row
// contributes none, and the merged glyph draws its coding spans alone.
test('geneGlyphShape implies no UTRs when the slot is off', () => {
  const gene = new SimpleFeature({
    uniqueId: 'g',
    refName: 'chr1',
    start: 100,
    end: 400,
    strand: 1,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 't',
        refName: 'chr1',
        start: 100,
        end: 400,
        type: 'mRNA',
        subfeatures: [
          {
            uniqueId: 'e',
            refName: 'chr1',
            start: 100,
            end: 400,
            type: 'exon',
          },
          { uniqueId: 'c', refName: 'chr1', start: 200, end: 300, type: 'CDS' },
        ],
      },
    ],
  })
  expect(geneGlyphShape(gene)).toEqual({
    full: [[200, 300]],
    thin: [
      [100, 200],
      [300, 400],
    ],
  })
  expect(geneGlyphShape(gene, { impliedUTRs: false })).toEqual({
    full: [[200, 300]],
    thin: [],
  })
})

// The predicate `findGlyph` gates the merged mode on: a shape exists only
// where some descendant is an exon, a CDS or a UTR.
test('hasGeneParts separates a gene from a container of genes', () => {
  const leafGene = {
    uniqueId: 'inner',
    refName: 'chr1',
    start: 10,
    end: 20,
    type: 'gene',
  }
  const container = new SimpleFeature({
    uniqueId: 'sc',
    refName: 'chr1',
    start: 0,
    end: 1000,
    type: 'supercontig',
    subfeatures: [leafGene],
  })
  expect(hasGeneParts(container)).toBe(false)
  const gene = new SimpleFeature({
    uniqueId: 'g',
    refName: 'chr1',
    start: 10,
    end: 20,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 't',
        refName: 'chr1',
        start: 10,
        end: 20,
        type: 'mRNA',
        subfeatures: [
          { uniqueId: 'e', refName: 'chr1', start: 10, end: 20, type: 'exon' },
        ],
      },
    ],
  })
  expect(hasGeneParts(gene)).toBe(true)
})
