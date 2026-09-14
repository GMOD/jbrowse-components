// A footprint is the list of repo files one suite loaded on its last run,
// gzipped JSON under `<cacheDirectory>/footprints/<checkout>/`. Each checkout
// writes its own directory, so a worktree whose branch dropped an import never
// narrows what the primary checkout recorded; a reader takes the union of its
// own and the primary's.
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const hash = s => createHash('sha1').update(s).digest('hex').slice(0, 16)

function footprintDir(cacheDirectory, checkoutRoot) {
  return path.join(cacheDirectory, 'footprints', hash(checkoutRoot))
}

function writeFootprint(config, testPath, seen) {
  const prefix = `${config.rootDir}/`
  const files = []
  for (const f of seen) {
    if (f.startsWith(prefix) && !f.includes('/node_modules/')) {
      files.push(f.slice(prefix.length))
    }
  }
  const test = testPath.slice(prefix.length)
  const dir = footprintDir(config.cacheDirectory, config.rootDir)
  const file = path.join(dir, `${hash(test)}.json.gz`)
  const tmp = `${file}.${process.pid}`
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      tmp,
      zlib.gzipSync(JSON.stringify({ test, files }), { level: 1 }),
    )
    fs.renameSync(tmp, file)
  } catch {
    // selection falls back to the static graph for a suite with no footprint
  }
}

function readFootprints(cacheDirectory, checkoutRoots) {
  const byTest = new Map()
  for (const root of new Set(checkoutRoots)) {
    const dir = footprintDir(cacheDirectory, root)
    let names = []
    try {
      names = fs.readdirSync(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (!name.endsWith('.json.gz')) {
        continue
      }
      try {
        const { test, files } = JSON.parse(
          zlib.gunzipSync(fs.readFileSync(path.join(dir, name))).toString(),
        )
        const set = byTest.get(test) ?? new Set()
        for (const f of files) {
          set.add(f)
        }
        byTest.set(test, set)
      } catch {
        // a torn or foreign file is a missing footprint
      }
    }
  }
  return byTest
}

module.exports = { footprintDir, readFootprints, writeFootprint }
