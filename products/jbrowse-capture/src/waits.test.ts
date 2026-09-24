import { execFileSync, spawnSync } from 'node:child_process'

import { displayPainted, displaySettled } from './waits.ts'

test('the composite selectors name the type and the readiness separately', () => {
  expect(displayPainted('pileup-display')).toBe(
    '[data-testid="pileup-display"][data-display-drawn="true"]',
  )

  expect(displaySettled('pileup-display')).toBe(
    '[data-testid="pileup-display"][data-display-phase="ready"]',
  )
})

test('the testid a selector is built from does not carry readiness', () => {
  for (const testid of ['pileup-display', 'synteny_canvas']) {
    expect(displayPainted(testid)).toContain(`[data-testid="${testid}"]`)
    expect(displaySettled(testid)).toContain(`[data-testid="${testid}"]`)
  }
})

// A selector still naming the retired readiness suffix matches nothing and
// hangs its wait in a job CI runs rarely, such as a weekly figure spec. The
// first scan takes only the equals-sign form, so prose quoting the old
// convention is no hit; the second takes testing-library's bare id, only in
// component_tests/, since repo-wide it hits DisplayChrome.test.tsx asserting
// the old id is gone.
test('no selector anywhere still spells readiness into a testid', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim()
  expect(root).not.toBe('')
  // `git grep` respects .gitignore, so node_modules and build output are out
  // without an exclude list. It exits 1 on NO matches, which is the passing
  // case here — hence spawnSync and reading status, rather than execFileSync,
  // which would throw on exactly the run that should pass.
  const { status, stdout, stderr } = spawnSync(
    'git',
    [
      'grep',
      '-nE',
      'data-testid="[^"]*(-|_)done"',
      '--',
      '*.ts',
      '*.tsx',
      '*.js',
      '*.mjs',
      '*.md',
    ],
    { cwd: root, encoding: 'utf8' },
  )
  // 0 = found something, 1 = clean. Anything else is git failing, and must not
  // read as a pass.
  expect({ status, stderr }).toEqual({ status: 1, stderr: '' })
  expect(stdout.trim()).toBe('')

  // The testing-library form, in the one tree where it can only be a live wait.
  const tl = spawnSync(
    'git',
    [
      'grep',
      '-nE',
      'ByTestId\\((.)[^)]*(-|_)done\\1',
      '--',
      'component_tests/',
    ],
    { cwd: root, encoding: 'utf8' },
  )
  expect({ status: tl.status, stderr: tl.stderr }).toEqual({
    status: 1,
    stderr: '',
  })
  expect(tl.stdout.trim()).toBe('')
})
