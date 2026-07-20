import { genBuildInfo } from './genBuildInfo.ts'

import type { Configuration } from 'webpack'

export default function webpackConfig(config: Configuration) {
  genBuildInfo()
  return config
}
