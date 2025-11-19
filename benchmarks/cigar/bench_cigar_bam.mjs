import { BamFile } from '@gmod/bam'
import { LocalFile } from 'generic-filehandle2'

function parseCigar(cigar) {
  const ops = []
  const re = /(\d+)([MIDNSHPX=])/g
  let match
  while ((match = re.exec(cigar)) !== null) {
    ops.push({ op: match[2], len: parseInt(match[1]) })
  }
  return ops
}

async function loadReads() {
  console.log('Loading BAM file and extracting reads...')

  const bamFile = new BamFile({
    bamFilehandle: new LocalFile('test_data/200x.longread.bam'),
    baiFilehandle: new LocalFile('test_data/200x.longread.bam.bai'),
  })

  const records = await bamFile.getRecordsForRange('chr22_mask', 80630, 83605)

  console.log(`Loaded ${records.length} reads`)

  const testData = []
  for (const record of records) {
    if (record.get('cigar') && record.get('cigar').length > 0) {
      testData.push({
        cigar: record.get('cigar'),
      })
    }
  }

  console.log(`Extracted ${testData.length} reads with CIGAR for testing\n`)
  return testData
}

async function runBenchmark() {
  const testData = await loadReads()
  const iterations = 100

  console.log('━'.repeat(60))
  console.log('🔬 Benchmarking CIGAR parsing (BAM)')
  console.log('━'.repeat(60))
  console.log(`Iterations: ${iterations}`)
  console.log(`Test cases: ${testData.length}`)
  console.log(`Total function calls: ${iterations * testData.length}`)
  console.log('')

  for (const data of testData) {
    parseCigar(data.cigar)
  }

  console.log('Running CIGAR parsing benchmark...')
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    for (const data of testData) {
      parseCigar(data.cigar)
    }
  }
  const end = performance.now()
  const time = end - start

  console.log('')
  console.log('━'.repeat(60))
  console.log('📊 RESULTS')
  console.log('━'.repeat(60))
  console.log(`Total time: ${time.toFixed(2)}ms`)
  console.log(
    `Avg time per call: ${(time / (iterations * testData.length)).toFixed(4)}ms`,
  )
  console.log('━'.repeat(60))
}

runBenchmark().catch(console.error)
