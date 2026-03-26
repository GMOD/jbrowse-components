/**
 * Standalone test: verify NA12878 exome CRAM produces valid mismatch bases.
 * Run with: node --experimental-strip-types plugins/alignments/src/CramAdapter/testNA12878.ts
 */
import { RemoteFile } from 'generic-filehandle2'
import { IndexedCramFile, CraiIndex } from '@gmod/cram'
import { IndexedFasta } from '@gmod/indexedfasta'

async function main() {
  const fasta = new IndexedFasta({
    fasta: new RemoteFile(
      'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    ),
    fai: new RemoteFile(
      'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai',
    ),
    gzi: new RemoteFile(
      'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi',
    ),
  })
  const seqNames = await fasta.getSequenceList()
  console.log('FASTA seqNames (first 25):', seqNames.slice(0, 25))

  const cram = new IndexedCramFile({
    cramFilehandle: new RemoteFile(
      'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
    ),
    index: new CraiIndex({
      filehandle: new RemoteFile(
        'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram.crai',
      ),
    }),
    seqFetch: async (seqId: number, start: number, end: number) => {
      const refName = seqNames[seqId]
      console.log(
        `  seqFetch: seqId=${seqId} refName=${refName} range=${start}-${end}`,
      )
      if (!refName) {
        throw new Error(`no FASTA sequence for seqId ${seqId}`)
      }
      const seq = await fasta.getSequence(refName, start - 1, end)
      console.log(`  seqFetch result: ${seq ? seq.length : 'undefined'} bases`)
      return seq ?? ''
    },
    checkSequenceMD5: false,
  })

  // Parse SAM header to find chr11 seqId
  const header = await cram.cram.getSamHeader()
  const sqLines = header.filter(h => h.tag === 'SQ')
  console.log(
    'CRAM @SQ names (first 25):',
    sqLines.slice(0, 25).map(h => h.data.find(d => d.tag === 'SN')?.value),
  )

  const chr11Idx = sqLines.findIndex(h =>
    h.data.some(d => d.tag === 'SN' && d.value === '11'),
  )
  console.log(`chr11 seqId in CRAM: ${chr11Idx}`)
  console.log(`chr11 in FASTA seqNames: "${seqNames[chr11Idx]}"`)

  // Fetch a region on chr11 with known exome coverage
  console.log('\nFetching records for chr11:5,225,464-5,225,700...')
  const records = await cram.getRecordsForRange(chr11Idx, 5225464, 5225700)
  console.log(`Got ${records.length} records`)

  let totalX = 0
  let missingSubCount = 0
  const validBases = new Set(['A', 'C', 'G', 'T', 'N', 'a', 'c', 'g', 't', 'n'])
  for (const record of records) {
    if (!record.readFeatures) {
      continue
    }
    for (const rf of record.readFeatures) {
      if (rf.code === 'X') {
        totalX++
        const xrf = rf as { sub?: string; ref?: string; data: number }
        if (!xrf.sub) {
          missingSubCount++
          console.log(
            `  MISSING sub: data=${xrf.data} ref=${xrf.ref} refPos=${rf.refPos}`,
          )
        } else if (!validBases.has(xrf.sub)) {
          console.log(
            `  INVALID sub: "${xrf.sub}" data=${xrf.data} ref=${xrf.ref}`,
          )
        }
      }
    }
  }
  console.log(`\nResults: ${totalX} X features, ${missingSubCount} missing sub`)
  if (missingSubCount > 0) {
    console.log('FAIL: some X features have missing sub field')
    process.exit(1)
  } else if (totalX > 0) {
    console.log('PASS: all X features have valid sub bases')
  } else {
    console.log('WARN: no X features found in this region')
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
