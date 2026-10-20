import { BootChunksPlugin } from '../../../config/webpack/config/bootChunksPlugin.ts'
import { genBuildInfo } from './genBuildInfo.ts'

import type { Configuration } from 'webpack'

// Every cold load fetches these. Declined: the linear genome view's chunks as
// well, which measured no faster (agent-docs/reference/COLD_LOAD_PROFILE.md).
const bootChunkOrigins = [
  {
    issuer: 'jbrowse-web/src/earlyStart.ts',
    request: './components/Loader.tsx',
  },
  { issuer: 'jbrowse-web/src/makeWorkerInstance.ts' },
]

// Fetched when the config names a plugin. index.html preloads these as soon as
// the config arrives, before main.js has run far enough to ask for them.
const pluginRegistryOrigins = [
  {
    issuer: 'jbrowse-web/src/sessionLoaderHelpers.ts',
    request: './reExports.generated.ts',
  },
]

export default function webpackConfig(config: Configuration) {
  genBuildInfo()
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      new BootChunksPlugin(bootChunkOrigins, {
        'plugin-registry-chunks': pluginRegistryOrigins,
      }),
    ],
  }
}
