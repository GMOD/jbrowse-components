// Records every repo file a suite executed or read through jest's module
// system, so `scripts/test-related.ts` can select suites by what they ran
// rather than by the static import graph, which relates every app-level suite
// to nearly every plugin file. Layout and reader: `footprints.cjs`.
const Runtime = require('jest-runtime').default

const { writeFootprint } = require('./footprints.cjs')

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
  }

  resetModules() {
    this.collectSeen()
    super.resetModules()
  }

  teardown() {
    this.collectSeen()
    writeFootprint(this._config, this._testPath, this.seen)
    super.teardown()
  }
}
