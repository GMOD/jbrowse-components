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
// the config arrives, before main.js has run far enough to ask for them. Only
// the loader map: the modules behind it are the ones the plugins' bundles read.
const pluginRegistryOrigins = [
  {
    issuer: 'jbrowse-web/src/sessionLoaderHelpers.ts',
    request: './reExportLoaders.generated.ts',
  },
]

export default function webpackConfig(config: Configuration) {
  genBuildInfo()
  return {
    ...config,
    optimization:
      config.mode === 'production'
        ? { ...config.optimization, splitChunks: { chunks: 'all' } }
        : config.optimization,
    plugins: [
      ...(config.plugins ?? []),
      new BootChunksPlugin(bootChunkOrigins, {
        'plugin-registry-chunks': pluginRegistryOrigins,
      }),
    ],
  } satisfies Configuration
}
