import fs from 'fs'
import path from 'path'

import chalk from 'chalk'

function canReadAsset(asset: string) {
  return /\.(js|css)$/.test(asset)
}

interface StatsLike {
  stats?: StatsLike[]
  toJson: (opts: Record<string, boolean>) => { assets?: { name: string }[] }
}

export function printFileSizesAfterBuild(
  webpackStats: StatsLike,
  buildFolder: string,
) {
  const assets = (webpackStats.stats || [webpackStats])
    .map(stats =>
      (stats
        .toJson({ all: false, assets: true })
        .assets || []).filter(asset => canReadAsset(asset.name))
        .map(asset => {
          const fileContents = fs.readFileSync(path.join(buildFolder, asset.name))
          return {
            folder: path.join(
              path.basename(buildFolder),
              path.dirname(asset.name),
            ),
            name: path.basename(asset.name),
            size: fileContents.length,
          }
        }),
    )
    .reduce((single, all) => all.concat(single), [])

  assets.sort((a, b) => b.size - a.size)
  for (const asset of assets) {
    const sizeKB = `${(asset.size / 1024).toFixed(1)} KB`
    console.log(
      `  ${sizeKB.padStart(10)}  ${chalk.dim(asset.folder + path.sep)}${chalk.cyan(asset.name)}`,
    )
  }
}
