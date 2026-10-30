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
  loader: { '.md': 'text' },
  // Inject createRequire so bundled CommonJS code can use require() for Node built-ins
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
  sourcemap: false,
  minify: process.env.NODE_ENV === 'production',
})

// The MCP stdio server as a plain-node entry (no electron import anywhere in
// its graph), for MCP clients configured with `node build/mcpServer.js`; the
// packaged app serves the same role via `--mcp` from the electron.js bundle.
await esbuild.build({
  entryPoints: [path.join(rootDir, 'electron/mcp/standalone.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: path.join(rootDir, 'build/mcpServer.js'),
  loader: { '.md': 'text' },
  sourcemap: false,
  minify: process.env.NODE_ENV === 'production',
})

console.log('Electron main process bundled successfully')
