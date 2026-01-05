#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const rootDir = process.cwd()

function getPackageDirs() {
  const dirs = []

  // Get packages
  const packagesDir = join(rootDir, 'packages')
  for (const name of readdirSync(packagesDir)) {
    const dir = join(packagesDir, name)
    if (statSync(dir).isDirectory()) {
      const pkgPath = join(dir, 'package.json')
      try {
        readFileSync(pkgPath)
        dirs.push(dir)
      } catch {
        // skip if no package.json
      }
    }
  }

  // Get plugins
  const pluginsDir = join(rootDir, 'plugins')
  for (const name of readdirSync(pluginsDir)) {
    const dir = join(pluginsDir, name)
    if (statSync(dir).isDirectory()) {
      const pkgPath = join(dir, 'package.json')
      try {
        readFileSync(pkgPath)
        dirs.push(dir)
      } catch {
        // skip if no package.json
      }
    }
  }

  return dirs
}

function migratePackage(dir) {
  const pkgPath = join(dir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

  // Skip if no publishConfig or already has exports
  if (!pkg.publishConfig) {
    console.log(`Skipping ${pkg.name}: no publishConfig`)
    return false
  }

  if (pkg.publishConfig.exports) {
    console.log(`Skipping ${pkg.name}: already has exports`)
    return false
  }

  // Check if this is a dual ESM/CJS package (has both dist and esm in files)
  const hasDualOutput =
    pkg.files && pkg.files.includes('dist') && pkg.files.includes('esm')

  // Special case for @jbrowse/core which only outputs to dist/
  const isCorePackage = pkg.name === '@jbrowse/core'

  if (isCorePackage) {
    // @jbrowse/core uses a single dist/ output with ESM
    pkg.publishConfig.exports = {
      '.': {
        types: './index.d.ts',
        import: './index.js',
        default: './index.js',
      },
      './*': {
        types: './*.d.ts',
        import: './*.js',
        default: './*.js',
      },
    }
    console.log(`Migrated ${pkg.name} (single dist output)`)
  } else if (hasDualOutput) {
    // Standard dual ESM/CJS output
    pkg.publishConfig.exports = {
      '.': {
        types: './dist/index.d.ts',
        import: './esm/index.js',
        require: './dist/index.js',
      },
    }

    // Remove legacy module field from publishConfig since exports handles it
    delete pkg.publishConfig.module

    console.log(`Migrated ${pkg.name} (dual ESM/CJS)`)
  } else {
    console.log(`Skipping ${pkg.name}: no dual output detected`)
    return false
  }

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  return true
}

const dirs = getPackageDirs()
let migrated = 0

for (const dir of dirs) {
  if (migratePackage(dir)) {
    migrated++
  }
}

console.log(`\nMigrated ${migrated} packages`)
