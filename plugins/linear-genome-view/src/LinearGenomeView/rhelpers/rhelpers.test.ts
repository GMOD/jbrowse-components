import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The helper library is real R source (rather than strings inside a TS template
// literal) precisely so R itself can check it. `parse()` is base R — no
// Bioconductor packages needed — so this runs anywhere Rscript exists and
// catches a syntax error in a helper without building and running a whole
// figure, which is how such a typo used to surface (as a stack trace from deep
// inside a generated script).
const HAVE_R =
  spawnSync('Rscript', ['-e', 'cat(1)'], { encoding: 'utf8' }).status === 0
const maybe = HAVE_R ? test : test.skip

const dir = __dirname
const files = readdirSync(dir).filter(f => f.endsWith('.R'))

test('every helper source is discovered', () => {
  expect(files.length).toBeGreaterThan(30)
})

maybe.each(files)('%s is syntactically valid R', file => {
  // parse() throws on a syntax error, naming the line
  const out = spawnSync(
    'Rscript',
    ['-e', `invisible(parse(${JSON.stringify(join(dir, file))}))`],
    { encoding: 'utf8' },
  )
  expect(out.stderr).toBe('')
  expect(out.status).toBe(0)
})

// Sourcing every helper at once additionally proves they don't collide: two
// helpers defining the same name would silently shadow one another in an
// emitted script.
maybe('the whole library sources cleanly and defines each helper', () => {
  const paths = files.map(f => JSON.stringify(join(dir, f))).join(', ')
  const names = files.map(f => JSON.stringify(f.replace(/\.R$/, ''))).join(', ')
  // Through a file rather than `-e`: R caps the length of an `-e` expression,
  // and one absolute path per helper crosses it — at 52 helpers under a
  // worktree's own deep path R truncated the expression and reported a WARNING
  // where the assertion expected a count, which reads as a helper defining the
  // wrong name rather than as a command line too long.
  const script = join(mkdtempSync(join(tmpdir(), 'jb-rhelpers-')), 'check.R')
  writeFileSync(
    script,
    `env <- new.env()
     for (f in c(${paths})) sys.source(f, envir = env)
     missing <- setdiff(c(${names}), ls(env))
     extra <- setdiff(ls(env), c(${names}))
     cat("MISSING", length(missing), paste(missing, collapse = ","), "\\n")
     cat("EXTRA", length(extra), paste(extra, collapse = ","), "\\n")`,
  )
  const out = execFileSync('Rscript', [script], { encoding: 'utf8' })
  // each file defines exactly the helper it is named for, and nothing else
  expect(out).toContain('MISSING 0')
  expect(out).toContain('EXTRA 0')
})
