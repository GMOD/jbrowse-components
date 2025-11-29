/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const { gzipSizeSync } = require('gzip-size')

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

function removeFileNameHash(buildFolder, fileName) {
  return fileName
    .replace(buildFolder, '')
    .replace(/\\/g, '/')
    .replace(/\/?(.*)(\.[0-9a-f]+)(\.chunk)?(\.js|\.css)/, (match, p1, p2, p3, p4) => p1 + p4)
}

function getDifferenceLabel(currentSize, previousSize) {
  const FIFTY_KILOBYTES = 1024 * 50
  const difference = currentSize - previousSize
  if (Number.isNaN(difference)) {
    return ''
  }
  const fileSizeStr = formatFileSize(Math.abs(difference))
  if (difference >= FIFTY_KILOBYTES) {
    return chalk.red('+' + fileSizeStr)
  } else if (difference > 0) {
    return chalk.yellow('+' + fileSizeStr)
  } else if (difference < 0) {
    return chalk.green('-' + fileSizeStr)
  }
  return ''
}

function readDirRecursive(dir) {
  if (!fs.existsSync(dir)) {
    return []
  }
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...readDirRecursive(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

function printFileSizesAfterBuild(
  webpackStats,
  previousSizeMap,
  buildFolder,
  maxBundleGzipSize,
  maxChunkGzipSize,
) {
  const root = previousSizeMap.root
  const sizes = previousSizeMap.sizes
  const assets = (webpackStats.stats || [webpackStats])
    .flatMap(stats =>
      stats
        .toJson({ all: false, assets: true })
        .assets.filter(asset => canReadAsset(asset.name))
        .map(asset => {
          const fileContents = fs.readFileSync(path.join(root, asset.name))
          const size = gzipSizeSync(fileContents)
          const previousSize = sizes[removeFileNameHash(root, asset.name)]
          const difference = getDifferenceLabel(size, previousSize)
          return {
            folder: path.join(path.basename(buildFolder), path.dirname(asset.name)),
            name: path.basename(asset.name),
            size,
            sizeLabel: formatFileSize(size) + (difference ? ' (' + difference + ')' : ''),
          }
        }),
    )
    .sort((a, b) => b.size - a.size)

  const longestSizeLabelLength = Math.max(...assets.map(a => a.sizeLabel.replace(/\x1b\[[0-9;]*m/g, '').length))
  let suggestBundleSplitting = false

  for (const asset of assets) {
    const sizeLength = asset.sizeLabel.replace(/\x1b\[[0-9;]*m/g, '').length
    const sizeLabel = asset.sizeLabel + ' '.repeat(longestSizeLabelLength - sizeLength)
    const isMainBundle = asset.name.startsWith('main.')
    const maxRecommendedSize = isMainBundle ? maxBundleGzipSize : maxChunkGzipSize
    const isLarge = maxRecommendedSize && asset.size > maxRecommendedSize
    if (isLarge && path.extname(asset.name) === '.js') {
      suggestBundleSplitting = true
    }
    console.log(
      '  ' +
        (isLarge ? chalk.yellow(sizeLabel) : sizeLabel) +
        '  ' +
        chalk.dim(asset.folder + path.sep) +
        chalk.cyan(asset.name),
    )
  }

  if (suggestBundleSplitting) {
    console.log()
    console.log(chalk.yellow('The bundle size is significantly larger than recommended.'))
    console.log(chalk.yellow('Consider reducing it with code splitting.'))
  }
}

function measureFileSizesBeforeBuild(buildFolder) {
  const fileNames = readDirRecursive(buildFolder)
  const sizes = {}
  for (const fileName of fileNames) {
    if (canReadAsset(fileName)) {
      const contents = fs.readFileSync(fileName)
      const key = removeFileNameHash(buildFolder, fileName)
      sizes[key] = gzipSizeSync(contents)
    }
  }
  return Promise.resolve({
    root: buildFolder,
    sizes,
  })
}

module.exports = {
  measureFileSizesBeforeBuild,
  printFileSizesAfterBuild,
}
