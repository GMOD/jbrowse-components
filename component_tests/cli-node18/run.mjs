import { execSync, exec } from 'child_process'
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  existsSync,
  createReadStream,
  statSync,
} from 'fs'
import { createServer } from 'http'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { gzip } from 'zlib'

const gzipAsync = promisify(gzip)

let failures = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    console.error(`  ${error.message}`)
    failures++
  }
}

async function testAsync(name, fn) {
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    console.error(`  ${error.message}`)
    failures++
  }
}

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
}

// Test --help
test('jbrowse --help shows usage', () => {
  const output = run('npx jbrowse --help')
  if (!output.includes('USAGE')) {
    throw new Error('Expected USAGE in help output')
  }
  if (!output.includes('COMMANDS')) {
    throw new Error('Expected COMMANDS in help output')
  }
})

// Test --version
test('jbrowse --version shows version', () => {
  const output = run('npx jbrowse --version')
  if (!output.includes('@jbrowse/cli version')) {
    throw new Error('Expected version output')
  }
})

// Test unknown command
test('jbrowse unknown-command shows error', () => {
  try {
    run('npx jbrowse unknown-command')
    throw new Error('Expected command to fail')
  } catch (error) {
    if (!error.stderr.includes('Unknown command')) {
      throw new Error('Expected "Unknown command" in error output')
    }
  }
})

// Test sort-gff --help
test('jbrowse sort-gff --help shows usage', () => {
  const output = run('npx jbrowse sort-gff --help')
  if (!output.includes('sort-gff')) {
    throw new Error('Expected sort-gff in help output')
  }
})

// Test sort-bed --help
test('jbrowse sort-bed --help shows usage', () => {
  const output = run('npx jbrowse sort-bed --help')
  if (!output.includes('sort-bed')) {
    throw new Error('Expected sort-bed in help output')
  }
})

// Test sort-gff with actual data
test('jbrowse sort-gff sorts GFF data correctly', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jbrowse-cli-test-'))
  try {
    const inputGff = `##gff-version 3
ctgA\ttest\tgene\t1000\t2000\t.\t+\t.\tID=gene1
ctgA\ttest\tgene\t100\t200\t.\t+\t.\tID=gene2
ctgB\ttest\tgene\t500\t600\t.\t+\t.\tID=gene3
`
    const inputFile = join(tmpDir, 'input.gff3')
    writeFileSync(inputFile, inputGff)

    const output = run(`npx jbrowse sort-gff ${inputFile}`)
    const lines = output
      .trim()
      .split('\n')
      .filter(l => !l.startsWith('#'))

    // Check that ctgA 100-200 comes before ctgA 1000-2000
    const gene2Index = lines.findIndex(l => l.includes('gene2'))
    const gene1Index = lines.findIndex(l => l.includes('gene1'))
    if (gene2Index > gene1Index) {
      throw new Error('Expected gene2 to come before gene1 after sorting')
    }
  } finally {
    rmSync(tmpDir, { recursive: true })
  }
})

// Test sort-bed with actual data
test('jbrowse sort-bed sorts BED data correctly', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jbrowse-cli-test-'))
  try {
    const inputBed = `ctgA\t1000\t2000\tfeature1
ctgA\t100\t200\tfeature2
ctgB\t500\t600\tfeature3
`
    const inputFile = join(tmpDir, 'input.bed')
    writeFileSync(inputFile, inputBed)

    const output = run(`npx jbrowse sort-bed ${inputFile}`)
    const lines = output.trim().split('\n')

    // Check that ctgA 100-200 comes before ctgA 1000-2000
    const feature2Index = lines.findIndex(l => l.includes('feature2'))
    const feature1Index = lines.findIndex(l => l.includes('feature1'))
    if (feature2Index > feature1Index) {
      throw new Error('Expected feature2 to come before feature1 after sorting')
    }
  } finally {
    rmSync(tmpDir, { recursive: true })
  }
})

// Test text-index with remote gzipped GFF3 file via HTTP server
await testAsync(
  'jbrowse text-index indexes remote gzipped GFF3 file',
  async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'jbrowse-cli-test-'))

    // Create a sample GFF3 content and gzip it
    const gffContent = `##gff-version 3
ctgA\ttest\tgene\t1000\t2000\t.\t+\t.\tID=gene1;Name=TestGene1
ctgA\ttest\tgene\t3000\t4000\t.\t+\t.\tID=gene2;Name=TestGene2
ctgA\ttest\tgene\t5000\t6000\t.\t+\t.\tID=gene3;Name=TestGene3
`
    const gzippedContent = await gzipAsync(Buffer.from(gffContent))
    const gzFile = join(tmpDir, 'test.gff3.gz')
    writeFileSync(gzFile, gzippedContent)

    // Create HTTP server to serve the gzipped file
    const server = createServer((req, res) => {
      console.log(`[SERVER] Received request: ${req.method} ${req.url}`)
      if (req.url === '/test.gff3.gz') {
        const stat = statSync(gzFile)
        console.log(`[SERVER] Serving file, size: ${stat.size} bytes`)
        res.writeHead(200, {
          'Content-Type': 'application/gzip',
          'Content-Length': stat.size,
        })
        const fileStream = createReadStream(gzFile)
        fileStream.on('end', () => {
          console.log('[SERVER] File stream ended')
        })
        fileStream.on('error', err => {
          console.log('[SERVER] File stream error:', err)
        })
        fileStream.pipe(res)
        res.on('finish', () => {
          console.log('[SERVER] Response finished')
        })
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    try {
      // Start server on random available port
      await new Promise(resolve => {
        server.listen(0, () => resolve())
      })
      const addr = server.address()
      const port = addr.port
      console.log(`[TEST] Server listening on port ${port}`)

      const outDir = join(tmpDir, 'indexes')

      // Run text-index command against the remote file
      // NOTE: Must use async exec, not execSync, because execSync blocks the event loop
      // and prevents the HTTP server from responding to requests
      console.log(`[TEST] Running text-index command...`)
      const cmd = `npx jbrowse text-index --file http://localhost:${port}/test.gff3.gz --out ${outDir} --quiet`
      console.log(`[TEST] Command: ${cmd}`)
      const { stdout, stderr } = await new Promise((resolve, reject) => {
        exec(cmd, { encoding: 'utf8', timeout: 60000 }, (error, stdout, stderr) => {
          if (error) {
            console.log(`[TEST] Command stderr: ${stderr}`)
            console.log(`[TEST] Command stdout: ${stdout}`)
            reject(error)
          } else {
            resolve({ stdout, stderr })
          }
        })
      })
      console.log(`[TEST] Command stdout: ${stdout}`)
      console.log(`[TEST] Command stderr: ${stderr}`)
      console.log(`[TEST] Command completed`)

      // Check that index files were created
      // The command creates .ix and .ixx files
      const ixFile = join(outDir, 'trix', 'test.gff3.gz.ix')
      const ixxFile = join(outDir, 'trix', 'test.gff3.gz.ixx')

      if (!existsSync(ixFile)) {
        throw new Error(`Expected index file to be created at ${ixFile}`)
      }
      if (!existsSync(ixxFile)) {
        throw new Error(`Expected ixx file to be created at ${ixxFile}`)
      }
    } finally {
      server.close()
      rmSync(tmpDir, { recursive: true })
    }
  },
)

console.log(
  `\n${failures === 0 ? 'All tests passed!' : `${failures} test(s) failed`}`,
)
process.exit(failures === 0 ? 0 : 1)
