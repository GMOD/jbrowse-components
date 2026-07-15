import type { Configuration } from 'webpack'

import { genBuildInfo } from './genBuildInfo.ts'

export default function webpackConfig(config: Configuration) {
  genBuildInfo()
  return config
}
