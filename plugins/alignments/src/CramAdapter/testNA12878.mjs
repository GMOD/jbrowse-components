/**
 * Standalone test: verify NA12878 exome CRAM produces valid mismatch bases.
 *
 * Run with: node plugins/alignments/src/CramAdapter/testNA12878.mjs
 *
 * This tests the @gmod/cram library directly with the real NA12878 CRAM file.
 * We skip reference sequence fetching (seqFetch returns '') to reproduce
 * the production bug where rf.sub is undefined.
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Resolve through pnpm's node_modules
const { RemoteFile } = require('generic-filehandle2')
const { IndexedCramFile, CraiIndex } = require('@gmod/cram')

async function main() {
  // First test: WITHOUT seqFetch returning sequence (reproduces the bug)
  console.log('=== Test 1: No reference sequence (reproduces production bug) ===')
  const cramNoRef = new IndexedCramFile({
    cramFilehandle: new RemoteFile(
      'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
    ),
    index: new CraiIndex({
      filehandle: new RemoteFile(
        'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram.crai',
      ),
    }),
    seqFetch: async (_seqId, _start, _end) => '',
    checkSequenceMD5: false,
  })

  const header = await cramNoRef.cram.getSamHeader()
  const sqLines = header.filter(h => h.tag === 'SQ')
  console.log(
    'CRAM @SQ names (first 25):',
    sqLines.slice(0, 25).map(h => h.data.find(d => d.tag === 'SN')?.value),
  )

  const chr11Idx = sqLines.findIndex(h =>
    h.data.some(d => d.tag === 'SN' && (d.value === '11' || d.value === 'chr11')),
  )
  const chr11Name = sqLines[chr11Idx]?.data.find(d => d.tag === 'SN')?.value
  console.log(`chr11 seqId in CRAM: ${chr11Idx} (name="${chr11Name}")`)

  console.log('\nFetching records for chr11:5,225,464-5,225,700 (no ref)...')
  const recordsNoRef = await cramNoRef.getRecordsForRange(
    chr11Idx,
    5225464,
    5225700,
  )
  console.log(`Got ${recordsNoRef.length} records`)

  let totalX = 0
  let missingSubCount = 0
  for (const record of recordsNoRef) {
    if (!record.readFeatures) continue
    for (const rf of record.readFeatures) {
      if (rf.code === 'X') {
        totalX++
        if (!rf.sub) {
          missingSubCount++
        }
      }
    }
  }
  console.log(
    `No-ref results: ${totalX} X features, ${missingSubCount} missing sub`,
  )
  if (totalX > 0 && missingSubCount === totalX) {
    console.log('CONFIRMED: without ref sequence, ALL X features have missing sub (this is the bug)')
  }

  // Second test: WITH proper seqFetch using the FASTA
  console.log('\n=== Test 2: With reference sequence (should fix the bug) ===')

  // Build CRAM seqId -> FASTA refName mapping using the SAM header names
  // The CRAM has chr-prefixed names (chr1, chr11, etc.)
  // The FASTA has non-prefixed names (1, 11, etc.)
  // So we need to strip the 'chr' prefix when calling the FASTA
  const cramSeqNames = sqLines.map(h => h.data.find(d => d.tag === 'SN')?.value)
  console.log('CRAM seqNames (first 5):', cramSeqNames.slice(0, 5))

  // Simulate what JBrowse seqFetch does: use the CRAM SAM header name
  // to fetch from the FASTA. This demonstrates the name mismatch bug.
  console.log('\n--- Demonstrating the name mismatch ---')
  console.log(`CRAM seqId ${chr11Idx} = "${cramSeqNames[chr11Idx]}"`)
  console.log(`If seqFetch asks FASTA for "${cramSeqNames[chr11Idx]}", it will get the WRONG chromosome or nothing`)

  // Now use the correct mapping (strip chr prefix)
  const cramWithRef = new IndexedCramFile({
    cramFilehandle: new RemoteFile(
      'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
    ),
    index: new CraiIndex({
      filehandle: new RemoteFile(
        'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram.crai',
      ),
    }),
    seqFetch: async (seqId, start, end) => {
      // Use the IndexedFasta from the pnpm resolved path
      const { IndexedFasta: IF } = require(
        require.resolve('@gmod/indexedfasta', {
          paths: [process.cwd() + '/node_modules/.pnpm/@gmod+indexedfasta@5.0.2/node_modules'],
        }),
      )
      const fasta = new IF({
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
      // Strip chr prefix to match the FASTA naming convention
      const cramName = cramSeqNames[seqId]
      const fastaName = cramName?.replace(/^chr/, '')
      console.log(`  seqFetch: seqId=${seqId} cramName="${cramName}" -> fastaName="${fastaName}" range=${start}-${end}`)
      if (!fastaName) return ''
      const seq = await fasta.getSequence(fastaName, start - 1, end)
      console.log(`  seqFetch result: ${seq ? seq.length : 'undefined'} bases`)
      return seq ?? ''
    },
    checkSequenceMD5: false,
  })

  console.log('\nFetching records for chr11:5,225,464-5,225,700 (with ref)...')
  const recordsWithRef = await cramWithRef.getRecordsForRange(
    chr11Idx,
    5225464,
    5225700,
  )
  console.log(`Got ${recordsWithRef.length} records`)

  let totalX2 = 0
  let missingSubCount2 = 0
  for (const record of recordsWithRef) {
    if (!record.readFeatures) continue
    for (const rf of record.readFeatures) {
      if (rf.code === 'X') {
        totalX2++
        if (!rf.sub) {
          missingSubCount2++
          console.log(`  STILL MISSING sub: data=${rf.data} ref=${rf.ref} refPos=${rf.refPos}`)
        }
      }
    }
  }
  console.log(
    `With-ref results: ${totalX2} X features, ${missingSubCount2} missing sub`,
  )
  if (missingSubCount2 === 0 && totalX2 > 0) {
    console.log('PASS: with correct ref sequence, all X features have valid sub')
  } else if (missingSubCount2 > 0) {
    console.log('FAIL: some X features still missing sub even with ref sequence')
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
