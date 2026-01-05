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

function cleanupPackage(dir) {
  const pkgPath = join(dir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  let modified = false

  // Remove redundant module field if it equals main
  if (pkg.module && pkg.main && pkg.module === pkg.main) {
    delete pkg.module
    console.log(`${pkg.name}: removed redundant module field`)
    modified = true
  }

  // Add sideEffects: false if not present
  if (pkg.sideEffects === undefined) {
    pkg.sideEffects = false
    console.log(`${pkg.name}: added sideEffects: false`)
    modified = true
  }

  if (modified) {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  }

  return modified
}

const dirs = getPackageDirs()
let modified = 0

for (const dir of dirs) {
  if (cleanupPackage(dir)) {
    modified++
  }
}

console.log(`\nModified ${modified} packages`)
