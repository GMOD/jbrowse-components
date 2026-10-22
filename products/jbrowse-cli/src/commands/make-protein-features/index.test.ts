/**
 * @jest-environment node
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

import { runCommand, runInTmpDir } from '../../testUtil.ts'
import {
  findTranscript,
  parseCall,
  projectResidues,
  readCodingTranscripts,
} from './project.ts'

import type { CodingTranscript } from './project.ts'

const gff3 = `##gff-version 3
ctgA\t.\tmRNA\t101\t230\t.\t+\t.\tID=rna-XM_1.1
ctgA\t.\tCDS\t201\t230\t.\t+\t0\tID=cds-XP_1.1;Parent=rna-XM_1.1;protein_id=XP_1.1
ctgA\t.\tCDS\t101\t130\t.\t+\t0\tID=cds-XP_1.1;Parent=rna-XM_1.1;protein_id=XP_1.1
ctgA\t.\tCDS\t301\t330\t.\t-\t0\tParent=minus
ctgA\t.\tCDS\t401\t430\t.\t-\t0\tParent=minus
ctgB\t.\tCDS\t11\t40\t.\t+\t1\tParent=partial
`

const plus: CodingTranscript = {
  id: 'plus',
  refName: 'ctgA',
  strand: '+',
  segments: [
    { start: 100, end: 130 },
    { start: 200, end: 230 },
  ],
  phase: 0,
}
const minus: CodingTranscript = { ...plus, strand: '-' }

test('residues across an intron give a block on each side', () => {
  // residues 8..14 are bases 21..42 of the CDS: 9 in the first part, 12 in the second
  expect(projectResidues(plus, 8, 14)).toEqual([
    { start: 121, end: 130 },
    { start: 200, end: 212 },
  ])
})

test('a minus-strand CDS translates from its rightmost part', () => {
  expect(projectResidues(minus, 1, 12)).toEqual([
    { start: 124, end: 130 },
    { start: 200, end: 230 },
  ])
})

test('the first part phase shifts every codon', () => {
  expect(projectResidues({ ...plus, phase: 1 }, 1, 1)).toEqual([
    { start: 101, end: 104 },
  ])
})

test('residues past the CDS give no blocks, a call reaching past it stops there', () => {
  expect(projectResidues(plus, 21, 30)).toEqual([])
  expect(projectResidues(plus, 20, 30)).toEqual([{ start: 227, end: 230 }])
})

test('reads CDS parts and matches a protein by any of its names', async () => {
  await runInTmpDir(async () => {
    fs.writeFileSync('genes.gff3', gff3)
    const { lookup, transcripts } = await readCodingTranscripts('genes.gff3')
    expect(transcripts).toBe(3)
    const ncbi = findTranscript(lookup, 'XP_1.1')!
    expect(ncbi.id).toBe('rna-XM_1.1')
    expect(ncbi.segments).toEqual([
      { start: 100, end: 130 },
      { start: 200, end: 230 },
    ])
    expect(findTranscript(lookup, 'XM_1')).toBe(ncbi)
    expect(findTranscript(lookup, 'minus')!.strand).toBe('-')
    expect(findTranscript(lookup, 'partial')!.phase).toBe(1)
    expect(findTranscript(lookup, 'XP_2')).toBeUndefined()
  })
})

test('reads a GTF', async () => {
  await runInTmpDir(async () => {
    fs.writeFileSync(
      'genes.gtf',
      'chr1\t.\tCDS\t11\t40\t.\t+\t0\tgene_id "g"; transcript_id "T1"; protein_id "P1";\n',
    )
    const { lookup } = await readCodingTranscripts('genes.gtf')
    expect(findTranscript(lookup, 'P1')!.id).toBe('T1')
  })
})

const hmmscanRow =
  'Pkinase PF00069.29 264 XP_1.1 - 600 1e-50 170.2 0.1 1 1 1e-53 2e-50 169.9 0.1 1 264 4 9 3 10 0.95 Protein kinase domain'
const hmmsearchRow =
  'XP_1.1 - 600 Pkinase PF00069.29 264 1e-50 170.2 0.1 1 1 1e-53 2e-50 169.9 0.1 1 264 4 9 3 10 0.95 Protein kinase domain'

test('a HMMER row names the protein on whichever side it sits', () => {
  const isProtein = (id: string) => id === 'XP_1.1'
  const expected = {
    protein: 'XP_1.1',
    start: 3,
    end: 10,
    accession: 'PF00069.29',
    name: 'Pkinase',
    description: 'Protein kinase domain',
    source: 'HMMER',
    evalue: '2e-50',
  }
  expect(parseCall(hmmscanRow, isProtein)).toEqual(expected)
  expect(parseCall(hmmsearchRow, isProtein)).toEqual(expected)
  expect(parseCall('# comment', isProtein)).toBeUndefined()
})

test('reads an InterProScan TSV row', () => {
  const row =
    'XP_1.1\tmd5\t600\tPfam\tPF00069\tProtein kinase domain\t3\t10\t2.1E-50\tT\t01-01-2026\tIPR000719\tProtein kinase domain'
  expect(parseCall(row, () => false)).toMatchObject({
    protein: 'XP_1.1',
    start: 3,
    end: 10,
    source: 'Pfam',
    name: 'Protein kinase domain',
  })
})

test('writes an indexed BED12 a block per exon', async () => {
  await runInTmpDir(async () => {
    fs.writeFileSync('genes.gff3', gff3)
    fs.writeFileSync(
      'calls.tsv',
      [
        'XP_1.1\tm\t20\tPfam\tPF00069\tProtein kinase domain\t8\t14\t1E-5\tT\td\t-\t-',
        'XP_1.1\tm\t20\tSMART\tSM00220\tS_TKc\t8\t14\t1E-5\tT\td\t-\t-',
        'nobody\tm\t20\tPfam\tPF1\tX\t1\t2\t1\tT\td\t-\t-',
      ].join('\n'),
    )
    const { error, warnings } = await runCommand([
      'make-protein-features',
      'genes.gff3',
      'calls.tsv',
      '--source',
      'pfam',
      '--out',
      'out.bed.gz',
    ])
    expect(error).toBeUndefined()
    expect(warnings).toContain('nobody')
    expect(fs.existsSync('out.bed.gz.tbi')).toBe(true)
    const lines = execFileSync('sh', ['-c', 'gzip -dc out.bed.gz'])
      .toString()
      .trim()
      .split('\n')
    expect(lines[0]!.split('\t').slice(0, 4)).toEqual([
      '#chrom',
      'chromStart',
      'chromEnd',
      'name',
    ])
    expect(lines.slice(1)).toEqual([
      [
        'ctgA',
        121,
        212,
        'Protein kinase domain',
        0,
        '+',
        121,
        212,
        0,
        2,
        '9,12',
        '0,79',
        'PF00069',
        'Protein kinase domain',
        'Pfam',
        'rna-XM_1.1',
        8,
        14,
        '1E-5',
      ].join('\t'),
    ])
  })
})

test('refuses calls that match no transcript', async () => {
  await runInTmpDir(async () => {
    fs.writeFileSync('genes.gff3', gff3)
    fs.writeFileSync(
      'calls.tsv',
      'nobody\tm\t20\tPfam\tPF1\tX\t1\t2\t1\tT\td\t-\t-\n',
    )
    const { error } = await runCommand([
      'make-protein-features',
      'genes.gff3',
      'calls.tsv',
    ])
    expect(error?.message).toContain('nobody')
    expect(fs.existsSync('protein_features.bed.gz')).toBe(false)
  })
})
