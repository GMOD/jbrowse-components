import fs from 'fs'
import path from 'path'

// `renderSvg` catches a throwing display and *renders* the message into the SVG
// (SvgExport.tsx: a #ffdddd rect plus #cc0000 text) rather than failing. A
// snapshot regenerated with `-u` while a display is broken therefore absorbs the
// stack trace as the new expected output, and every later run passes against it
// — which is how a `Cannot read properties of undefined` in LGVSyntenyDisplay's
// rpcProps sat inside both synteny goldens without turning anything red.
//
// The `lgv_error_*` goldens render an error on purpose (a 404 fetch), so they
// are the allowlist; anything else carrying that markup is a broken display.
const SNAPSHOT_DIR = path.join(__dirname, '__image_snapshots__')
const ERROR_MARKUP = /#ffdddd|#cc0000/

test('no SVG golden has a rendered error baked into it', () => {
  const offenders = fs
    .readdirSync(SNAPSHOT_DIR)
    .filter(f => f.endsWith('.svg') && !f.includes('error'))
    .filter(f =>
      ERROR_MARKUP.test(fs.readFileSync(path.join(SNAPSHOT_DIR, f), 'utf8')),
    )
  expect(offenders).toEqual([])
})

// the guard is only meaningful if the markup it looks for is what an error
// actually emits, so pin it against the goldens that hold one deliberately
test('the deliberate error goldens do carry that markup', () => {
  const errorGoldens = fs
    .readdirSync(SNAPSHOT_DIR)
    .filter(f => f.endsWith('.svg') && f.includes('error'))
  expect(errorGoldens.length).toBeGreaterThan(0)
  for (const f of errorGoldens) {
    expect(fs.readFileSync(path.join(SNAPSHOT_DIR, f), 'utf8')).toMatch(
      ERROR_MARKUP,
    )
  }
})
