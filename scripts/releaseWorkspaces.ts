// The manifests `pnpm release` bumps, shared with the tag-vs-tree check the
// publish and release workflows run — so the gate and the thing it gates can't
// disagree about what "every package" means.
//
// Kept free of import.meta so jest can load it; callers pass the repo root in.
import fs from 'node:fs'
import path from 'node:path'

export function workspaceGlobs(root: string) {
  const yaml = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')
  return (/^packages:\n((?:[ #].*\n|\n)*)/m.exec(yaml)?.[1] ?? '')
    .split('\n')
    .map(line => /^\s+-\s+'(.+)'\s*$/.exec(line)?.[1])
    .filter(pattern => pattern !== undefined)
}

// pnpm-workspace.yaml's `<folder>/*` entries, the folders every child of which
// is a package. Its other entries, products/*/examples-site and website, are
// not versioned with the release. example-plugins/* is: it is private and
// never published, but its manifest is an example a plugin author copies, and
// left out of the bump it sat at 4.3.0 through a major.
export function workspaceFolders(root: string) {
  return workspaceGlobs(root)
    .map(pattern => /^([^/*]+)\/\*$/.exec(pattern)?.[1])
    .filter(folder => folder !== undefined)
}

export function workspaceManifests(root: string) {
  return workspaceFolders(root)
    .filter(ws => fs.existsSync(path.join(root, ws)))
    .flatMap(ws =>
      fs
        .readdirSync(path.join(root, ws))
        .map(dir => path.join(ws, dir, 'package.json'))
        .filter(manifest => fs.existsSync(path.join(root, manifest))),
    )
}

// Every manifest whose version is not `version`, as `path\tversion` pairs.
export function versionMismatches(root: string, version: string) {
  return workspaceManifests(root)
    .map(manifest => ({
      manifest,
      found: JSON.parse(fs.readFileSync(path.join(root, manifest), 'utf8')) as {
        version?: string
      },
    }))
    .filter(({ found }) => found.version !== version)
    .map(({ manifest, found }) => ({ manifest, version: found.version }))
}
