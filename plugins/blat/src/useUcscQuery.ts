import { useState } from 'react'

import { challengeError, isChallengePage } from './blatQuery.ts'
import { addResultTrack, resolveUcscDb } from './ucscShared.ts'

import type { ResultTrackConf, UcscHost } from './ucscShared.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// genome.ucsc.edu sends no CORS headers, so a fetch straight to it surfaces as
// an opaque TypeError; rethrow with the proxy requirement spelled out
async function ucscFetch(urlBase: string, body: string) {
  const response = await fetch(urlBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }).catch((e: unknown) => {
    throw new Error(
      `Could not reach the BLAT server at ${urlBase}. It must be a CORS-enabled ` +
        `proxy, not genome.ucsc.edu directly (${e}).`,
    )
  })
  return {
    ok: response.ok,
    status: response.status,
    text: await response.text(),
  }
}

// The proxy answers a refusal with `{error}` JSON, a sentence worth showing the
// user rather than the envelope it arrived in.
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

// The proxy's refusal says how long until it would answer. One that clears
// this soon is the shared key's one-query-per-15-s slot, taken by someone else,
// and worth waiting out; a longer one is a spent share or day, which waiting in
// a dialog will not fix.
const SLOT_WAIT_MAX_SECONDS = 30
const TOTAL_WAIT_MAX_SECONDS = 120

function slotWaitSeconds({ status, text }: { status: number; text: string }) {
  let seconds: number | undefined
  if (status === 429) {
    try {
      const parsed: unknown = JSON.parse(text)
      const retry =
        parsed !== null &&
        typeof parsed === 'object' &&
        'retryAfterSeconds' in parsed
          ? parsed.retryAfterSeconds
          : undefined
      seconds =
        typeof retry === 'number' && retry > 0 && retry <= SLOT_WAIT_MAX_SECONDS
          ? retry
          : undefined
    } catch {
      // not the proxy's JSON refusal, so there is nothing to wait for
    }
  }
  return seconds
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('BLAT search cancelled'))
      },
      { once: true },
    )
  })
}

// Runs one query against the BLAT server, the shared jbrowse.org proxy unless
// the user pointed the dialog elsewhere. A query refused only because the
// shared key's slot is busy waits it out, reporting each wait through `onWait`.
export async function runUcscFetch<T>({
  urlBase,
  body,
  parse,
  onWait,
  signal,
}: {
  urlBase: string
  body: string
  parse: (text: string) => T
  onWait?: (seconds: number | undefined) => void
  signal?: AbortSignal
}) {
  let waited = 0
  let response = await ucscFetch(urlBase, body)
  let wait = slotWaitSeconds(response)
  while (wait !== undefined && waited + wait <= TOTAL_WAIT_MAX_SECONDS) {
    onWait?.(wait)
    await sleep(wait * 1000, signal)
    waited += wait
    response = await ucscFetch(urlBase, body)
    wait = slotWaitSeconds(response)
  }
  onWait?.(undefined)
  const { ok, status, text } = response
  // a server that relays UCSC's Cloudflare challenge can do so with a non-2xx
  // status, so name the challenge rather than failing generically. A 2xx
  // challenge is caught by parse().
  if (!ok) {
    if (isChallengePage(text)) {
      throw challengeError()
    }
    throw new Error(`UCSC request failed (${status}): ${serverMessage(text)}`)
  }
  return parse(text)
}

// Shared state and lifecycle for the BLAT and in-silico PCR dialogs: the
// assembly, the UCSC database and the server, and a query's wait, result and
// cancellation. Each dialog supplies its own inputs, validation, and query.
export function useUcscQuery({
  session,
  handleClose,
  defaultUrl,
  initialAssembly,
}: {
  session: UcscHost
  handleClose: () => void
  defaultUrl: string
  initialAssembly: string
}) {
  const [assembly, setAssembly] = useState(initialAssembly)
  const [db, setDb] = useState(() => resolveUcscDb(session, initialAssembly))
  const [urlBase, setUrlBase] = useState(defaultUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  // a query that ran fine and matched nothing is an answer, not a failure, so
  // it stays out of `error` (which renders as a red ErrorMessage)
  const [notFound, setNotFound] = useState('')
  // seconds until a query waiting out the shared key's slot retries
  const [slotWait, setSlotWait] = useState<number>()
  // the query in flight, so closing the dialog stops it rather than letting it
  // land a track after the dialog is gone
  const [pending, setPending] = useState<AbortController>()

  function close() {
    pending?.abort()
    handleClose()
  }

  function changeAssembly(name: string) {
    setAssembly(name)
    setDb(resolveUcscDb(session, name))
  }

  // `fetchResult` is handed the fetch to run its query with, already pointed at
  // the server and this query's cancellation, and returns the hit list (which
  // the results widget lists) and, optionally, how to display it — a BLAT query
  // returns a SAM alignments track rather than the default feature track.
  async function runQuery({
    fetchResult,
    trackIdPrefix,
    trackName,
    emptyMessage,
    resultNoun,
    queries,
  }: {
    fetchResult: (fetchUcsc: FetchUcsc) => Promise<{
      features: SimpleFeatureSerialized[]
      trackConf?: ResultTrackConf
    }>
    trackIdPrefix: string
    trackName: string
    emptyMessage: string
    // what the results panel calls one of these; hgPcr's are products, not hits
    resultNoun?: 'hit' | 'product'
    queries?: string[]
  }) {
    const controller = new AbortController()
    const { signal } = controller
    setPending(controller)
    setLoading(true)
    setError(undefined)
    setNotFound('')
    try {
      const { features, trackConf } = await fetchResult(request =>
        runUcscFetch({
          ...request,
          urlBase,
          signal,
          onWait: seconds => {
            setSlotWait(seconds)
          },
        }),
      )
      if (!signal.aborted) {
        if (features.length) {
          await addResultTrack({
            session,
            assembly,
            features,
            trackIdPrefix,
            trackName,
            trackConf,
            resultNoun,
            queries,
          })
          handleClose()
        } else {
          setNotFound(emptyMessage)
        }
      }
    } catch (e) {
      if (!signal.aborted) {
        console.error(e)
        setError(e)
      }
    } finally {
      setLoading(false)
      setSlotWait(undefined)
      setPending(undefined)
    }
  }

  return {
    assembly,
    db,
    urlBase,
    loading,
    error,
    notFound,
    slotWait,
    setDb,
    setUrlBase,
    changeAssembly,
    runQuery,
    close,
  }
}

export type UcscQuery = ReturnType<typeof useUcscQuery>

export type FetchUcsc = <T>(request: {
  body: string
  parse: (text: string) => T
}) => Promise<T>
