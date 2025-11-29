'use strict'

const fs = require('fs')
const path = require('path')
const chalk = require('chalk')

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + ' B'
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + ' kB'
  } else {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }
}

function canReadAsset(asset) {
  return /\.(js|css)$/.test(asset) && !/service-worker\.js/.test(asset)
}

function printFileSizesAfterBuild(webpackStats, buildFolder) {
  const assets = (webpackStats.stats || [webpackStats])
    .flatMap(stats =>
      stats
        .toJson({ all: false, assets: true })
        .assets.filter(asset => canReadAsset(asset.name))
        .map(asset => {
          const filePath = path.join(buildFolder, asset.name)
          const size = fs.statSync(filePath).size
          return {
            folder: path.join(path.basename(buildFolder), path.dirname(asset.name)),
            name: path.basename(asset.name),
            size,
            sizeLabel: formatFileSize(size),
          }
        }),
    )
    .sort((a, b) => b.size - a.size)

  const longestSizeLabelLength = Math.max(...assets.map(a => a.sizeLabel.length))

  for (const asset of assets) {
    const sizeLabel = asset.sizeLabel.padEnd(longestSizeLabelLength)
    console.log(
      '  ' + sizeLabel + '  ' + chalk.dim(asset.folder + path.sep) + chalk.cyan(asset.name),
    )
  }
}

module.exports = { printFileSizesAfterBuild }
