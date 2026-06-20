import { readFileSync } from 'fs'
import { join } from 'path'
import { gunzipSync } from 'zlib'

import { convertCodingSequenceToPeptides } from './convertCodingSequenceToPeptides.ts'
import { getGeneticCode, parseTranslTable } from './geneticCodes.ts'

// Real NCBI human mitochondrion (NC_012920.1) GFF3 + sequence committed under
// test_data/human_mito. Every CDS carries transl_table=2 (vertebrate
// mitochondrial), which exercises the codons that diverge from the standard
// code. mito.gff.gz / sequence.fasta.gz are single-block bgzip, so a plain
// gunzip recovers the whole record here.
const dir = join(__dirname, '../../../../test_data/human_mito')

function readGz(name: string) {
  return gunzipSync(readFileSync(join(dir, name))).toString('utf8')
}

// the single contiguous CDS for a named gene (the mito protein genes are
// intron-less), as a 1-based GFF record
function cdsForGene(gff: string, gene: string) {
  const line = gff
    .split('\n')
    .find(l => l.split('\t')[2] === 'CDS' && l.includes(`gene=${gene};`))!
  const cols = line.split('\t')
  const attrs = Object.fromEntries(
    cols[8]!.split(';').map(kv => kv.split('=') as [string, string]),
  )
  return {
    start: Number(cols[3]),
    end: Number(cols[4]),
    strand: cols[6],
    phase: Number(cols[7]),
    translTable: attrs.transl_table,
  }
}

const genome = readGz('sequence.fasta.gz')
  .split('\n')
  .filter(l => !l.startsWith('>'))
  .join('')
const gff = readGz('mito.gff.gz')

function translateGene(gene: string, table: number) {
  const cds = cdsForGene(gff, gene)
  // ND1 etc are on the + strand; slice the genomic CDS (GFF is 1-based inclusive)
  const sequence = genome.slice(cds.start - 1, cds.end)
  return convertCodingSequenceToPeptides({
    cds: [{ start: 0, end: sequence.length, phase: cds.phase }],
    sequence,
    codonTable: getGeneticCode(table).codonTable,
  })
}

describe('human mito GFF translation (transl_table=2)', () => {
  it('reads transl_table=2 off the CDS', () => {
    expect(parseTranslTable(cdsForGene(gff, 'ND1').translTable)).toBe(2)
  })

  it('ND1 translates to its real N-terminus only under the mito code', () => {
    // MT-ND1 begins MPMANLLLL...; the first codon is ATA, which is Met in the
    // mitochondrial code but Ile in the standard code
    expect(translateGene('ND1', 2).startsWith('MPMANLLLL')).toBe(true)
    expect(translateGene('ND1', 1).startsWith('IPMANLLLL')).toBe(true)
  })

  it('the standard code introduces spurious internal stops (TGA=Trp in mito)', () => {
    const countStops = (s: string) => s.slice(0, -1).split('*').length - 1
    // COX1 is Trp-rich; under the standard code every mitochondrial TGA reads as
    // a premature stop, so the standard translation is riddled with them
    expect(countStops(translateGene('COX1', 1))).toBeGreaterThan(0)
    expect(countStops(translateGene('COX1', 2))).toBe(0)
  })
})
