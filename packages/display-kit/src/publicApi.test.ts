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
    exports: Record<string, { types: string; import: string }>
    typesVersions: Record<string, Record<string, string[]>>
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
    expect(
      Object.keys(manifest.publishConfig.typesVersions['*']!).sort(),
    ).toEqual(
      Object.keys(manifest.exports)
        .map(subpath => subpath.slice(2))
        .sort(),
    )
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
