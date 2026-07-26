import {
  DEFAULT_UPSTREAM_URL,
  buildUpstreamBody,
  looksLikeHtml,
  validateClientBody,
} from './proxy.ts'

export const DEFAULT_ISPCR_UPSTREAM_URL =
  'https://genome.ucsc.edu/cgi-bin/hgPcr'

// A primer pair is tens of bases. Anything near this is not a primer, and the
// shared key should not spend a slot finding that out upstream.
export const MAX_PRIMER_LENGTH = 1000

/**
 * What differs between the two UCSC CGIs this proxy fronts. The apiKey
 * injection, CORS, budget and cache are identical for both — only the upstream,
 * what a valid request looks like, and what a *successful* response looks like
 * change.
 */
export interface ProxyRoute {
  name: string
  defaultUpstreamUrl: string
  // env var an operator can point at a different upstream (a mirror, a test
  // double) without a redeploy of the client
  upstreamEnvVar: string
  contentType: string
  validate: (clientBody: string) => string | undefined
  buildBody: (clientBody: string, apiKey: string) => string
  // why this response is not a result, or undefined if it is one
  rejectReason: (text: string) => string | undefined
}

const KEY_REJECTED = 'the apiKey may be invalid or rate-limited'

export const BLAT_ROUTE: ProxyRoute = {
  name: 'blat',
  defaultUpstreamUrl: DEFAULT_UPSTREAM_URL,
  upstreamEnvVar: 'BLAT_UPSTREAM_URL',
  contentType: 'application/json',
  validate: validateClientBody,
  buildBody: buildUpstreamBody,
  // hgBlat has an output=json mode, so any HTML at all is a failure: the
  // Turnstile challenge, or a kent errAbort page
  rejectReason: text =>
    looksLikeHtml(text)
      ? `hgBlat returned HTML (CAPTCHA challenge or error page) instead of JSON — ${KEY_REJECTED}`
      : undefined,
}

// Markers of a Cloudflare interstitial. Kept narrow on purpose: an ordinary
// UCSC page's CSP whitelists `www.google.com/recaptcha/api.js`, so a bare
// `captcha` matches every real result page — including hgPcr's honest "No
// matches" — and would report a working server as a CAPTCHA wall.
//
// Duplicated in `plugins/blat/src/blatQuery.ts`, which decides the same thing
// about the same pages client-side. This package is standalone and cannot import
// the plugin, so the copies are deliberate: narrow one and narrow both.
const CHALLENGE_MARKERS = /turnstile|cf[-_]chl/i

export const ISPCR_ROUTE: ProxyRoute = {
  name: 'ispcr',
  defaultUpstreamUrl: DEFAULT_ISPCR_UPSTREAM_URL,
  upstreamEnvVar: 'ISPCR_UPSTREAM_URL',
  contentType: 'text/html',
  validate: clientBody => {
    const params = new URLSearchParams(clientBody)
    const forward = params.get('wp_f')
    const reverse = params.get('wp_r')
    const tooLong = [forward, reverse].some(
      primer => primer !== null && primer.length > MAX_PRIMER_LENGTH,
    )
    return forward && reverse
      ? tooLong
        ? `primer too large (> ${MAX_PRIMER_LENGTH} chars)`
        : undefined
      : 'missing or empty wp_f/wp_r primer pair'
  },
  // no output=json to force: hgPcr has no JSON mode, and its result IS the
  // HTML page (FASTA amplicons inside a <PRE>), so the body passes through
  // with only the apiKey overwritten
  buildBody: (clientBody, apiKey) => {
    const params = new URLSearchParams(clientBody)
    params.set('apiKey', apiKey)
    return params.toString()
  },
  // HTML is the success case here, so only an actual challenge is a rejection.
  // A "No matches" page relays through as a 200 — an empty result is an answer,
  // and the client renders it as one.
  rejectReason: text =>
    CHALLENGE_MARKERS.test(text)
      ? `hgPcr returned a CAPTCHA challenge instead of results — ${KEY_REJECTED}`
      : undefined,
}

export const ROUTES = [BLAT_ROUTE, ISPCR_ROUTE]

/**
 * Picks the route from an API Gateway path. The deployed path carries a stage
 * prefix (`/prod/ispcr`) while the configured routeKey does not (`POST /ispcr`),
 * so match the last segment rather than the whole string.
 */
export function routeForPath(path: string) {
  const last = path.slice(path.lastIndexOf('/') + 1)
  return ROUTES.find(route => route.name === last)
}
