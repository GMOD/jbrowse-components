import { BootAssetsPlugin } from '../../../config/webpack/config/bootAssetsPlugin.ts'
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

export default function webpackConfig(config: Configuration) {
  genBuildInfo()
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      new BootAssetsPlugin(bootChunkOrigins, {
        fonts: ['roboto-latin-400-normal'],
      }),
    ],
  }
}
