import { HtmlPreloadPlugin } from '../../../config/webpack/config/htmlPreloadPlugin.ts'
import { genBuildInfo } from './genBuildInfo.ts'

import type { Configuration } from 'webpack'

// Every cold load fetches the first two; the rest are a bet that the session
// opens a linear genome view. browser-tests/measure-load-latency.ts prices it.
const preloaded = [
  {
    issuer: 'jbrowse-web/src/earlyStart.ts',
    request: './components/Loader.tsx',
  },
  { issuer: 'jbrowse-web/src/makeWorkerInstance.ts' },
  {
    issuer: 'linear-genome-view/src/LinearGenomeView/index.ts',
    request: './components/LinearGenomeView.tsx',
  },
  {
    issuer: 'app-core/src/ui/App/lazyParts.ts',
    request: '../../WorkspaceLayout/WorkspaceContainer.tsx',
  },
]

export default function webpackConfig(config: Configuration) {
  genBuildInfo()
  return {
    ...config,
    plugins: [...(config.plugins ?? []), new HtmlPreloadPlugin(preloaded)],
  }
}
