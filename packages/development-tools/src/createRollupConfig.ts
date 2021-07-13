import { DEFAULT_EXTENSIONS as DEFAULT_BABEL_EXTENSIONS } from '@babel/core'
import commonjs from '@rollup/plugin-commonjs'
import fs from 'fs'
import json from '@rollup/plugin-json'
import resolve, {
  DEFAULTS as RESOLVE_DEFAULTS,
} from '@rollup/plugin-node-resolve'
import path from 'path'
import { defineConfig, Plugin } from 'rollup'
import externalGlobals from 'rollup-plugin-external-globals'
import sourceMaps from 'rollup-plugin-sourcemaps'
import { terser } from 'rollup-plugin-terser'
import typescript from 'rollup-plugin-typescript2'
import ts from 'typescript'
import { babelPluginJBrowse } from './babelPluginJBrowse'
import { safePackageName, external } from './util'

const appPath = fs.realpathSync(process.cwd())
const packageJsonPath = path.join(appPath, 'package.json')
const packageJsonText = fs.readFileSync(packageJsonPath, 'utf-8')
const packageJson = JSON.parse(packageJsonText)
const packageName = safePackageName(packageJson.name || '')

const distPath = path.join(appPath, 'dist')
const srcPath = path.join(appPath, 'src')

const tsconfigPath = 'tsconfig.json'
const tsconfigJSON = ts.readConfigFile(tsconfigPath, ts.sys.readFile).config
const tsCompilerOptions = ts.parseJsonConfigFileContent(
  tsconfigJSON,
  ts.sys,
  './',
).options

function createGlobalMap(globals: string[]) {
  const globalMap: Record<string, string> = {}
  globals.forEach(global => {
    globalMap[global] = `JBrowseExports["${global}"]`
  })
  return globalMap
}

function getPlugins(
  mode: 'runtime' | 'buildtime',
  globals: string[],
): Plugin[] {
  return [
    resolve({
      mainFields: ['module', 'main', 'browser'],
      extensions: [...RESOLVE_DEFAULTS.extensions, '.jsx'],
    }),
    // all bundled external modules need to be converted from CJS to ESM
    commonjs({
      // use a regex to make sure to include eventual hoisted packages
      include: /\/node_modules\//,
    }),
    json(),
    typescript({
      typescript: ts,
      tsconfig: tsconfigPath,
      tsconfigDefaults: {
        exclude: [
          // all TS test files, regardless whether co-located or in test/ etc
          '**/*.spec.ts',
          '**/*.test.ts',
          '**/*.spec.tsx',
          '**/*.test.tsx',
          // TS defaults below
          'node_modules',
          'bower_components',
          'jspm_packages',
          distPath,
        ],
        compilerOptions: {
          sourceMap: true,
          declaration: true,
          jsx: 'react',
        },
      },
      tsconfigOverride: {
        compilerOptions: {
          // TS -> esnext, then leave the rest to babel-preset-env
          target: 'esnext',
          ...(mode === 'runtime'
            ? { declaration: false, declarationMap: false }
            : {}),
        },
      },
      check: true,
      useTsconfigDeclarationDir: Boolean(tsCompilerOptions?.declarationDir),
    }),
    babelPluginJBrowse({
      exclude: 'node_modules/**',
      extensions: [...DEFAULT_BABEL_EXTENSIONS, 'ts', 'tsx'],
      // @ts-ignore
      custom: {
        extractErrors: false,
        format: 'esm',
      },
      babelHelpers: 'bundled',
    }),
    sourceMaps(),
    {
      name: 'write-index-file',
      generateBundle() {
        const baseLine = `module.exports = require('./${packageName}`
        const contents = `'use strict'

if (process.env.NODE_ENV === 'production') {
  ${baseLine}.cjs.production.min.js')
} else {
  ${baseLine}.cjs.development.js')
}
`
        if (!fs.existsSync(distPath)) {
          fs.mkdirSync(distPath, { recursive: true })
        }
        return fs.writeFileSync(path.join(distPath, 'index.js'), contents)
      },
    },
    mode === 'runtime' && externalGlobals(createGlobalMap(globals)),
  ].filter(Boolean)
}

export function createRollupConfig(globals: string[]) {
  return defineConfig([
    {
      input: path.join(srcPath, 'index.ts'),
      external,
      treeshake: { propertyReadSideEffects: false },
      plugins: getPlugins('buildtime', globals),
      output: [
        {
          file: path.join(distPath, 'index.mjs'),
          format: 'esm',
          freeze: false,
          esModule: true,
          sourcemap: true,
          exports: 'named',
        },
        {
          file: path.join(distPath, `${packageName}.cjs.development.js`),
          format: 'cjs',
          freeze: false,
          esModule: true,
          sourcemap: true,
          exports: 'named',
        },
        {
          file: path.join(distPath, `${packageName}.cjs.production.min.js`),
          format: 'cjs',
          freeze: false,
          esModule: true,
          sourcemap: true,
          exports: 'named',
          plugins: [
            terser({
              output: { comments: false },
              compress: {
                keep_infinity: true,
                pure_getters: true,
                passes: 10,
              },
              ecma: 5,
              toplevel: true,
            }),
          ],
        },
      ],
    },
    {
      input: path.join(srcPath, 'index.ts'),
      external: (id: string) => {
        const isExternal = external(id)
        if (isExternal) {
          if (!globals.includes(id)) {
            try {
              require.resolve(id)
              return false
            } catch {}
          }
        }
        return isExternal
      },
      treeshake: { propertyReadSideEffects: false },
      plugins: getPlugins('runtime', globals),
      output: [
        {
          file: path.join(distPath, `${packageName}.esm.js`),
          format: 'esm',
          freeze: false,
          esModule: true,
          sourcemap: true,
          exports: 'named',
        },
      ],
      watch: { clearScreen: false },
    },
  ])
}
