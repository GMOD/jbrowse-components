import fs from 'fs'
import path from 'path'

import chalk from 'chalk'

function canReadAsset(asset) {
  return /\.(js|css)$/.test(asset)
}

export function printFileSizesAfterBuild(webpackStats, previousSizeMap, buildFolder) {
  const root = previousSizeMap.root
  const assets = (webpackStats.stats || [webpackStats])
    .map(stats =>
      stats
        .toJson({ all: false, assets: true })
        .assets.filter(asset => canReadAsset(asset.name))
        .map(asset => {
          const fileContents = fs.readFileSync(path.join(root, asset.name))
          return {
            folder: path.join(path.basename(buildFolder), path.dirname(asset.name)),
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

export function measureFileSizesBeforeBuild(buildFolder) {
  return Promise.resolve({ root: buildFolder, sizes: {} })
}
