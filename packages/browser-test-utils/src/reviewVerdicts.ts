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
  // every note. Written by the review tooling (website's flip-review.ts) rather
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
  if (!fs.existsSync(reportPath)) {
    return {}
  }
  const text = fs.readFileSync(reportPath, 'utf8')
  try {
    return JSON.parse(text) as Record<string, Verdict>
  } catch (e) {
    // Deliberately fatal rather than falling back to {}: an empty report would
    // be written straight back over the file by the next save, turning a
    // recoverable parse failure into the loss of every verdict in it.
    throw new Error(
      `${reportPath} is not valid JSON (${e}). It has not been modified — ` +
        `recover it with \`git checkout -- ${reportPath}\` before reviewing further.`,
      { cause: e },
    )
  }
}

// Replace the report in one step that a reader can never observe half-done.
//
// fs.writeFileSync truncates and then writes, so on a report this size there is
// a window where the file on disk is empty or partial: a concurrent reader gets
// a JSON parse error, and a process killed inside that window leaves the
// truncated file behind permanently. Staging beside the target keeps the rename
// on one filesystem, which is what makes it atomic — a reader sees either the
// whole old file or the whole new one. The pid suffix keeps two writers off a
// shared staging path.
function serialize(report: Record<string, Verdict>) {
  return `${JSON.stringify(report, null, 2)}\n`
}

function writeSerialized(reportPath: string, text: string) {
  const staging = `${reportPath}.${process.pid}.tmp`
  try {
    fs.writeFileSync(staging, text)
    fs.renameSync(staging, reportPath)
  } finally {
    fs.rmSync(staging, { force: true })
  }
}

export function saveReport(
  reportPath: string,
  report: Record<string, Verdict>,
) {
  writeSerialized(reportPath, serialize(report))
}

// Backstop for a lock we cannot read an owner out of — see breakDeadLock. It
// only has to exceed a real critical section (a read, a sha1 of one PNG and a
// write: single-digit ms), never how long a reviewer spends looking.
const LOCK_STALE_MS = 30_000
// How long to wait for a contended lock before giving up. Failing loudly is the
// point: the caller must not write a report it could not read under the lock.
const LOCK_WAIT_MS = 10_000
const LOCK_POLL_MS = 10

const sleepBuffer = new Int32Array(new SharedArrayBuffer(4))

// Pause without spinning the CPU. Every writer here is synchronous (fs.*Sync
// throughout, and the servers' handlers do their whole read-modify-write in one
// synchronous block), so there is no async point to yield at instead. Node
// permits Atomics.wait on the main thread, unlike the browser.
function sleepSync(ms: number) {
  Atomics.wait(sleepBuffer, 0, 0, ms)
}

function isErrno(e: unknown, code: string) {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: unknown }).code === code
  )
}

// Is the process that holds the lock still alive? Signal 0 asks the kernel
// without touching it, which is exact on the one machine this lock is ever
// contended on — better than inferring death from how long the lock has been
// held, since a live holder and a dead one look identical to a clock.
function ownerIsAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    // it exists, it just isn't ours to signal
    return isErrno(e, 'EPERM')
  }
}

// Break a lock whose owner died mid-section. Two breakers can still race here;
// the O_EXCL create below is what actually arbitrates, so the worst case is one
// wasted unlink.
function breakDeadLock(lock: string) {
  let owner: number
  try {
    owner = Number(fs.readFileSync(lock, 'utf8').trim())
  } catch {
    // released while we looked at it; nothing to break
    return
  }
  if (owner && owner !== process.pid) {
    if (!ownerIsAlive(owner)) {
      fs.rmSync(lock, { force: true })
    }
    return
  }
  // No readable owner: a process killed between creating the lock and stamping
  // its pid into it. Age is all that is left to go on.
  try {
    if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) {
      fs.rmSync(lock, { force: true })
    }
  } catch {
    // released while we looked at it
  }
}

// O_EXCL create is the lock: on every filesystem this runs on, it either
// creates the file or fails, with no window in between. The pid goes in so a
// waiter can tell a working holder from a dead one.
function acquireLock(lock: string) {
  const deadline = Date.now() + LOCK_WAIT_MS
  for (;;) {
    try {
      const fd = fs.openSync(lock, 'wx')
      fs.writeFileSync(fd, String(process.pid))
      return fd
    } catch (e) {
      if (!isErrno(e, 'EEXIST')) {
        throw e
      }
    }
    breakDeadLock(lock)
    if (Date.now() > deadline) {
      throw new Error(
        `timed out waiting for ${lock}, whose owner is still running. If no ` +
          `other review tool is live, delete it and retry.`,
      )
    }
    sleepSync(LOCK_POLL_MS)
  }
}

// Run a read-modify-write of the report under a lock no other process can hold
// at the same time.
//
// Several processes write the same report: more than one review server can run
// at once (both tools take a --port for exactly that), flip-review.ts flips
// entries from the command line, and it gets hand-edited besides. Each writer
// rewrites the WHOLE map, so without this the last writer silently drops every
// entry the others recorded since it loaded — the entry does not conflict, it
// just disappears. Loading inside the lock is what makes the merge correct:
// callers must mutate the report they are handed rather than one they loaded
// earlier.
export function updateReport<T>(
  reportPath: string,
  mutate: (report: Record<string, Verdict>) => T,
): T {
  const lock = `${reportPath}.lock`
  const fd = acquireLock(lock)
  try {
    const report = loadReport(reportPath)
    // A mutate that changes nothing must leave the file alone: the servers run
    // this on the rejected path of a precondition check too, and a refused write
    // that still bumped the mtime — or created the report, or reformatted
    // someone's hand-edit — would be doing exactly what it just declined to do.
    const before = serialize(report)
    const result = mutate(report)
    const after = serialize(report)
    if (after !== before) {
      writeSerialized(reportPath, after)
    }
    return result
  } finally {
    fs.closeSync(fd)
    fs.rmSync(lock, { force: true })
  }
}
