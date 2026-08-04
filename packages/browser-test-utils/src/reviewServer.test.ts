/**
 * @jest-environment node
 */
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { createVerdictRoutes, parseVerdictBody } from './reviewServer.ts'
import { loadReport, saveReport } from './reviewVerdicts.ts'

import type { Verdict } from './reviewVerdicts.ts'

// The verdict endpoints are what a reviewer's click actually does. Their job is
// to refuse, loudly, every write that would record something the reviewer did
// not mean: one composed against a verdict that has since moved, one composed
// against pixels that have since been replaced, and one that could never be
// re-examined because there is nothing to hash it against.

let dir: string
let reportPath: string
// what hashOf reports; the tests move it the way a regen does
let hash: string | undefined

let server: http.Server
let origin: string

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewserver-'))
  reportPath = path.join(dir, 'report.json')
  hash = 'hash-1'
  const routes = createVerdictRoutes({
    reportPath,
    hashOf: () => hash,
    statuses: ['good', 'bad', 'answered'],
  })
  server = http.createServer((req, res) => {
    const handler =
      req.url === '/clear' ? routes.handleClearVerdict : routes.handleVerdict
    handler(req, res).catch(() => {
      res.writeHead(500)
      res.end()
    })
  })
  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const addr = server.address()
  origin = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})

afterEach(async () => {
  await new Promise(resolve => {
    server.close(resolve)
  })
  fs.rmSync(dir, { recursive: true, force: true })
})

// every field any of these endpoints answers with, in one shape
interface ResponseBody {
  error?: string
  reason?: string
  stale?: boolean
  imageHash?: string | null
  current?: Verdict | null
  reviewedAt?: string
  status?: string
  hash?: string
  cleared?: boolean
}

async function post(url: string, body: unknown) {
  const res = await fetch(`${origin}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json()) as ResponseBody }
}

test('a verdict is stamped with the hash of the image on disk', async () => {
  const res = await post('/', { name: 'a', status: 'good', note: 'ok' })
  expect(res.status).toBe(200)
  expect(res.body).toMatchObject({ name: 'a', status: 'good', hash: 'hash-1' })
  expect(loadReport(reportPath).a).toMatchObject({ status: 'good', note: 'ok' })
})

test('an unknown status is rejected rather than written', async () => {
  const res = await post('/', { name: 'a', status: 'maybe' })
  expect(res.status).toBe(400)
  expect(loadReport(reportPath)).toEqual({})
})

test('a status this tool does not accept is not a valid body', async () => {
  const body = JSON.stringify({ name: 'a', status: 'answered' })
  expect(parseVerdictBody(body, ['good', 'bad'])).toBeUndefined()
  expect(parseVerdictBody(body, ['good', 'bad', 'answered'])).toMatchObject({
    name: 'a',
    status: 'answered',
  })
})

test('a malformed precondition is a bad body, not a silent opt-out', async () => {
  const res = await post('/', { name: 'a', status: 'good', ifReviewedAt: 42 })
  expect(res.status).toBe(400)
  expect(loadReport(reportPath)).toEqual({})
})

test('an omitted precondition writes unconditionally, for curl and scripts', async () => {
  await post('/', { name: 'a', status: 'bad' })
  const res = await post('/', { name: 'a', status: 'good' })
  expect(res.status).toBe(200)
  expect(loadReport(reportPath).a!.status).toBe('good')
})

test('a write against a verdict that moved is refused with what is on disk', async () => {
  const first = await post('/', { name: 'a', status: 'bad', note: 'why' })
  // another writer — a second review server, flip-review, a hand edit
  const report = loadReport(reportPath)
  report.a = { ...report.a!, status: 'answered', reviewedAt: 'later' }
  saveReport(reportPath, report)

  const res = await post('/', {
    name: 'a',
    status: 'good',
    ifReviewedAt: first.body.reviewedAt,
  })
  expect(res.status).toBe(409)
  expect(res.body).toMatchObject({ reason: 'verdict' })
  expect(res.body.current).toMatchObject({ status: 'answered' })
  // and the refused write left the other writer's entry alone
  expect(loadReport(reportPath).a!.status).toBe('answered')
})

test('a write against pixels that moved is refused as an image conflict', async () => {
  await post('/', { name: 'a', status: 'good' })
  const stored = loadReport(reportPath).a!
  // a regen lands while the page is open
  hash = 'hash-2'

  const res = await post('/', {
    name: 'a',
    status: 'good',
    ifReviewedAt: stored.reviewedAt,
    ifImageHash: 'hash-1',
  })
  expect(res.status).toBe(409)
  expect(res.body).toMatchObject({ reason: 'image', imageHash: 'hash-2' })
  // the page can tell from the response that its verdict is now stale
  expect(res.body.stale).toBe(true)
  expect(loadReport(reportPath).a!.hash).toBe('hash-1')
})

test('a verdict with nothing to hash against is refused, not recorded', async () => {
  // a verdict with no hash can never resurface: isVerdictStale has nothing to
  // compare, so it would outlive every version of the image that replaced it
  hash = undefined
  const res = await post('/', { name: 'a', status: 'bad', note: 'missing' })
  expect(res.status).toBe(400)
  expect(res.body.error).toMatch(/no image on disk/)
  expect(loadReport(reportPath)).toEqual({})
})

test('clearing takes the same precondition and refuses when it fails', async () => {
  const first = await post('/', { name: 'a', status: 'good' })
  const stale = await post('/clear', { name: 'a', ifReviewedAt: 'never-was' })
  expect(stale.status).toBe(409)
  expect(loadReport(reportPath).a).toBeDefined()

  const ok = await post('/clear', {
    name: 'a',
    ifReviewedAt: first.body.reviewedAt,
  })
  expect(ok.status).toBe(200)
  expect(loadReport(reportPath)).toEqual({})
})

test('an entry whose image is gone can still be cleared', async () => {
  const entry: Verdict = {
    name: 'a',
    status: 'bad',
    note: '',
    reviewedAt: '2026-01-01T00:00:00.000Z',
  }
  saveReport(reportPath, { a: entry })
  hash = undefined

  // null says "there was no verdict", and there is one, so this is a conflict
  const res = await post('/clear', { name: 'a', ifReviewedAt: null })
  expect(res.status).toBe(409)

  const ok = await post('/clear', { name: 'a', ifReviewedAt: entry.reviewedAt })
  expect(ok.status).toBe(200)
  expect(loadReport(reportPath)).toEqual({})
})
