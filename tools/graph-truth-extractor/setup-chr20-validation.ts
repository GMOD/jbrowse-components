#!/usr/bin/env node
// Setup script for chr20_region GetSubgraph validation
// Generates tabix indices if needed and runs validation tests

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = import.meta.dirname
const REPO_ROOT = resolve(__dirname, '../../..')

function log(msg: string) {
  console.log(msg)
}

function error(msg: string): never {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

async function main() {
  log('=== CHR20 GetSubgraph Validation Setup ===')
  log('')

  const gfaFile = resolve(REPO_ROOT, 'test_data/chr20_region.gfa')
  const tabixTool = resolve(REPO_ROOT, 'tools/gfa-to-tabix/target/release/gfa-to-tabix')

  // Check GFA file
  if (!existsSync(gfaFile)) {
    error(`chr20_region.gfa not found at ${gfaFile}`)
  }
  log(`✓ Found GFA file: ${gfaFile}`)

  // Check gfa-to-tabix
  if (!existsSync(tabixTool)) {
    error(`gfa-to-tabix not built at ${tabixTool}`)
  }
  log(`✓ Found gfa-to-tabix tool`)
  log('')

  // Check if indices exist
  const indexFiles = [
    'test_data/chr20_region.pos.bed.gz',
    'test_data/chr20_region.synteny.bed.gz',
    'test_data/chr20_region.edges.spatial.bed.gz',
    'test_data/chr20_region.seglens.bin',
  ]

  const allExist = indexFiles.every(f => existsSync(resolve(REPO_ROOT, f)))

  if (!allExist) {
    log('⏳ Generating tabix indices from GFA...')
    log('')

    const cmd = `${tabixTool} ${gfaFile} ${resolve(REPO_ROOT, 'test_data/chr20_region')}`
    execSync(cmd, { stdio: 'inherit', cwd: REPO_ROOT })

    log('')
    log('✓ Tabix indices generated successfully')
  } else {
    log('✓ Tabix indices already exist')
  }

  log('')
  log('=== Running GetSubgraph Validation Tests ===')
  log('')

  try {
    execSync(
      'npm test -- plugins/comparative-adapters/src/GfaTabixAdapter/__tests__/getSubgraph-validation.test.ts --verbose',
      { stdio: 'inherit', cwd: REPO_ROOT },
    )
  } catch {
    error('Validation tests failed')
  }

  log('')
  log('=== Validation Complete ===')
  log('')
  log('✓ All GetSubgraph validation tests passed!')
  log('')
  log('Summary:')
  log(`  - GFA file: ${gfaFile}`)
  log(`  - Tabix indices: test_data/chr20_region.*.bed.gz*`)
  log(`  - Test file: plugins/comparative-adapters/src/GfaTabixAdapter/__tests__/getSubgraph-validation.test.ts`)
  log('')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
