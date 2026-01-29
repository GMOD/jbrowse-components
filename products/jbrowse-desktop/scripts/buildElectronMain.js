import fs from 'fs'
import esbuild from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'

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
  sourcemap: false,
  minify: process.env.NODE_ENV === 'production',
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
})

console.log('Electron main process bundled successfully')
