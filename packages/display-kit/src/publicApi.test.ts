import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The `exports` map is this package's public API, the same doctrine as
// render-core's publicApi.test.ts next door: static-import only, so a removal
// breaks a compile rather than a deployment, and what is worth pinning is that
// the surface only changes when someone means it to. Symmetric snapshot, so
// additions show up too. Update with `jest -u` and say in the commit message
// what moved and why.

interface Manifest {
  exports: Record<string, string>
  publishConfig: {
    exports: Record<string, unknown>
  }
}

const packageRoot = join(__dirname, '..')
const manifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
) as Manifest

describe('display-kit public surface', () => {
  it('pins the subpath exports', () => {
    expect(Object.keys(manifest.exports).sort()).toMatchSnapshot()
  })

  // A condition object can only narrow who gets an answer, and this package
  // publishes one ESM file per subpath, so there is nothing to narrow between.
  // `{types, import}` cost us GMOD/jbrowse-components#5626: `types` did nothing
  // tsc doesn't do from the adjacent `.d.ts`, and `import` refused every
  // resolver asking under `require`.
  it('maps each subpath to a bare string, not a condition object', () => {
    expect(
      Object.entries(manifest.publishConfig.exports).filter(
        ([, target]) => typeof target !== 'string',
      ),
    ).toEqual([])
  })

  it('serves no wildcard subpath', () => {
    const wildcards = [
      ...Object.keys(manifest.exports),
      ...Object.keys(manifest.publishConfig.exports),
    ].filter(subpath => subpath.includes('*'))
    expect(wildcards).toEqual([])
  })

  it('publishes exactly the subpaths the workspace declares', () => {
    expect(Object.keys(manifest.publishConfig.exports).sort()).toEqual(
      Object.keys(manifest.exports).sort(),
    )
  })

  it('carries no typesVersions', () => {
    // It answered only `moduleResolution: "node"`, which reads no `exports` map
    // at all. The plugins still on that setting cap `@jbrowse/core` below this
    // major, so the field resolved types for nobody who could install the
    // package — and TS 7 removes `node10` regardless.
    expect(manifest.publishConfig).not.toHaveProperty('typesVersions')
  })

  it('every declared subpath resolves to a source file', () => {
    const missing = Object.entries(manifest.exports).filter(
      ([, srcPath]) => !existsInPackage(srcPath),
    )
    expect(missing).toEqual([])
  })
})

function existsInPackage(relPath: string) {
  try {
    readFileSync(join(packageRoot, relPath))
    return true
  } catch {
    return false
  }
}
