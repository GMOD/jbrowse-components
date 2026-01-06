import fs from 'fs'
import path from 'path'

const root = path.resolve(import.meta.dirname, '..')

// Directories to process
const dirs = ['packages', 'plugins', 'products']

// File extensions to process
const sourceExtensions = ['.ts', '.tsx']

// Import/export patterns to match
// const patterns = [
//   // import ... from './path'
//   /(?<keyword>import|export)(?<middle>[\s\S]*?from\s*)['"](?<importPath>\.\.?\/[^'"]+)['"]/g,
//   // import('./path')
//   /(?<keyword>import)\s*\(\s*['"](?<importPath>\.\.?\/[^'"]+)['"]\s*\)/g,
// ]

function getFiles(dir: string): string[] {
  const files: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    // Skip node_modules, dist, esm, build directories
    if (entry.isDirectory()) {
      if (
        ['node_modules', 'dist', 'esm', 'build', '.git', 'test_data'].includes(
          entry.name,
        )
      ) {
        continue
      }
      files.push(...getFiles(fullPath))
    } else if (sourceExtensions.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath)
    }
  }

  return files
}

function resolveImportPath(
  importPath: string,
  fromFile: string,
): string | undefined {
  // Already has extension
  if (/\.[a-z]+$/i.test(importPath)) {
    return undefined
  }

  const dir = path.dirname(fromFile)
  const resolved = path.resolve(dir, importPath)

  // Check for exact file matches
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    if (fs.existsSync(resolved + ext)) {
      return importPath + ext
    }
  }

  // Check for index file in directory
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      if (fs.existsSync(path.join(resolved, `index${ext}`))) {
        return `${importPath}/index${ext}`
      }
    }
  }

  return undefined
}

function processFile(filePath: string): { file: string; changes: number } {
  let content = fs.readFileSync(filePath, 'utf8')
  let changes = 0

  // Process static imports/exports
  content = content.replace(
    /(?<keyword>import|export)(?<middle>[\s\S]*?from\s*)['"](?<importPath>\.\.?\/[^'"]+)['"]/g,
    (match, keyword, middle, importPath) => {
      // Skip if already has extension or is a package import
      if (/\.[a-z]+$/i.test(importPath)) {
        return match
      }

      const newPath = resolveImportPath(importPath, filePath)
      if (newPath) {
        changes++
        return `${keyword}${middle}'${newPath}'`
      }
      return match
    },
  )

  // Process dynamic imports
  content = content.replace(
    /(?<keyword>import)\s*\(\s*['"](?<importPath>\.\.?\/[^'"]+)['"]\s*\)/g,
    (match, keyword, importPath) => {
      if (/\.[a-z]+$/i.test(importPath)) {
        return match
      }

      const newPath = resolveImportPath(importPath, filePath)
      if (newPath) {
        changes++
        return `${keyword}('${newPath}')`
      }
      return match
    },
  )

  if (changes > 0) {
    fs.writeFileSync(filePath, content)
  }

  return { file: filePath, changes }
}

function main() {
  const allFiles: string[] = []

  for (const dir of dirs) {
    const fullDir = path.join(root, dir)
    if (fs.existsSync(fullDir)) {
      allFiles.push(...getFiles(fullDir))
    }
  }

  console.log(`Found ${allFiles.length} source files`)

  let totalChanges = 0
  let filesChanged = 0

  for (const file of allFiles) {
    const result = processFile(file)
    if (result.changes > 0) {
      console.log(`${result.file}: ${result.changes} imports updated`)
      totalChanges += result.changes
      filesChanged++
    }
  }

  console.log(
    `\nDone! Updated ${totalChanges} imports in ${filesChanged} files`,
  )
}

main()
