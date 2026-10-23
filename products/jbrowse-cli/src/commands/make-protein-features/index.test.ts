/**
 * @jest-environment node
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

import { runCommand, runInTmpDir } from '../../testUtil.ts'
import {
  bestOfOverlappingHmmerHits,
  evalueScore,
  findTranscript,
  parseCall,
  projectResidues,
  readCodingTranscripts,
} from './project.ts'

const gff3 = `##gff-version 3
ctgA\t.\tmRNA\t101\t230\t.\t+\t.\tID=rna-XM_1.1
ctgA\t.\tCDS\t201\t230\t.\t+\t0\tID=cds-XP_1.1;Parent=rna-XM_1.1;protein_id=XP_1.1
ctgA\t.\tCDS\t101\t130\t.\t+\t0\tID=cds-XP_1.1;Parent=rna-XM_1.1;protein_id=XP_1.1
ctgA\t.\tCDS\t301\t330\t.\t-\t0\tParent=minus
ctgA\t.\tCDS\t401\t430\t.\t-\t0\tParent=minus
ctgB\t.\tCDS\t11\t40\t.\t+\t1\tParent=partial
`

test('reads CDS parts and matches a protein by any of its names', async () => {
  await runInTmpDir(async () => {
    fs.writeFileSync('genes.gff3', gff3)
    const { lookup, transcripts } = await readCodingTranscripts('genes.gff3')
    expect(transcripts).toBe(3)
    const ncbi = findTranscript(lookup, 'XP_1.1')!
    expect(ncbi.id).toBe('rna-XM_1.1')
    // residues 8..14 are CDS bases 21..42: 9 in the first part, 12 in the second
    expect(projectResidues(ncbi, 8, 14)).toEqual([
      { start: 121, end: 130 },
      { start: 200, end: 212 },
    ])
    expect(findTranscript(lookup, 'XM_1')).toBe(ncbi)
    // a minus-strand CDS translates from its rightmost part
    expect(projectResidues(findTranscript(lookup, 'minus')!, 1, 12)).toEqual([
      { start: 324, end: 330 },
      { start: 400, end: 430 },
    ])
    // the leading phase base belongs to no residue
    expect(projectResidues(findTranscript(lookup, 'partial')!, 1, 1)).toEqual([
      { start: 11, end: 14 },
    ])
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

// rows from interproscan6's own tests/data/output/test.faa.tsv.gz: 15 columns,
// `-` for a missing score or InterPro entry
test('reads an InterProScan TSV row', () => {
  const pfam =
    'sp|Q9QXX0|JAG1_MOUSE\t0001C5D32DCCB8E03267C370872E1694\t1218\tPfam\tPF07657\tN terminus of Notch ligand C2-like domain\t32\t185\t9.0E-55\tPfam\t12-04-2026\tIPR011651\tNotch ligand, N-terminal domain\t-\t-'
  expect(parseCall(pfam, () => false)).toEqual({
    protein: 'sp|Q9QXX0|JAG1_MOUSE',
    start: 32,
    end: 185,
    accession: 'PF07657',
    name: 'N terminus of Notch ligand C2-like domain',
    description: 'Notch ligand, N-terminal domain',
    source: 'Pfam',
    evalue: '9.0E-55',
  })
  const noScore =
    'sp|Q9QXX0|JAG1_MOUSE\t0001C5D32DCCB8E03267C370872E1694\t1218\tPROSITE patterns\tPS00010\tAspartic acid and asparagine hydroxylation site\t389\t400\t-\tPROSITE patterns\t12-04-2026\tIPR000152\tEGF-type aspartate/asparagine hydroxylation site\t-\t-'
  expect(parseCall(noScore, () => false)).toMatchObject({
    start: 389,
    end: 400,
    evalue: '-',
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
        50,
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

test('the best of overlapping HMMER hits wins; InterProScan calls pass through', () => {
  const hit = (name: string, start: number, end: number, evalue: string) => ({
    protein: 'p',
    start,
    end,
    accession: name,
    name,
    description: '',
    source: 'HMMER',
    evalue,
  })
  const kept = bestOfOverlappingHmmerHits([
    hit('SH3_1', 10, 60, '1e-10'),
    hit('SH3_2', 12, 62, '1e-12'),
    hit('SH2', 58, 150, '1e-5'),
    { ...hit('PF1', 10, 60, '1'), source: 'Pfam' },
  ])
  expect(kept.map(k => k.name).sort()).toEqual(['PF1', 'SH2', 'SH3_2'])
})

test('the BED score is ten times -log10(E), within 0..1000', () => {
  expect(evalueScore('1e-50')).toBe(500)
  expect(evalueScore('0')).toBe(1000)
  expect(evalueScore('2')).toBe(0)
  expect(evalueScore('-')).toBe(0)
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
