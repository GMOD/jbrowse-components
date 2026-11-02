// Rewrites `import { Button, alpha } from '@mui/material'` to one import per
// owning module (`@mui/material/Button`, `@mui/material/styles`), for jest only.
//
// A bundler tree-shakes the root import; jest cannot. It executes the CJS
// `index.js`, which requires every component MUI ships, so any suite whose
// graph touches one root import loads ~500 MUI files it never uses. Most suites
// do, through `@jbrowse/core/ui`. The path imports are MUI's own documented
// equivalent, so the app builds keep the root form and only the test transform
// changes.
//
// The name → module map comes from the package itself: `index.mjs` lists each
// module, `export { default as X } from './X'` names its default, and an
// `export * from './X'` contributes whatever that module exports. A name the map
// does not hold (a type, a typo) stays on a residual root import, which keeps
// the old behaviour for it.
const fs = require('node:fs')
const path = require('node:path')

const SOURCE = '@mui/material'

function buildMap() {
  const pkgDir = path.dirname(require.resolve(`${SOURCE}/package.json`))
  const index = fs.readFileSync(path.join(pkgDir, 'index.mjs'), 'utf8')
  const map = new Map()
  const starModules = []
  for (const m of index.matchAll(
    /export \{ default as (\w+) \} from "\.\/(\w+)\/index\.mjs"/g,
  )) {
    map.set(m[1], { module: `${SOURCE}/${m[2]}`, imported: 'default' })
  }
  for (const m of index.matchAll(
    /import \* as (\w+) from "\.\/(\w+)\/index\.mjs"/g,
  )) {
    map.set(m[1], { module: `${SOURCE}/${m[2]}`, imported: '*' })
  }
  for (const m of index.matchAll(/export \* from "\.\/(\w+)\/index\.mjs"/g)) {
    starModules.push(m[1])
  }
  const starOwners = new Map()
  for (const dir of starModules) {
    for (const name of Object.keys(require(`${SOURCE}/${dir}`))) {
      if (name !== 'default' && name !== '__esModule') {
        starOwners.set(name, [...(starOwners.get(name) ?? []), dir])
      }
    }
  }
  for (const [name, dirs] of starOwners) {
    if (!map.has(name) && dirs.length === 1) {
      map.set(name, { module: `${SOURCE}/${dirs[0]}`, imported: name })
    }
  }
  return map
}

let cachedMap

module.exports = function muiPathImports({ types: t }) {
  return {
    name: 'mui-path-imports',
    visitor: {
      ImportDeclaration(nodePath) {
        const { node } = nodePath
        if (node.source.value === SOURCE && node.importKind !== 'type') {
          cachedMap ??= buildMap()
          const residual = []
          const rewritten = []
          for (const spec of node.specifiers) {
            const target =
              t.isImportSpecifier(spec) && spec.importKind !== 'type'
                ? cachedMap.get(
                    t.isIdentifier(spec.imported)
                      ? spec.imported.name
                      : spec.imported.value,
                  )
                : undefined
            if (target) {
              const local = t.identifier(spec.local.name)
              rewritten.push(
                t.importDeclaration(
                  [
                    target.imported === 'default'
                      ? t.importDefaultSpecifier(local)
                      : target.imported === '*'
                        ? t.importNamespaceSpecifier(local)
                        : t.importSpecifier(
                            local,
                            t.identifier(target.imported),
                          ),
                  ],
                  t.stringLiteral(target.module),
                ),
              )
            } else {
              residual.push(spec)
            }
          }
          if (rewritten.length > 0) {
            node.specifiers = residual
            nodePath.insertAfter(rewritten)
            if (residual.length === 0) {
              nodePath.remove()
            }
          }
        }
      },
    },
  }
}
