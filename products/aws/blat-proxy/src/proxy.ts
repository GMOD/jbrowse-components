export const DEFAULT_UPSTREAM_URL = 'https://genome.ucsc.edu/cgi-bin/hgBlat'

// The jbrowse-plugin-blat client already POSTs a well-formed hgBlat body
// (userSeq/type/db/output). The proxy's only job is to force the shared apiKey
// (and JSON output) onto that body so the key never ships in the browser
// bundle, and to add CORS headers a direct genome.ucsc.edu call can't provide.
// Any client-supplied apiKey is overwritten with the server's.
export function buildUpstreamBody(clientBody: string, apiKey: string) {
  const params = new URLSearchParams(clientBody)
  params.set('apiKey', apiKey)
  params.set('output', 'json')
  return params.toString()
}

// hgBlat returns an HTML page (the Cloudflare Turnstile challenge, or an error
// page) instead of JSON when the request is rejected; detect it so the proxy
// can relay a clear error rather than passing HTML through as if it were data.
export function looksLikeHtml(text: string) {
  return text.trimStart().startsWith('<')
}

// hgBlat takes 50,000 bases across a submission; this proxy spends ONE shared
// apiKey, so reject an over-budget (or empty) userSeq here rather than burning a
// slot on a call hgBlat will refuse anyway. The cap is on characters, not bases,
// and a well-formed submission carries FASTA headers and line breaks as well as
// its residues — hence the headroom over the number UCSC states.
export const MAX_USER_SEQ_LENGTH = 100_000

// Returns a human-readable reason to reject the request before the upstream
// call, or undefined if it's worth relaying.
export function validateClientBody(clientBody: string) {
  const userSeq = new URLSearchParams(clientBody).get('userSeq')
  return userSeq
    ? userSeq.length > MAX_USER_SEQ_LENGTH
      ? `userSeq too large (${userSeq.length} > ${MAX_USER_SEQ_LENGTH} chars)`
      : undefined
    : 'missing or empty userSeq'
}
