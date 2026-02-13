import type { Configuration } from 'webpack'
import webpack from 'webpack'

export default function webpackConfig(config: Configuration) {
  config.plugins!.push(
    new webpack.DefinePlugin({
      'process.env.ENABLE_TYPE_CHECK': '"true"',
    }),
  )

  config.output!.publicPath = 'auto'
  return config
}
