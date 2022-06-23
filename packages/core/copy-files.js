// adapted from https://github.com/mui/material-ui/blob/master/scripts/copy-files.js
// license of their repository reproduced below
// The MIT License (MIT)

// Copyright (c) 2014 Call-Em-All

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
const path = require('path')
const fse = require('fs-extra')
const glob = require('fast-glob')

const packagePath = process.cwd()
const buildPath = path.join(packagePath, './dist')
const srcPath = path.join(packagePath, './')

/**
 * Puts a package.json into every immediate child directory of rootDir.
 * That package.json contains information about esm for bundlers so that imports
 * like import Typography from '@mui/material/Typography' are tree-shakeable.
 *
 * It also tests that an this import can be used in TypeScript by checking
 * if an index.d.ts is present at that path.
 * @param {object} param0
 * @param {string} param0.from
 * @param {string} param0.to
 */
async function createModulePackages({ from, to }) {
  const directoryPackages = glob
    .sync('*/index.{js,ts,tsx}', { cwd: from })
    .map(path.dirname)

  await Promise.all(
    directoryPackages.map(async directoryPackage => {
      const packageJsonPath = path.join(to, directoryPackage, 'package.json')
      const topLevelPathImportsAreCommonJSModules = await fse.pathExists(
        path.resolve(path.dirname(packageJsonPath), '../esm'),
      )

      const packageJson = {
        sideEffects: false,
        module: topLevelPathImportsAreCommonJSModules
          ? path.posix.join('../esm', directoryPackage, 'index.js')
          : './index.js',
        main: topLevelPathImportsAreCommonJSModules
          ? './index.js'
          : path.posix.join('../node', directoryPackage, 'index.js'),
        types: './index.d.ts',
      }

      const [typingsEntryExist, moduleEntryExists, mainEntryExists] =
        await Promise.all([
          fse.pathExists(
            path.resolve(path.dirname(packageJsonPath), packageJson.types),
          ),
          fse.pathExists(
            path.resolve(path.dirname(packageJsonPath), packageJson.module),
          ),
          fse.pathExists(
            path.resolve(path.dirname(packageJsonPath), packageJson.main),
          ),
          fse.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2)),
        ])

      const manifestErrorMessages = []
      if (!typingsEntryExist) {
        manifestErrorMessages.push(
          `'types' entry '${packageJson.types}' does not exist`,
        )
      }
      if (!moduleEntryExists) {
        manifestErrorMessages.push(
          `'module' entry '${packageJson.module}' does not exist`,
        )
      }
      if (!mainEntryExists) {
        manifestErrorMessages.push(
          `'main' entry '${packageJson.main}' does not exist`,
        )
      }
      if (manifestErrorMessages.length > 0) {
        // TODO: AggregateError
        throw new Error(
          `${packageJsonPath}:\n${manifestErrorMessages.join('\n')}`,
        )
      }

      return packageJsonPath
    }),
  )
}

async function run() {
  try {
    await createModulePackages({ from: srcPath, to: buildPath })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
