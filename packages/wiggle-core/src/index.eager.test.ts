import { execFileSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(__dirname, '../../..')

// Config schemas import this barrel at plugin install, so everything it
// reaches statically is in every host's first paint (ADR-091). The score-plot
// chrome and SVG frame are subpath exports for that reason, and bundler tree
// shaking is not what keeps them out.
test('the barrel reaches no display chrome and no SVG export', () => {
  const closure = execFileSync(
    process.execPath,
    [
      '--experimental-strip-types',
      'scripts/eager-import-closure.ts',
      'packages/wiggle-core/src/index.ts',
    ],
    { cwd: root, encoding: 'utf8' },
  )
  const reached = new Set(
    closure.split('\n').map(line => line.trim().split(/\s+/)[1]),
  )
  expect(
    [
      'packages/display-kit/src/DisplayChrome.tsx',
      'packages/core/src/svg/SvgExport.tsx',
    ].filter(module => reached.has(module)),
  ).toEqual([])
  expect(reached.has('packages/wiggle-core/src/index.ts')).toBe(true)
})
