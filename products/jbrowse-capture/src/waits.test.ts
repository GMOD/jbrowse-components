import { execFileSync, spawnSync } from 'node:child_process'

import { displayById, displayPainted, displaySettled } from './waits.ts'

// The three builders exist so that "this display, painted" is written once
// rather than spelled out at each call site (ADR-065). Their whole output is a
// selector string, and agents_capture.md quotes those strings to say what each
// one waits for — so the doc splices this test rather than copying them.
test('the composite selectors name the type and the readiness separately', () => {
  // #region display-selectors
  // `data-testid` names the display TYPE and never changes; readiness is a
  // separate attribute. "Has the pileup painted" is therefore a conjunction,
  // and these builders write it for you — pass one to `page.waitForSelector`.
  expect(displayPainted('pileup-display')).toBe(
    '[data-testid="pileup-display"][data-display-drawn="true"]',
  )

  // The stronger one. `drawn` flips on FIRST paint, so a figure that must show
  // data waits on the phase instead — that is the whole fetch, not first paint.
  expect(displaySettled('pileup-display')).toBe(
    '[data-testid="pileup-display"][data-display-phase="ready"]',
  )

  // One display by its config's `displayId`, rather than every display of a type.
  expect(displayById('my_pileup')).toBe('[data-display-id="my_pileup"]')
  // #endregion display-selectors
})

// The suffix convention these replaced (`-done` on the chrome displays, `_done`
// on the two chrome-less canvases) mutated data-testid on first paint, so a
// selector written against the id stopped matching once the display painted.
test('the testid a selector is built from does not carry readiness', () => {
  for (const testid of ['pileup-display', 'synteny_canvas']) {
    expect(displayPainted(testid)).toContain(`[data-testid="${testid}"]`)
    expect(displaySettled(testid)).toContain(`[data-testid="${testid}"]`)
  }
})

// A retired suffix leaves no wreckage a normal run can trip over, which is what
// makes this worth a repo scan rather than a code review. Nothing emits
// `*-done` any more, so a selector still naming one matches NOTHING -- and the
// places that kept one are exactly the places CI does not exercise on a PR:
// figure specs (weekly), a standalone verification script, a component-test
// workspace. Each one hangs its own wait and fails alone, long after the change,
// reading as a flake in whatever it was pointed at. Two hg002 figures sat
// broken this way, and the migration's own inventory undercounted by grepping
// selector *lines*.
//
// The pattern matches an equals-sign testid whose value ends in the retired
// suffix, and deliberately NOT the attribute-ends-with form (`data-testid$=`),
// so prose quoting the old convention — ADR-065's own write-up — is not a hit.
// It is spelled only in the regex below for the same reason: written out in a
// comment, it matches itself, which is the first thing this test caught.
//
// A SECOND SCAN below, because the equals-sign form alone missed one. The
// component_tests workspaces wait with testing-library, whose argument is a bare
// quoted id with no `data-testid=` in the line at all — invisible here, and to
// the inventory before it. lgv-vite stayed broken through the migration AND
// through the sweep that fixed its sibling workspace three directories away.
//
// Scoped to component_tests/ rather than widened repo-wide, which was tried and
// is worse than useless: repo-wide it hits ADR-065's own prose, the comment two
// lines above this one, and — the reason not to — DisplayChrome.test.tsx's
// `queryByTestId` asserting the retired id is GONE. That is the test proving the
// migration worked, and a guard that fails on it teaches people to delete the
// evidence. Inside component_tests/ there is no prose and no negative
// assertion: every testid names something the smoke test is waiting for.
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
