// Runs the published @jbrowse/shader-tools build on a one-shader plugin tree,
// the way a third-party plugin installs it: `esm/` under node_modules, the
// shared modules from an installed render-core, and no `webgpu`.
//
// Every other shader gate runs `src/` over this repo, so none of them sees a
// whole-tree check that only holds here: one counted this repo's
// pixel-ratio shaders and failed any plugin that had none.

import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { readImports } from '../packages/shader-tools/src/shader-codegen/readImports.ts'

const root = path.resolve(import.meta.dirname, '..')
const toolsDir = path.join(root, 'packages/shader-tools')
const sharedDir = path.join(root, 'packages/render-core/src/shaders')
const shader = path.join(
  root,
  'plugins/canvas/src/LinearBasicDisplay/passes/shaders/rect.slang',
)
const slangc = process.env.SLANGC ?? path.join(root, '.cache/slangc/bin/slangc')

function fail(message: string): never {
  throw new Error(`check-shader-tools-out-of-tree: ${message}`)
}

if (!existsSync(slangc)) {
  fail(`no slangc at ${slangc}. Run \`pnpm gen:shaders\` once to fetch it.`)
}

execFileSync(
  process.execPath,
  [
    path.join(root, 'node_modules/typescript7/bin/tsc'),
    '--build',
    'tsconfig.build.esm.json',
  ],
  { cwd: toolsDir, stdio: 'inherit' },
)

const plugin = mkdtempSync(path.join(tmpdir(), 'shader-tools-plugin-'))
try {
  const installed = path.join(plugin, 'node_modules/@jbrowse')
  cpSync(path.join(toolsDir, 'esm'), path.join(installed, 'shader-tools/esm'), {
    recursive: true,
  })
  cpSync(
    path.join(toolsDir, 'package.json'),
    path.join(installed, 'shader-tools/package.json'),
  )
  cpSync(sharedDir, path.join(installed, 'render-core/src/shaders'), {
    recursive: true,
  })

  const shaderDir = path.join(plugin, 'src/shaders')
  mkdirSync(shaderDir, { recursive: true })
  const { readFileSync } = await import('node:fs')
  const siblings = readImports(
    shader,
    readFileSync(shader, 'utf8'),
    sharedDir,
  ).filter(f => path.dirname(f.path) === path.dirname(shader))
  for (const p of [shader, ...siblings.map(f => f.path)]) {
    cpSync(p, path.join(shaderDir, path.basename(p)))
  }

  const run = (args: string[]) =>
    spawnSync(
      process.execPath,
      [path.join(installed, 'shader-tools/esm/build-shaders.js'), ...args],
      {
        cwd: plugin,
        encoding: 'utf8',
        env: { ...process.env, SLANGC: slangc },
      },
    )
  for (const args of [[], ['--check']]) {
    const result = run(args)
    if (result.status !== 0) {
      fail(
        `build-shaders ${args.join(' ')} exited ${result.status} in a plugin tree:\n${result.stdout}${result.stderr}`,
      )
    }
  }
  const generated = readdirSync(shaderDir).filter(f =>
    f.endsWith('.generated.ts'),
  )
  if (!generated.includes('rect.generated.ts')) {
    fail(
      `the build wrote no rect.generated.ts; it wrote ${generated.join(', ')}`,
    )
  }
  const strays = readdirSync(plugin).filter(
    f => !['node_modules', 'src', '.cache'].includes(f),
  )
  if (strays.length > 0) {
    fail(`the build wrote outside src/ and .cache/: ${strays.join(', ')}`)
  }
  console.log(
    `A plugin tree builds ${path.basename(shader)} into ${generated.length} generated files.`,
  )
} finally {
  rmSync(plugin, { recursive: true, force: true })
}
