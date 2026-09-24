import { execFileSync } from 'node:child_process'
import { createHash, createPublicKey } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createSecureTestServer,
  createTestServer,
} from '@jbrowse/browser-test-utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const jbrowseWebRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(__dirname, '../../..')
export const buildPath = path.join(jbrowseWebRoot, 'build')

export function startServer(port: number) {
  return createTestServer(port, { jbrowseWebRoot, repoRoot })
}

/**
 * A throwaway localhost certificate, and the SPKI hash that makes Chrome trust
 * it. `--ignore-certificate-errors` would load the page too, but Chrome turns
 * its HTTP cache off for a page with a certificate error, so a load measured
 * that way re-fetches every file it should have kept.
 */
export function localhostCert() {
  const dir = mkdtempSync(path.join(tmpdir(), 'jbrowse-cert-'))
  try {
    execFileSync(
      'openssl',
      [
        ...['req', '-x509', '-newkey', 'ec'],
        ...['-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes'],
        ...['-keyout', `${dir}/key.pem`, '-out', `${dir}/cert.pem`],
        ...['-days', '1', '-subj', '/CN=localhost'],
        ...['-addext', 'subjectAltName=DNS:localhost'],
      ],
      { stdio: 'ignore' },
    )
    const cert = readFileSync(`${dir}/cert.pem`, 'utf8')
    const spki = createHash('sha256')
      .update(createPublicKey(cert).export({ type: 'spki', format: 'der' }))
      .digest('base64')
    return { key: readFileSync(`${dir}/key.pem`, 'utf8'), cert, spki }
  } finally {
    rmSync(dir, { recursive: true })
  }
}

export function startSecureServer(
  port: number,
  { key, cert }: { key: string; cert: string },
) {
  return createSecureTestServer(port, { jbrowseWebRoot, repoRoot, key, cert })
}

/**
 * Start the test server on `preferred`, or the next free port after it.
 *
 * The default is a fixed number, and in a worktree shared by several agents it
 * is regularly held by someone else's run or a dev server — which used to abort
 * the whole suite on EADDRINUSE before a single test ran. Walking up costs
 * nothing when the port is free and turns "someone else is testing" from a hard
 * stop into a different number in the url.
 *
 * The caller must publish the port it gets back (see setPort in helpers), since
 * every url the suites build is relative to it.
 */
export function startServerOnFreePort(preferred: number, attempts = 20) {
  return onFreePort(preferred, startServer, attempts)
}

export function startSecureServerOnFreePort(
  preferred: number,
  tls: { key: string; cert: string },
) {
  return onFreePort(preferred, port => startSecureServer(port, tls))
}

async function onFreePort<S>(
  preferred: number,
  start: (port: number) => Promise<S>,
  attempts = 20,
) {
  for (let port = preferred; port < preferred + attempts; port++) {
    try {
      return { server: await start(port), port }
    } catch (e) {
      // compare the code, never instanceof: this rejects with whatever node's
      // net module threw, which may come from another realm
      if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
        throw e
      }
    }
  }
  throw new Error(
    `no free port in ${preferred}..${preferred + attempts - 1} for the test server`,
  )
}
