/* eslint-disable no-console */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const snapshotsDir = path.resolve(__dirname, '__snapshots__')

const BACKENDS = ['webgl', 'webgpu', 'canvas2d'] as const

function getBackendSnapshots(backend: string) {
  const dir = path.join(snapshotsDir, backend)
  if (!fs.existsSync(dir)) {
    return null
  }
  return {
    dir,
    files: new Set(
      fs
        .readdirSync(dir)
        .filter(f => f.endsWith('.png') && !f.includes('.diff')),
    ),
  }
}

function comparePair(
  nameA: string,
  dirA: string,
  nameB: string,
  dirB: string,
  filesA: Set<string>,
  filesB: Set<string>,
  diffDir: string,
) {
  const common = [...filesA].filter(f => filesB.has(f))
  const onlyA = [...filesA].filter(f => !filesB.has(f))
  const onlyB = [...filesB].filter(f => !filesA.has(f))

  console.log(
    `\n  Comparing ${common.length} snapshots: ${nameA} vs ${nameB}`,
  )

  if (onlyA.length > 0) {
    console.log(`    ${nameA} only: ${onlyA.join(', ')}`)
  }
  if (onlyB.length > 0) {
    console.log(`    ${nameB} only: ${onlyB.join(', ')}`)
  }

  let identical = 0
  let similar = 0
  let different = 0

  for (const file of common.sort()) {
    const bufA = fs.readFileSync(path.join(dirA, file))
    const bufB = fs.readFileSync(path.join(dirB, file))

    const imgA = PNG.sync.read(bufA)
    const imgB = PNG.sync.read(bufB)

    if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
      console.log(
        `    ⚠  ${file}: size differs (${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height})`,
      )
      different++
      continue
    }

    const { width, height } = imgA
    const diffImg = new PNG({ width, height })
    const numDiffPixels = pixelmatch(
      imgA.data,
      imgB.data,
      diffImg.data,
      width,
      height,
      { threshold: 0.1 },
    )

    const totalPixels = width * height
    const diffPercent = (numDiffPixels / totalPixels) * 100

    if (diffPercent === 0) {
      console.log(`    ✓  ${file}: identical`)
      identical++
    } else if (diffPercent < 5) {
      console.log(`    ~  ${file}: ${diffPercent.toFixed(2)}% drift`)
      similar++
      fs.writeFileSync(
        path.join(diffDir, `${nameA}-vs-${nameB}-${file.replace('.png', '.diff.png')}`),
        PNG.sync.write(diffImg),
      )
    } else {
      console.log(`    ✗  ${file}: ${diffPercent.toFixed(2)}% drift`)
      different++
      fs.writeFileSync(
        path.join(diffDir, `${nameA}-vs-${nameB}-${file.replace('.png', '.diff.png')}`),
        PNG.sync.write(diffImg),
      )
    }
  }

  return { identical, similar, different }
}

function run() {
  const available = BACKENDS.map(b => ({
    name: b,
    data: getBackendSnapshots(b),
  })).filter(b => b.data !== null)

  if (available.length < 2) {
    console.error(
      `Need at least 2 backend snapshot directories. Found: ${available.map(b => b.name).join(', ') || 'none'}`,
    )
    console.error(
      'Run tests with --backend=webgl, --backend=webgpu, and/or --backend=canvas2d first.',
    )
    process.exit(1)
  }

  const diffDir = path.join(snapshotsDir, 'backend-diffs')
  if (!fs.existsSync(diffDir)) {
    fs.mkdirSync(diffDir, { recursive: true })
  }

  console.log(
    `\nBackend snapshot comparison (${available.map(b => b.name).join(', ')})`,
  )

  let totalIdentical = 0
  let totalSimilar = 0
  let totalDifferent = 0

  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const a = available[i]!
      const b = available[j]!
      const { identical, similar, different } = comparePair(
        a.name,
        a.data!.dir,
        b.name,
        b.data!.dir,
        a.data!.files,
        b.data!.files,
        diffDir,
      )
      totalIdentical += identical
      totalSimilar += similar
      totalDifferent += different
    }
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`  Identical: ${totalIdentical}`)
  console.log(`  Similar (<5% drift): ${totalSimilar}`)
  console.log(`  Different (>=5% drift): ${totalDifferent}`)
  console.log(`${'─'.repeat(50)}\n`)

  if (totalSimilar > 0 || totalDifferent > 0) {
    console.log(`Diff images saved to ${diffDir}`)
  }
}

run()
