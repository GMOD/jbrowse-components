import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { versionMismatches, workspaceManifests } from './releaseWorkspaces.ts'

const fixture = (pkgs: Record<string, unknown>) => {
  const root = mkdtempSync(path.join(tmpdir(), 'release-workspaces-'))
  for (const [rel, manifest] of Object.entries(pkgs)) {
    mkdirSync(path.join(root, rel), { recursive: true })
    writeFileSync(
      path.join(root, rel, 'package.json'),
      JSON.stringify(manifest),
    )
  }
  return root
}

test('workspaceManifests finds one level under each workspace, and no deeper', () => {
  const root = fixture({
    'packages/core': { version: '4.3.0' },
    'plugins/alignments': { version: '4.3.0' },
    'products/jbrowse-web': { version: '4.3.0' },
    'example-plugins/score-example': { version: '4.3.0' },
    // pnpm-workspace.yaml carries these too; the release does not version them
    'products/jbrowse-web/examples-site': { version: '0.0.0' },
    website: { version: '0.0.0' },
  })
  expect(workspaceManifests(root).sort()).toEqual([
    'example-plugins/score-example/package.json',
    'packages/core/package.json',
    'plugins/alignments/package.json',
    'products/jbrowse-web/package.json',
  ])
})

// The whole point of checking every manifest rather than sampling one: a
// partial bump leaves the sampled package right and `pnpm publish -r` ships the
// mixture, which npm only lets you take back for 72 hours.
test('versionMismatches names every package that disagrees with the tag', () => {
  const root = fixture({
    'packages/core': { version: '4.4.0' },
    'plugins/alignments': { version: '4.4.0' },
    'plugins/maf': { version: '4.2.1' },
    'packages/tree-sidebar': { name: 'no-version-at-all' },
  })
  expect(versionMismatches(root, '4.4.0')).toEqual([
    { manifest: 'packages/tree-sidebar/package.json', version: undefined },
    { manifest: 'plugins/maf/package.json', version: '4.2.1' },
  ])
  expect(versionMismatches(root, '4.2.1')).toHaveLength(3)
})

test('a directory with no package.json is skipped, not thrown on', () => {
  const root = fixture({ 'packages/core': { version: '4.4.0' } })
  mkdirSync(path.join(root, 'packages/.cache'), { recursive: true })
  expect(workspaceManifests(root)).toEqual(['packages/core/package.json'])
  expect(versionMismatches(root, '4.4.0')).toEqual([])
})
