// The whole synteny worker over an MCScan anchors track, as one callable.
//
// Bundled twice by `syntenyRpc.bench.ts` — once against the working tree and
// once against a git ref — so the two versions of the worker can be interleaved
// round-robin inside one process. Nothing here is a measurement; it is the thing
// measured.
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from '../../comparative-adapters/src/MCScanAnchorsAdapter/configSchema.ts'
import { executeSyntenyFeaturesAndPositions } from '../src/LinearSyntenyRPC/executeSyntenyFeaturesAndPositions.ts'

import type { Region } from '@jbrowse/core/util'

class McscanOnly extends Plugin {
  name = 'McscanOnly'
  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'MCScanAnchorsAdapter',
          displayName: 'MCScan anchors adapter',
          configSchema,
          getAdapterClass: () =>
            import('../../comparative-adapters/src/MCScanAnchorsAdapter/MCScanAnchorsAdapter.ts').then(
              r => r.default,
            ),
        }),
    )
  }
}

const pluginManager = new PluginManager([new McscanOnly()])
pluginManager.createPluggableElements()
pluginManager.configure()

// From the environment, not from `import.meta.url`: the bench bundles this file
// into a tmpdir, where a relative URL resolves to nothing.
const repoRoot = process.env.JB_REPO_ROOT
if (!repoRoot) {
  throw new Error('JB_REPO_ROOT must name the repository root')
}
const dir = `${repoRoot}/plugins/comparative-adapters/src/MCScanAnchorsAdapter/test_data/`
const loc = (name: string) => ({
  localPath: `${dir}${name}`,
  locationType: 'LocalPathLocation' as const,
})

// a session id per bundle, so the two arms never share a cached adapter — that
// would give whichever ran second another arm's parsed file
const sessionId = `bench-${Math.random()}`

const adapterConfig = {
  type: 'MCScanAnchorsAdapter',
  mcscanAnchorsLocation: loc('grape.peach.anchors.gz'),
  bed1Location: loc('grape.bed.gz'),
  bed2Location: loc('peach.bed.gz'),
  assemblyNames: ['grape', 'peach'],
}

export interface Shape {
  queryRegions: Region[]
  targetRegions: Region[]
  width: number
}

export async function runSyntenyRpc({
  queryRegions,
  targetRegions,
  width,
}: Shape) {
  const queryBp = queryRegions.reduce((a, r) => a + (r.end - r.start), 0)
  const targetBp = targetRegions.reduce((a, r) => a + (r.end - r.start), 0)
  const result = await executeSyntenyFeaturesAndPositions({
    pluginManager,
    sessionId,
    adapterConfig,
    queryView: {
      bpPerPx: queryBp / width,
      offsetPx: 0,
      displayedRegions: queryRegions,
      width,
      fetchRegions: queryRegions,
    },
    targetView: {
      bpPerPx: targetBp / width,
      offsetPx: 0,
      displayedRegions: targetRegions,
    },
    drawCIGAR: true,
  })
  // rpcResultWithArrayBuffers wraps the payload for postMessage
  return (result as unknown as { value: { featureIds: string[] } }).value
}
