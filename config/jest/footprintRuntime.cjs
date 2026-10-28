// Records every repo file a suite executed or read, so
// `scripts/test-related.ts` can select suites by what they ran rather than by
// the static import graph, which relates every app-level suite to nearly every
// plugin file. Layout and reader: `footprints.cjs`.
//
// Reads through `fs` count too, because a suite that scans the repo, such as a
// public-API snapshot reading package.json, imports none of what it checks. A
// listed directory records as `dir/`.
const fs = require('node:fs')
const path = require('node:path')

const Runtime = require('jest-runtime').default

const { writeFootprint } = require('./footprints.cjs')

let reads = new Set()

function record(p, suffix = '') {
  if (typeof p === 'string') {
    reads.add(path.resolve(p) + suffix)
  } else if (p instanceof URL && p.protocol === 'file:') {
    reads.add(path.resolve(p.pathname) + suffix)
  }
}

function wrap(owner, name, suffix) {
  const original = owner[name]
  if (typeof original !== 'function') {
    return
  }
  owner[name] = function (p, ...rest) {
    record(p, suffix)
    return original.call(this, p, ...rest)
  }
}

for (const name of ['readFileSync', 'readFile', 'existsSync', 'statSync']) {
  wrap(fs, name)
  wrap(fs.promises, name)
}
wrap(fs, 'readdirSync', '/')
wrap(fs, 'readdir', '/')
wrap(fs.promises, 'readdir', '/')

module.exports = class FootprintRuntime extends Runtime {
  // not a class field: jest-runtime's constructor calls resetModules, which runs
  // before a field initializer would
  collectSeen() {
    this.seen ??= new Set()
    for (const f of this.transformCache.getEntries().keys()) {
      this.seen.add(f)
    }
    for (const f of this.fileCache.strings.keys()) {
      this.seen.add(f)
    }
    for (const f of reads) {
      this.seen.add(f)
    }
  }

  resetModules() {
    this.collectSeen()
    super.resetModules()
  }

  teardown() {
    this.collectSeen()
    reads = new Set()
    writeFootprint(this._config, this._testPath, this.seen)
    super.teardown()
  }
}
