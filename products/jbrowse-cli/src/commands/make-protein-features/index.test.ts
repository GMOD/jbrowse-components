/**
 * @jest-environment node
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

import { runCommand, runInTmpDir } from '../../testUtil.ts'

// Placement itself is domains2genome's, tested there; these run the command
// through bgzip and tabix.
const gff3 = `##gff-version 3
ctgA\t.\tmRNA\t101\t230\t.\t+\t.\tID=rna-XM_1.1
ctgA\t.\tCDS\t201\t230\t.\t+\t0\tID=cds-XP_1.1;Parent=rna-XM_1.1;protein_id=XP_1.1
ctgA\t.\tCDS\t101\t130\t.\t+\t0\tID=cds-XP_1.1;Parent=rna-XM_1.1;protein_id=XP_1.1
ctgA\t.\tCDS\t301\t330\t.\t-\t0\tParent=minus
ctgA\t.\tCDS\t401\t430\t.\t-\t0\tParent=minus
ctgB\t.\tCDS\t11\t40\t.\t+\t1\tParent=partial
`

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
