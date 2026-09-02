import { useState } from 'react'

import {
  isElectron,
  localStorageGetItem,
  localStorageSetItem,
} from '@jbrowse/core/util'

import {
  BlatChallengeError,
  challengeError,
  isChallengePage,
} from './blatQuery.ts'
import { desktopBlatFetch, openBlatChallenge } from './desktopBlat.ts'
import { addResultTrack, resolveUcscDb } from './ucscShared.ts'

import type { ResultTrackConf, UcscHost } from './ucscShared.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// the apiKey is a per-user UCSC account credential, not session state, so it's
// persisted across dialog opens
const API_KEY_STORAGE = 'ucsc-blat-apiKey'

// a browser fetch straight to genome.ucsc.edu is CORS-blocked and surfaces as
// an opaque TypeError; rethrow with the proxy requirement spelled out
async function browserUcscFetch(urlBase: string, body: string) {
  const response = await fetch(urlBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }).catch((e: unknown) => {
    throw new Error(
      `Could not reach the UCSC server at ${urlBase}. In the browser this must ` +
        `be a CORS-enabled proxy, not genome.ucsc.edu directly (${e}).`,
    )
  })
  return {
    ok: response.ok,
    status: response.status,
    text: await response.text(),
  }
}

// A CORS proxy in front of hgBlat answers a refusal with `{error}` JSON — a 429
// when the shared UCSC key's rate budget is spent, which is a sentence worth
// showing the user rather than the envelope it arrived in.
function serverMessage(text: string) {
  let message = text
  try {
    const parsed: unknown = JSON.parse(text)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      typeof parsed.error === 'string'
    ) {
      message = parsed.error
    }
  } catch {
    // not JSON, so the body itself is the best message available
  }
  return message
}

// A shared-proxy answer the direct UCSC server could still satisfy: its budget
// is spent (429), it is broken (5xx), or it never answered at all (0, the
// synthesized status for a throw). A 4xx other than 429 is the query's own
// fault and would fail identically upstream, so it is not retried.
function worthRetryingDirect(status: number) {
  return status === 0 || status === 429 || status >= 500
}

function ucscFetch(url: string, body: string) {
  return isElectron
    ? desktopBlatFetch({ url, body })
    : browserUcscFetch(url, body)
}

// Runs one UCSC query, routing through the desktop main process (to bypass the
// renderer's CORS restriction and reuse a solved-challenge cookie) or a direct
// browser fetch that expects a CORS-enabled proxy. The mode-specific pieces are
// just the POST body and the response parser.
//
// `fallbackUrl` is the desktop escape hatch: the dialog defaults to the shared
// jbrowse.org proxy so BLAT works with no apiKey and no CAPTCHA, but a desktop
// client can reach UCSC itself, so a proxy that is out of budget or down
// degrades to the direct path (and its CAPTCHA) instead of failing. A browser
// has nowhere to fall back to, and an explicitly chosen server is not
// second-guessed.
export async function runUcscFetch<T>({
  urlBase,
  fallbackUrl,
  body,
  parse,
}: {
  urlBase: string
  fallbackUrl?: string
  body: string
  parse: (text: string) => T
}) {
  // an unreachable proxy throws rather than answering, and that is exactly the
  // case the fallback exists for — but with no fallback the throw carries the
  // CORS explanation, so it is only swallowed when there is somewhere to go
  const first = fallbackUrl
    ? await ucscFetch(urlBase, body).catch(() => ({
        ok: false,
        status: 0,
        text: '',
      }))
    : await ucscFetch(urlBase, body)
  const { ok, status, text } =
    fallbackUrl && !first.ok && worthRetryingDirect(first.status)
      ? await ucscFetch(fallbackUrl, body)
      : first
  // the Cloudflare Turnstile challenge can arrive with a non-2xx status, so
  // probe the body for a challenge before failing generically — otherwise the
  // solve-CAPTCHA affordance never appears. A 2xx challenge is caught by parse().
  if (!ok) {
    if (isChallengePage(text)) {
      throw challengeError()
    }
    throw new Error(`UCSC request failed (${status}): ${serverMessage(text)}`)
  }
  return parse(text)
}

// Shared state and lifecycle for the BLAT and in-silico PCR dialogs: the UCSC
// connection fields (assembly/db/url/apiKey), and the submit → CAPTCHA-challenge
// → retry flow. Each dialog supplies its own inputs, validation, and query.
export function useUcscQuery({
  session,
  handleClose,
  defaultUrl,
  directUrl,
}: {
  session: UcscHost
  handleClose: () => void
  defaultUrl: string
  // the UCSC CGI itself, for the desktop paths that bypass the shared proxy
  directUrl: string
}) {
  const { assemblyNames } = session
  const [assembly, setAssembly] = useState(assemblyNames[0] ?? '')
  const [db, setDb] = useState(() =>
    resolveUcscDb(session, assemblyNames[0] ?? ''),
  )
  // mirrors changeApiKey for a key saved by an earlier run: the shared proxy
  // overwrites a client key with its own, so a stored key is only worth
  // anything against UCSC, and starting there is what spends the user's own key
  // rather than the shared budget
  const [urlBase, setUrlBase] = useState(() =>
    isElectron && localStorageGetItem(API_KEY_STORAGE) ? directUrl : defaultUrl,
  )
  const [apiKey, setApiKey] = useState(
    () => localStorageGetItem(API_KEY_STORAGE) ?? '',
  )
  const [loading, setLoading] = useState(false)
  const [challenged, setChallenged] = useState(false)
  const [error, setError] = useState<unknown>()
  // a query that ran fine and matched nothing is an answer, not a failure, so
  // it stays out of `error` (which renders as a red ErrorMessage)
  const [notFound, setNotFound] = useState('')

  // The shared proxy overwrites whatever apiKey a client sends with its own, so
  // a key typed here only means anything against UCSC directly. On desktop we
  // can go there, so entering a key moves the server field with it — visibly,
  // rather than quietly sending the query somewhere other than the URL shown.
  // A server the user typed themselves is left alone.
  function changeApiKey(key: string) {
    setApiKey(key)
    localStorageSetItem(API_KEY_STORAGE, key)
    if (isElectron && (urlBase === defaultUrl || urlBase === directUrl)) {
      setUrlBase(key ? directUrl : defaultUrl)
    }
  }

  function changeAssembly(name: string) {
    setAssembly(name)
    setDb(resolveUcscDb(session, name))
  }

  // only the untouched shared-proxy default falls back: an explicitly chosen
  // server, and the browser (which cannot reach UCSC), get one attempt
  const fallbackUrl =
    isElectron && urlBase === defaultUrl ? directUrl : undefined

  // `fetchResult` returns the hit list (which the results widget lists) and,
  // optionally, how to display it — a BLAT query returns a SAM alignments track
  // rather than the default feature track.
  async function runQuery({
    fetchResult,
    trackIdPrefix,
    trackName,
    emptyMessage,
    resultNoun,
  }: {
    fetchResult: () => Promise<{
      features: SimpleFeatureSerialized[]
      trackConf?: ResultTrackConf
    }>
    trackIdPrefix: string
    trackName: string
    emptyMessage: string
    // what the results panel calls one of these; hgPcr's are products, not hits
    resultNoun?: 'hit' | 'product'
  }) {
    setLoading(true)
    setError(undefined)
    setChallenged(false)
    setNotFound('')
    try {
      const { features, trackConf } = await fetchResult()
      if (features.length) {
        await addResultTrack({
          session,
          assembly,
          features,
          trackIdPrefix,
          trackName,
          trackConf,
          resultNoun,
        })
        handleClose()
      } else {
        setNotFound(emptyMessage)
      }
    } catch (e) {
      console.error(e)
      if (e instanceof BlatChallengeError) {
        setChallenged(true)
      }
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  // The window has to open on whichever host issued the challenge, because the
  // cf_clearance cookie a solve leaves behind is that host's. When the fallback
  // is armed the proxy is in front, and it answers a challenge of its own with a
  // 502 the fetch retries past — so a challenge that reaches the user at all was
  // served by the fallback, not by `urlBase`.
  async function solveChallenge(retry: () => void) {
    const solved = await openBlatChallenge(fallbackUrl ?? urlBase)
    if (solved) {
      retry()
    } else {
      session.notify('CAPTCHA window closed before it was solved', 'warning')
    }
  }

  return {
    assembly,
    db,
    urlBase,
    fallbackUrl,
    apiKey,
    loading,
    challenged,
    error,
    notFound,
    setDb,
    setUrlBase,
    changeApiKey,
    changeAssembly,
    runQuery,
    solveChallenge,
  }
}

export type UcscQuery = ReturnType<typeof useUcscQuery>
