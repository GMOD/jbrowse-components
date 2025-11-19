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

// Create synthetic test data that mimics real longread CRAM data
function generateTestData() {
  const testCases = []

  // Create reference sequence
  const bases = ['A', 'C', 'G', 'T']
  const refLen = 50000
  let refSeq = ''
  for (let i = 0; i < refLen; i++) {
    refSeq += bases[Math.floor(Math.random() * 4)]
  }

  // Generate reads with various features
  for (let readNum = 0; readNum < 1000; readNum++) {
    const alignmentStart = 1000 + Math.floor(Math.random() * 10000)
    const readLen = 5000 + Math.floor(Math.random() * 10000)
    const readFeatures = []

    let pos = alignmentStart
    const numFeatures = 50 + Math.floor(Math.random() * 100)

    for (let i = 0; i < numFeatures; i++) {
      pos += 50 + Math.floor(Math.random() * 100)
      const rand = Math.random()

      if (rand < 0.4) {
        // Substitution (most common)
        readFeatures.push({
          code: 'X',
          refPos: pos,
          sub: bases[Math.floor(Math.random() * 4)],
          data: null
        })
      } else if (rand < 0.6) {
        // Deletion
        readFeatures.push({
          code: 'D',
          refPos: pos,
          sub: null,
          data: 1 + Math.floor(Math.random() * 5)
        })
      } else if (rand < 0.75) {
        // Insertion
        let insData = ''
        const insLen = 1 + Math.floor(Math.random() * 5)
        for (let j = 0; j < insLen; j++) {
          insData += bases[Math.floor(Math.random() * 4)]
        }
        readFeatures.push({
          code: 'I',
          refPos: pos,
          sub: null,
          data: insData
        })
      } else if (rand < 0.85) {
        // Skip
        readFeatures.push({
          code: 'N',
          refPos: pos,
          sub: null,
          data: 100 + Math.floor(Math.random() * 500)
        })
      } else {
        // Soft clip
        let clipData = ''
        const clipLen = 5 + Math.floor(Math.random() * 20)
        for (let j = 0; j < clipLen; j++) {
          clipData += bases[Math.floor(Math.random() * 4)]
        }
        readFeatures.push({
          code: 'S',
          refPos: pos,
          sub: null,
          data: clipData
        })
      }
    }

    testCases.push({
      readFeatures,
      alignmentStart,
      readLen,
      refRegion: {
        seq: refSeq,
        start: 0
      }
    })
  }

  return testCases
}

function runBenchmark() {
  console.log('Generating synthetic test data...')
  const testData = generateTestData()
  const iterations = 50

  console.log('')
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
  for (let i = 0; i < Math.min(100, testData.length); i++) {
    const data = testData[i]
    const oldResult = readFeaturesToCIGAR_OLD(data.readFeatures, data.alignmentStart, data.readLen, data.refRegion)
    const newResult = readFeaturesToCIGAR_NEW(data.readFeatures, data.alignmentStart, data.readLen, data.refRegion)
    if (oldResult !== newResult) {
      console.log('❌ MISMATCH FOUND at index', i)
      console.log('Old:', oldResult.slice(0, 100))
      console.log('New:', newResult.slice(0, 100))
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

runBenchmark()
