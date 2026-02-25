/* eslint-disable no-console */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const snapshotsDir = path.resolve(__dirname, '__snapshots__')

const webglDir = path.join(snapshotsDir, 'webgl')
const webgpuDir = path.join(snapshotsDir, 'webgpu')
const diffDir = path.join(snapshotsDir, 'backend-diffs')

function run() {
  if (!fs.existsSync(webglDir)) {
    console.error(
      'No webgl snapshots found. Run tests with --backend=webgl first.',
    )
    process.exit(1)
  }
  if (!fs.existsSync(webgpuDir)) {
    console.error(
      'No webgpu snapshots found. Run tests with --backend=webgpu first.',
    )
    process.exit(1)
  }

  if (!fs.existsSync(diffDir)) {
    fs.mkdirSync(diffDir, { recursive: true })
  }

  const webglFiles = fs
    .readdirSync(webglDir)
    .filter(f => f.endsWith('.png') && !f.includes('.diff'))
  const webgpuFiles = new Set(
    fs
      .readdirSync(webgpuDir)
      .filter(f => f.endsWith('.png') && !f.includes('.diff')),
  )

  const common = webglFiles.filter(f => webgpuFiles.has(f))
  const webglOnly = webglFiles.filter(f => !webgpuFiles.has(f))
  const webgpuOnly = [...webgpuFiles].filter(f => !webglFiles.includes(f))

  console.log(
    `\nComparing ${common.length} snapshots between webgl and webgpu\n`,
  )

  if (webglOnly.length > 0) {
    console.log(`  WebGL only: ${webglOnly.join(', ')}`)
  }
  if (webgpuOnly.length > 0) {
    console.log(`  WebGPU only: ${webgpuOnly.join(', ')}`)
  }
  if (webglOnly.length > 0 || webgpuOnly.length > 0) {
    console.log()
  }

  let identical = 0
  let similar = 0
  let different = 0

  for (const file of common.sort()) {
    const webglBuf = fs.readFileSync(path.join(webglDir, file))
    const webgpuBuf = fs.readFileSync(path.join(webgpuDir, file))

    const webglImg = PNG.sync.read(webglBuf)
    const webgpuImg = PNG.sync.read(webgpuBuf)

    if (
      webglImg.width !== webgpuImg.width ||
      webglImg.height !== webgpuImg.height
    ) {
      console.log(
        `  ⚠  ${file}: size differs (${webglImg.width}x${webglImg.height} vs ${webgpuImg.width}x${webgpuImg.height})`,
      )
      different++
      continue
    }

    const { width, height } = webglImg
    const diffImg = new PNG({ width, height })
    const numDiffPixels = pixelmatch(
      webglImg.data,
      webgpuImg.data,
      diffImg.data,
      width,
      height,
      { threshold: 0.1 },
    )

    const totalPixels = width * height
    const diffPercent = (numDiffPixels / totalPixels) * 100

    if (diffPercent === 0) {
      console.log(`  ✓  ${file}: identical`)
      identical++
    } else if (diffPercent < 5) {
      console.log(`  ~  ${file}: ${diffPercent.toFixed(2)}% drift`)
      similar++
      fs.writeFileSync(
        path.join(diffDir, file.replace('.png', '.diff.png')),
        PNG.sync.write(diffImg),
      )
    } else {
      console.log(`  ✗  ${file}: ${diffPercent.toFixed(2)}% drift`)
      different++
      fs.writeFileSync(
        path.join(diffDir, file.replace('.png', '.diff.png')),
        PNG.sync.write(diffImg),
      )
    }
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`  Identical: ${identical}`)
  console.log(`  Similar (<5% drift): ${similar}`)
  console.log(`  Different (>=5% drift): ${different}`)
  console.log(`${'─'.repeat(50)}\n`)

  if (similar > 0 || different > 0) {
    console.log(`Diff images saved to ${diffDir}`)
  }
}

run()
