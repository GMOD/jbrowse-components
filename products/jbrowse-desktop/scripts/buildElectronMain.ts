import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import esbuild from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const buildDir = path.join(rootDir, 'build')

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true })
}

await esbuild.build({
  entryPoints: [path.join(rootDir, 'electron/electron.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: path.join(rootDir, 'build/electron.js'),
  external: ['electron'],
  // Inject createRequire so bundled CommonJS code can use require() for Node built-ins
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
  sourcemap: false,
  minify: process.env.NODE_ENV === 'production',
})

// The preload runs in the renderer, before the page, and must be CommonJS: an
// ESM preload needs an .mjs extension and is only loaded when the window is
// unsandboxed, so cjs is the form that works either way.
//
// The .cjs extension is load-bearing. This package is "type": "module", so a
// preload written to build/preload.js is parsed as ESM, throws on its own
// require() call before it can expose anything, and leaves the renderer with no
// bridge at all — silently, since a preload that throws does not stop the page.
await esbuild.build({
  entryPoints: [path.join(rootDir, 'electron/preload.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(rootDir, 'build/preload.cjs'),
  external: ['electron'],
  sourcemap: false,
  minify: process.env.NODE_ENV === 'production',
})

console.log('Electron main process bundled successfully')
