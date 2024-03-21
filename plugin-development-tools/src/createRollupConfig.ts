import commonjs from '@rollup/plugin-commonjs'
import fs from 'fs'
import json from '@rollup/plugin-json'
import resolve, {
  DEFAULTS as RESOLVE_DEFAULTS,
} from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import path from 'path'
import { defineConfig, OutputOptions, Plugin, RollupOptions } from 'rollup'
import externalGlobals from 'rollup-plugin-external-globals'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import sourceMaps from 'rollup-plugin-sourcemaps'
import { terser } from 'rollup-plugin-terser'
import { babelPluginJBrowse } from './babelPluginJBrowse'
import { safePackageName, external, writeIndex, omitUnresolved } from './util'
import nodeBuiltins from 'builtin-modules'

interface JBrowseRollupConfigOptions {
  includeUMD?: boolean
  includeCJS?: boolean
  includeESMBundle?: boolean
  includeNPM?: boolean
}

const appPath = fs.realpathSync(process.cwd())
const packageJsonPath = path.join(appPath, 'package.json')
const packageJsonText = fs.readFileSync(packageJsonPath, 'utf8')
const packageJson = JSON.parse(packageJsonText)
const packageName = safePackageName(packageJson.name || '')
const umdName = `JBrowsePlugin${packageJson.config?.jbrowse?.plugin?.name}`

const distPath = path.join(appPath, 'dist')
const srcPath = path.join(appPath, 'src')

const nodeEnv = process.env.NODE_ENV || 'production'

function createGlobalMap(jbrowseGlobals: string[], dotSyntax = false) {
  const globalMap: Record<string, string> = {}
  for (const global of jbrowseGlobals) {
    globalMap[global] = dotSyntax
      ? `JBrowseExports.${global}`
      : `JBrowseExports["${global}"]`
  }
  return globalMap
}

let tsDeclarationGenerated = false

function getPlugins(
  mode: 'umd' | 'cjs' | 'npm' | 'esmBundle',
  jbrowseGlobals: string[],
): Plugin[] {
  const plugins = [
    resolve({
      extensions: [...RESOLVE_DEFAULTS.extensions, '.jsx'],
      mainFields: ['module', 'main', 'browser'],
      preferBuiltins: false,
    }),
    // all bundled external modules need to be converted from CJS to ESM
    commonjs(),
    json(),
    typescript({
      exclude: [
        // all TS test files, regardless whether co-located or in test/ etc
        '**/*.{spec,test}.ts{x,}',
      ],
      moduleResolution: 'node',
      outDir: distPath,
      target: 'esnext',
      tsconfig: './tsconfig.json',
      ...(tsDeclarationGenerated
        ? { declarationDir: './' }
        : { declaration: false, declarationMap: false }),
    }),
    (mode === 'cjs' || mode === 'esmBundle') &&
      externalGlobals(createGlobalMap(jbrowseGlobals)),
    babelPluginJBrowse({
      babelHelpers: 'bundled',

      // @ts-expect-error
      custom: {
        extractErrors: false,
        format: mode === 'esmBundle' || mode === 'npm' ? 'esm' : mode,
      },
      exclude: ['node_modules/**', '__virtual__/**'],
    }),
    mode === 'npm' && sourceMaps(),
    mode === 'npm' && writeIndex(packageName, distPath),
    (mode === 'esmBundle' || mode === 'umd') &&
      // By default, nodePolyfills only polyfills code in node_modules/. We set
      // to null here to include the plugin source code itself (and for Yarn 2/3
      // compatibility, since it doesn't use node_modules/).
      nodePolyfills({ include: null }),
    (mode === 'cjs' || mode === 'esmBundle') && omitUnresolved(),
  ].filter(Boolean)

  if (tsDeclarationGenerated === false) {
    tsDeclarationGenerated = true
  }
  return plugins
}

export function createRollupConfig(
  jbrowseGlobals: string[],
  options?: JBrowseRollupConfigOptions,
) {
  const includeUMD = Boolean(
    options?.includeUMD === true || options?.includeUMD === undefined,
  )
  const includeCJS = Boolean(options?.includeCJS === true)
  const includeESMBundle = Boolean(options?.includeESMBundle === true)
  const includeNPM = Boolean(
    options?.includeNPM === true || options?.includeNPM === undefined,
  )
  const npmConfig =
    includeNPM &&
    defineConfig({
      external,
      input: path.join(srcPath, 'index.ts'),
      output: [
        {
          esModule: true,
          exports: 'named',
          file: path.join(distPath, 'index.esm.js'),
          format: 'esm',
          freeze: false,
          sourcemap: true,
        },
        {
          esModule: true,
          exports: 'named',
          file: path.join(distPath, `${packageName}.cjs.development.js`),
          format: 'cjs',
          freeze: false,
          sourcemap: true,
        },
        nodeEnv === 'production' && {
          esModule: true,
          exports: 'named',
          file: path.join(distPath, `${packageName}.cjs.production.min.js`),
          format: 'cjs',
          freeze: false,
          plugins: [
            terser({
              compress: { keep_infinity: true, passes: 10, pure_getters: true },
              ecma: 5,
              output: { comments: false },
              toplevel: true,
            }),
          ],
          sourcemap: true,
        },
      ].filter(Boolean) as OutputOptions[],
      plugins: getPlugins('npm', jbrowseGlobals),
      treeshake: { propertyReadSideEffects: false },
    })
  const umdConfig =
    includeUMD &&
    defineConfig({
      external: (id: string) => {
        const isExternal = external(id)
        if (isExternal && !jbrowseGlobals.includes(id)) {
          return false
        }
        return isExternal
      },
      input: path.join(srcPath, 'index.ts'),
      output: [
        {
          esModule: true,
          exports: 'named',
          file: path.join(distPath, `${packageName}.umd.development.js`),
          format: 'umd',
          freeze: false,
          globals: createGlobalMap(jbrowseGlobals, true),
          inlineDynamicImports: true,
          name: umdName,
          sourcemap: true,
        },
        nodeEnv === 'production' && {
          esModule: true,
          exports: 'named',
          file: path.join(distPath, `${packageName}.umd.production.min.js`),
          format: 'umd',
          freeze: false,
          globals: createGlobalMap(jbrowseGlobals, true),
          inlineDynamicImports: true,
          name: umdName,
          plugins: [
            terser({
              compress: { keep_infinity: true, passes: 10, pure_getters: true },
              ecma: 5,
              output: { comments: false },
              toplevel: true,
            }),
          ],
          sourcemap: true,
        },
      ].filter(Boolean) as OutputOptions[],
      plugins: getPlugins('umd', jbrowseGlobals),
      treeshake: { propertyReadSideEffects: false },
      watch: { clearScreen: false },
    })
  const esmBundleConfig =
    includeESMBundle &&
    defineConfig({
      external: (id: string) => {
        const isExternal = external(id)
        if (isExternal && !jbrowseGlobals.includes(id)) {
          return false
        }
        return isExternal
      },
      input: path.join(srcPath, 'index.ts'),
      output: [
        {
          esModule: true,
          exports: 'named',
          file: path.join(distPath, `${packageName}.esm.js`),
          format: 'esm',
          freeze: false,
          inlineDynamicImports: true,
          sourcemap: true,
        },
      ],
      plugins: getPlugins('esmBundle', jbrowseGlobals),
      treeshake: { moduleSideEffects: false, propertyReadSideEffects: false },
      watch: { clearScreen: false },
    })
  const cjsConfig =
    includeCJS &&
    defineConfig({
      external: (id: string) => {
        if (nodeBuiltins.includes(id)) {
          return true
        }
        const isExternal = external(id)
        if (isExternal && !jbrowseGlobals.includes(id)) {
          return false
        }
        return isExternal
      },
      input: path.join(srcPath, 'index.ts'),
      output: [
        {
          esModule: true,
          exports: 'named',
          file: path.join(distPath, `${packageName}.cjs.js`),
          format: 'cjs',
          freeze: false,
          inlineDynamicImports: true,
          sourcemap: true,
        },
      ],
      plugins: getPlugins('cjs', jbrowseGlobals),
      treeshake: { moduleSideEffects: false, propertyReadSideEffects: false },
      watch: { clearScreen: false },
    })
  const configs: RollupOptions[] = []
  ;[umdConfig, esmBundleConfig, npmConfig, cjsConfig].forEach(conf => {
    if (conf) {
      configs.push(conf)
    }
  })
  return defineConfig(configs)
}
