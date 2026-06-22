import crypto from 'crypto'
import fs from 'fs'

// A review verdict for one snapshot/screenshot, recorded by the interactive
// review tools (website screenshot review and jbrowse-web browser-test review)
// and persisted to a per-tool JSON report.
export interface Verdict {
  name: string
  status: 'good' | 'bad'
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
