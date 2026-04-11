import { execSync } from 'child_process'

import type { Configuration } from 'webpack'
import webpack from 'webpack'

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

export default function webpackConfig(config: Configuration) {
  config.plugins!.push(
    new webpack.DefinePlugin({
      'process.env.ENABLE_TYPE_CHECK': '"true"',
      'process.env.BUILD_GIT_HASH': JSON.stringify(getGitHash()),
    }),
  )

  config.output!.publicPath = 'auto'
  return config
}
