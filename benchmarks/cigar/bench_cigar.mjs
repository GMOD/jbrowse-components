import { CramFile } from '@gmod/cram'
import { IndexedFasta } from '@gmod/indexedfasta'
import { LocalFile } from 'generic-filehandle2'

// Old implementation with string concatenation
function readFeaturesToCIGAR_OLD(readFeatures, alignmentStart, readLen, refRegion) {
  let seq = ''
  let cigar = ''
  let op = 'M'
  let oplen = 0
  if (!refRegion) {
    return ''
  }
  const ref = refRegion.seq
  const refStart = refRegion.start
  let lastPos = alignmentStart
  let sublen = 0
  let insLen = 0
  if (readFeatures !== undefined) {
    for (const { code, refPos, sub, data } of readFeatures) {
      sublen = refPos - lastPos
      seq += ref.slice(lastPos - refStart, refPos - refStart)
      lastPos = refPos

      if (insLen > 0 && sublen) {
        cigar += `${insLen}I`
        insLen = 0
      }
      if (oplen && op !== 'M') {
        cigar += `${oplen}${op}`
        oplen = 0
      }
      if (sublen) {
        op = 'M'
        oplen += sublen
      }

      if (code === 'b') {
        const ret = data.split(',')
        const added = String.fromCharCode(...ret)
        seq += added
        lastPos += added.length
        oplen += added.length
      } else if (code === 'B') {
        seq += sub
        lastPos++
        oplen++
      } else if (code === 'X') {
        seq += sub
        lastPos++
        oplen++
      } else if (code === 'D' || code === 'N') {
        lastPos += data
        if (oplen) {
          cigar += `${oplen}${op}`
        }
        cigar += data + code
        oplen = 0
      } else if (code === 'I' || code === 'S') {
        seq += data
        if (oplen) {
          cigar += `${oplen}${op}`
        }
        cigar += data.length + code
        oplen = 0
      } else if (code === 'i') {
        if (oplen) {
          cigar += `${oplen}${op}`
        }
        insLen++
        seq += data
        oplen = 0
      } else if (code === 'P') {
        if (oplen) {
          cigar += `${oplen}${op}`
        }
        cigar += `${data}P`
      } else if (code === 'H') {
        if (oplen) {
          cigar += `${oplen}${op}`
        }
        cigar += `${data}H`
        oplen = 0
      }
    }
  } else {
    sublen = readLen - seq.length
  }
  if (seq.length !== readLen) {
    sublen = readLen - seq.length
    seq += ref.slice(lastPos - refStart, lastPos - refStart + sublen)

    if (oplen && op !== 'M') {
      cigar += `${oplen}${op}`
      oplen = 0
    }
    op = 'M'
    oplen += sublen
  }
  if (sublen && insLen > 0) {
    cigar += `${insLen}I`
  }
  if (oplen) {
    cigar += `${oplen}${op}`
  }

  return cigar
}

// New implementation with array building
function readFeaturesToCIGAR_NEW(readFeatures, alignmentStart, readLen, refRegion) {
  if (!refRegion) {
    return ''
  }

  const cigarParts = []

  let op = 'M'
  let oplen = 0
  const refStart = refRegion.start
  let lastPos = alignmentStart
  let sublen = 0
  let insLen = 0
  let seqLength = 0

  if (readFeatures !== undefined) {
    const featuresLength = readFeatures.length
    for (let i = 0; i < featuresLength; i++) {
      const feature = readFeatures[i]
      const { code, refPos, data } = feature
      sublen = refPos - lastPos

      if (sublen > 0) {
        seqLength += sublen
      }
      lastPos = refPos

      if (insLen > 0 && sublen) {
        cigarParts.push(insLen + 'I')
        insLen = 0
      }
      if (oplen && op !== 'M') {
        cigarParts.push(oplen + op)
        oplen = 0
      }
      if (sublen) {
        op = 'M'
        oplen += sublen
      }

      if (code === 'b') {
        const addedLen = data.split(',').length
        seqLength += addedLen
        lastPos += addedLen
        oplen += addedLen
      } else if (code === 'B' || code === 'X') {
        seqLength++
        lastPos++
        oplen++
      } else if (code === 'D' || code === 'N') {
        lastPos += data
        if (oplen) {
          cigarParts.push(oplen + op)
        }
        cigarParts.push(data + code)
        oplen = 0
      } else if (code === 'I' || code === 'S') {
        seqLength += data.length
        if (oplen) {
          cigarParts.push(oplen + op)
        }
        cigarParts.push(data.length + code)
        oplen = 0
      } else if (code === 'i') {
        if (oplen) {
          cigarParts.push(oplen + op)
        }
        insLen++
        seqLength++
        oplen = 0
      } else if (code === 'P') {
        if (oplen) {
          cigarParts.push(oplen + op)
        }
        cigarParts.push(data + 'P')
      } else if (code === 'H') {
        if (oplen) {
          cigarParts.push(oplen + op)
        }
        cigarParts.push(data + 'H')
        oplen = 0
      }
    }
  } else {
    sublen = readLen - seqLength
  }

  if (seqLength !== readLen) {
    sublen = readLen - seqLength

    if (oplen && op !== 'M') {
      cigarParts.push(oplen + op)
      oplen = 0
    }
    op = 'M'
    oplen += sublen
  }
  if (sublen && insLen > 0) {
    cigarParts.push(insLen + 'I')
  }
  if (oplen) {
    cigarParts.push(oplen + op)
  }

  return cigarParts.join('')
}

async function loadReads() {
  console.log('Loading CRAM file and extracting reads...')

  const cramFile = new CramFile({
    cramFilehandle: new LocalFile('test_data/200x.longread.cram'),
    index: new LocalFile('test_data/200x.longread.cram.crai'),
    seqFetch: new IndexedFasta({
      fasta: new LocalFile('test_data/hg19mod.fa'),
      fai: new LocalFile('test_data/hg19mod.fa.fai'),
    }),
  })

  // Get reads from a region
  const records = await cramFile.getRecordsForRange(0, 80630, 83605, {
    viewAsPairs: false,
    pairAcrossChr: false,
  })

  console.log(`Loaded ${records.length} reads`)

  // Extract the data we need for benchmarking
  const testData = []
  for (const record of records) {
    if (record.readFeatures && record.readFeatures.length > 0) {
      const refRegion = {
        seq: await cramFile.seqFetch.getSequence(
          record.sequenceId,
          record.alignmentStart - 100,
          record.alignmentStart + record.readLength + 100
        ),
        start: record.alignmentStart - 100,
      }

      testData.push({
        readFeatures: record.readFeatures,
        alignmentStart: record.alignmentStart,
        readLen: record.readLength,
        refRegion,
      })
    }
  }

  console.log(`Extracted ${testData.length} reads with features for testing\n`)
  return testData
}

async function runBenchmark() {
  const testData = await loadReads()
  const iterations = 100

  console.log('━'.repeat(60))
  console.log('🔬 Benchmarking readFeaturesToCIGAR')
  console.log('━'.repeat(60))
  console.log(`Iterations: ${iterations}`)
  console.log(`Test cases: ${testData.length}`)
  console.log(`Total function calls: ${iterations * testData.length}`)
  console.log('')

  // Warm up
  for (const data of testData) {
    readFeaturesToCIGAR_OLD(data.readFeatures, data.alignmentStart, data.readLen, data.refRegion)
    readFeaturesToCIGAR_NEW(data.readFeatures, data.alignmentStart, data.readLen, data.refRegion)
  }

  // Benchmark OLD implementation
  console.log('Running OLD implementation...')
  const startOld = performance.now()
  for (let i = 0; i < iterations; i++) {
    for (const data of testData) {
      readFeaturesToCIGAR_OLD(data.readFeatures, data.alignmentStart, data.readLen, data.refRegion)
    }
  }
  const endOld = performance.now()
  const timeOld = endOld - startOld

  // Benchmark NEW implementation
  console.log('Running NEW implementation...')
  const startNew = performance.now()
  for (let i = 0; i < iterations; i++) {
    for (const data of testData) {
      readFeaturesToCIGAR_NEW(data.readFeatures, data.alignmentStart, data.readLen, data.refRegion)
    }
  }
  const endNew = performance.now()
  const timeNew = endNew - startNew

  // Verify results are identical
  console.log('\nVerifying correctness...')
  let allMatch = true
  for (const data of testData) {
    const oldResult = readFeaturesToCIGAR_OLD(data.readFeatures, data.alignmentStart, data.readLen, data.refRegion)
    const newResult = readFeaturesToCIGAR_NEW(data.readFeatures, data.alignmentStart, data.readLen, data.refRegion)
    if (oldResult !== newResult) {
      console.log('❌ MISMATCH FOUND!')
      console.log('Old:', oldResult)
      console.log('New:', newResult)
      allMatch = false
      break
    }
  }

  if (allMatch) {
    console.log('✅ All results match!')
  }

  console.log('')
  console.log('━'.repeat(60))
  console.log('📊 RESULTS')
  console.log('━'.repeat(60))
  console.log(`OLD implementation: ${timeOld.toFixed(2)}ms`)
  console.log(`NEW implementation: ${timeNew.toFixed(2)}ms`)
  console.log('')

  const improvement = ((timeOld - timeNew) / timeOld * 100).toFixed(2)
  if (timeNew < timeOld) {
    console.log(`✅ NEW is ${improvement}% FASTER`)
  } else {
    console.log(`❌ NEW is ${Math.abs(improvement)}% SLOWER`)
  }
  console.log('')
  console.log(`Avg time per call (OLD): ${(timeOld / (iterations * testData.length)).toFixed(4)}ms`)
  console.log(`Avg time per call (NEW): ${(timeNew / (iterations * testData.length)).toFixed(4)}ms`)
  console.log('━'.repeat(60))
}

runBenchmark().catch(console.error)
