/**
 * @jest-environment node
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const baseline = path.join(
  mkdtempSync(path.join(tmpdir(), 'slot-paths-')),
  'baseline.txt',
)

const run = (...args: string[]) =>
  spawnSync(
    'node',
    [
      '--experimental-strip-types',
      path.join(__dirname, 'check-config-slot-paths.ts'),
      '--baseline',
      baseline,
      ...args,
    ],
    { encoding: 'utf8' },
  )

const lines = () => readFileSync(baseline, 'utf8').split('\n').filter(Boolean)

test('a freeze writes the baseline a check then holds the schema to', () => {
  expect(run().stdout).toMatch('nothing to check')

  expect(run('--freeze').status).toBe(0)
  expect(lines()).toContain('LinearWiggleDisplay.scales.y.domainMin')
  expect(lines()).toContain('LinearGenomeView.loc')
  expect(run().status).toBe(0)

  appendFileSync(baseline, 'LinearWiggleDisplay.shippedThenDeleted\n')
  const failed = run()
  expect(failed.status).toBe(1)
  expect(failed.stderr).toMatch('- LinearWiggleDisplay.shippedThenDeleted')

  // a later release's freeze adds its paths and forgives no earlier one
  expect(run('--freeze').status).toBe(0)
  expect(lines()).toContain('LinearWiggleDisplay.shippedThenDeleted')
  expect(run().status).toBe(1)
})
