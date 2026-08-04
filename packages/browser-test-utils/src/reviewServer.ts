import { isVerdictStale, updateReport } from './reviewVerdicts.ts'

import type { Verdict } from './reviewVerdicts.ts'
import type http from 'node:http'

// The HTTP half of a review tool: the two endpoints that write a verdict, and
// the body parsing and precondition checks that keep those writes honest. Both
// review UIs (the website's screenshot review and jbrowse-web's browser-test
// snapshot review) serve their own images and their own page, but the write
// protocol is the same one and its rules are subtle enough — locked
// read-modify-write, two preconditions, a 409 the client has to be able to
// recover from — that a second copy of it is a second place for them to drift.

// A verdict body is a name, a status and a note; a megabyte is already orders
// of magnitude more than the longest note anyone has typed.
const maxBodyBytes = 1024 * 1024

export function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => {
      data += chunk
      if (data.length > maxBodyBytes) {
        req.destroy()
        reject(new Error('request body too large'))
      }
    })
    req.on('end', () => {
      resolve(data)
    })
    // A request that errors or is aborted never fires 'end'. Without these the
    // promise stays pending for the life of the process, and an 'error' with no
    // listener is an unhandled error event that takes the server down — which,
    // if it lands mid-write, is exactly how the report gets truncated. 'close'
    // fires after 'end' too, but rejecting a settled promise is a no-op.
    req.on('error', reject)
    req.on('close', () => {
      reject(new Error('request closed before its body ended'))
    })
  })
}

export function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

// What the client had in hand when it composed the write: `ifReviewedAt` is the
// verdict's `reviewedAt` it last saw, `ifImageHash` the hash of the image it
// actually rendered. `null` means "there was none", and an absent field opts out
// of that check (curl and scripts, which have nothing stale to revert). Anything
// else is a malformed body rather than a silent opt-out.
type Precondition = string | null | undefined

// Validate untrusted request bodies rather than blindly casting; a malformed
// POST otherwise writes a garbage verdict into the report.
function asRecord(raw: string): Record<string, unknown> | undefined {
  const body: unknown = JSON.parse(raw)
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)
    : undefined
}

function parseName(body: Record<string, unknown>): string | undefined {
  return typeof body.name === 'string' && body.name !== ''
    ? body.name
    : undefined
}

function parsePrecondition(
  body: Record<string, unknown>,
  field: 'ifReviewedAt' | 'ifImageHash',
): { ok: true; value: Precondition } | { ok: false } {
  if (!(field in body)) {
    return { ok: true, value: undefined }
  }
  const v = body[field]
  return typeof v === 'string' || v === null
    ? { ok: true, value: v }
    : { ok: false }
}

interface VerdictBody {
  name: string
  status: Verdict['status']
  note: string
  ifReviewedAt: Precondition
  ifImageHash: Precondition
}

export function parseVerdictBody(
  raw: string,
  statuses: readonly Verdict['status'][],
): VerdictBody | undefined {
  const body = asRecord(raw)
  const name = body && parseName(body)
  if (!body || name === undefined) {
    return undefined
  }
  const status = statuses.find(s => s === body.status)
  if (status === undefined) {
    return undefined
  }
  const pre = parsePrecondition(body, 'ifReviewedAt')
  const img = parsePrecondition(body, 'ifImageHash')
  if (!pre.ok || !img.ok) {
    return undefined
  }
  return {
    name,
    status,
    note: typeof body.note === 'string' ? body.note : '',
    ifReviewedAt: pre.value,
    ifImageHash: img.value,
  }
}

export function parseNameBody(
  raw: string,
): { name: string; ifReviewedAt: Precondition } | undefined {
  const body = asRecord(raw)
  const name = body && parseName(body)
  if (!body || name === undefined) {
    return undefined
  }
  const pre = parsePrecondition(body, 'ifReviewedAt')
  return pre.ok ? { name, ifReviewedAt: pre.value } : undefined
}

// True when the entry moved underneath the client since it loaded — another
// review server, a CLI flip, a hand edit, a branch switch. Writing anyway would
// silently revert that change, which is what a page left open for an afternoon
// does every time its note field loses focus.
function isConflict(stored: Verdict | undefined, ifReviewedAt: Precondition) {
  return (
    ifReviewedAt !== undefined && (stored?.reviewedAt ?? null) !== ifReviewedAt
  )
}

type Outcome =
  | { kind: 'ok'; verdict?: Verdict }
  | {
      kind: 'conflict'
      reason: 'verdict' | 'image'
      current: Verdict | undefined
      hash: string | undefined
    }
  | { kind: 'no-image' }

// Why a write was refused, in the shape the client's readWriteResponse reads:
// 409 is a conflict it can recover from by adopting what the server reports,
// anything else is an error it shows verbatim.
function sendRefusal(
  res: http.ServerResponse,
  name: string,
  outcome: Exclude<Outcome, { kind: 'ok' }>,
) {
  if (outcome.kind === 'conflict') {
    sendJson(res, 409, {
      error: 'changed since your page loaded',
      reason: outcome.reason,
      current: outcome.current ?? null,
      stale: isVerdictStale(outcome.current, outcome.hash),
      imageHash: outcome.hash ?? null,
    })
  } else {
    // A verdict with no hash is taken at face value forever (isVerdictStale has
    // nothing to compare), so it could never resurface once the image finally
    // lands — the approval of an absent picture would outlive every version of
    // the picture that replaced it. Refuse instead of recording that.
    sendJson(res, 400, {
      error: `no image on disk for ${name} — nothing to record a verdict against; regenerate it first`,
    })
  }
}

export interface VerdictRouteOptions {
  reportPath: string
  // Hash of the image a verdict for `name` is about, as it is on disk right
  // now. Called inside the report lock, so the hash a verdict is stamped with
  // is the one its precondition was checked against.
  hashOf: (name: string) => string | undefined
  // Statuses this tool accepts. The website review adds 'answered'; the
  // browser-test review has no producer for it.
  statuses: readonly Verdict['status'][]
}

export function createVerdictRoutes({
  reportPath,
  hashOf,
  statuses,
}: VerdictRouteOptions) {
  return {
    async handleVerdict(req: http.IncomingMessage, res: http.ServerResponse) {
      const parsed = parseVerdictBody(await readBody(req), statuses)
      if (!parsed) {
        sendJson(res, 400, { error: 'invalid verdict body' })
        return
      }
      const { ifReviewedAt, ifImageHash, ...fields } = parsed
      // The report is loaded, checked and written inside one lock: reading it
      // out here first would reopen the lost-update window the lock exists to
      // close. The image check belongs in here too — the image is hashed under
      // the same lock that stamps the hash, so a regen cannot slip between the
      // two.
      const outcome = updateReport<Outcome>(reportPath, report => {
        const current = report[fields.name]
        const hash = hashOf(fields.name)
        if (isConflict(current, ifReviewedAt)) {
          return { kind: 'conflict', reason: 'verdict', current, hash }
        }
        // The verdict precondition cannot see a changed image: nothing about
        // the verdict changed, only the picture it would be recorded against.
        // Left unchecked, the reviewer approves the image they are looking at
        // and the server stamps the hash of the one that replaced it, which
        // reads afterwards as a considered approval of pixels nobody ever saw.
        if (ifImageHash !== undefined && (hash ?? null) !== ifImageHash) {
          return { kind: 'conflict', reason: 'image', current, hash }
        }
        if (hash === undefined) {
          return { kind: 'no-image' }
        }
        const verdict: Verdict = {
          ...fields,
          reviewedAt: new Date().toISOString(),
          hash,
        }
        report[fields.name] = verdict
        return { kind: 'ok', verdict }
      })
      if (outcome.kind === 'ok') {
        sendJson(res, 200, outcome.verdict)
      } else {
        sendRefusal(res, fields.name, outcome)
      }
    },

    async handleClearVerdict(
      req: http.IncomingMessage,
      res: http.ServerResponse,
    ) {
      const parsed = parseNameBody(await readBody(req))
      if (!parsed) {
        sendJson(res, 400, { error: 'invalid body' })
        return
      }
      const { name, ifReviewedAt } = parsed
      const outcome = updateReport<Outcome>(reportPath, report => {
        const current = report[name]
        if (isConflict(current, ifReviewedAt)) {
          return {
            kind: 'conflict',
            reason: 'verdict',
            current,
            hash: hashOf(name),
          }
        }
        delete report[name]
        return { kind: 'ok' }
      })
      if (outcome.kind === 'ok') {
        sendJson(res, 200, { name, cleared: true })
      } else {
        sendRefusal(res, name, outcome)
      }
    },
  }
}
