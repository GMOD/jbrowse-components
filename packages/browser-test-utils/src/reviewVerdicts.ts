import crypto from 'node:crypto'
import fs from 'node:fs'

// A review verdict for one snapshot/screenshot, recorded by the interactive
// review tools (website screenshot review and jbrowse-web browser-test review)
// and persisted to a per-tool JSON report.
export interface Verdict {
  name: string
  // 'good'/'bad' are the reviewer's call. 'answered' is the state between them:
  // a denial someone has since replied to in the note, with the ball back in the
  // reviewer's court. It exists because the staleness rule below only resurfaces
  // a verdict when the IMAGE moved, and the most common reply moves no pixels —
  // "no defect found", "nothing further to render", "here is why it is drawn
  // this way". Those answers used to sit under 'bad' at their original hash,
  // indistinguishable from open defects, and the only way to tell was to read
  // every note. Written by the review tooling (website's flip-review.mjs) rather
  // than by a reviewer clicking; the jbrowse-web browser-test review shares this
  // type but has no producer for it.
  status: 'good' | 'bad' | 'answered'
  note: string
  reviewedAt: string
  // sha1 of the reviewed image at the moment the verdict was recorded. A
  // verdict stays valid as long as the current image still hashes to this — so
  // an unchanged approval never resurfaces, and an image that was changed and
  // then reverted to the approved bytes re-validates against the same hash
  // automatically. Optional for forward-compat with reports written before
  // hashing existed (those are taken at face value).
  hash?: string
}

export function hashFile(file: string): string | undefined {
  return fs.existsSync(file)
    ? crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')
    : undefined
}

// A verdict resurfaces for review only when the image it was made against has
// changed — the stored hash no longer matches the current one. A verdict
// without a stored hash (pre-hashing report) is taken at face value.
export function isVerdictStale(
  verdict: Verdict | undefined,
  currentHash: string | undefined,
): boolean {
  return verdict?.hash !== undefined && verdict.hash !== currentHash
}

export function loadReport(reportPath: string): Record<string, Verdict> {
  return fs.existsSync(reportPath)
    ? (JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Record<
        string,
        Verdict
      >)
    : {}
}

export function saveReport(
  reportPath: string,
  report: Record<string, Verdict>,
) {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
}
