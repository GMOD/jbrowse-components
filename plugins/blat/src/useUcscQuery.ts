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

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'

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

// Runs one UCSC query, routing through the desktop main process (to bypass the
// renderer's CORS restriction and reuse a solved-challenge cookie) or a direct
// browser fetch that expects a CORS-enabled proxy. The mode-specific pieces are
// just the POST body and the response parser.
export async function runUcscFetch({
  urlBase,
  body,
  parse,
}: {
  urlBase: string
  body: string
  parse: (text: string) => SimpleFeatureSerialized[]
}) {
  const { ok, status, text } = isElectron
    ? await desktopBlatFetch({ url: urlBase, body })
    : await browserUcscFetch(urlBase, body)
  // the Cloudflare Turnstile challenge can arrive with a non-2xx status, so
  // probe the body for a challenge before failing generically — otherwise the
  // solve-CAPTCHA affordance never appears. A 2xx challenge is caught by parse().
  if (!ok) {
    if (isChallengePage(text)) {
      throw challengeError()
    }
    throw new Error(`UCSC request failed (${status}): ${text}`)
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
}: {
  session: AbstractSessionModel
  handleClose: () => void
  defaultUrl: string
}) {
  const { assemblyNames } = session
  const [assembly, setAssembly] = useState(assemblyNames[0] ?? '')
  const [db, setDb] = useState(() =>
    resolveUcscDb(session, assemblyNames[0] ?? ''),
  )
  const [urlBase, setUrlBase] = useState(defaultUrl)
  const [apiKey, setApiKey] = useState(
    () => localStorageGetItem(API_KEY_STORAGE) ?? '',
  )
  const [loading, setLoading] = useState(false)
  const [challenged, setChallenged] = useState(false)
  const [error, setError] = useState<unknown>()

  function changeApiKey(key: string) {
    setApiKey(key)
    localStorageSetItem(API_KEY_STORAGE, key)
  }

  function changeAssembly(name: string) {
    setAssembly(name)
    setDb(resolveUcscDb(session, name))
  }

  async function runQuery({
    fetchFeatures,
    trackIdPrefix,
    trackName,
    emptyMessage,
  }: {
    fetchFeatures: () => Promise<SimpleFeatureSerialized[]>
    trackIdPrefix: string
    trackName: string
    emptyMessage: string
  }) {
    setLoading(true)
    setError(undefined)
    setChallenged(false)
    try {
      const features = await fetchFeatures()
      if (!features.length) {
        throw new Error(emptyMessage)
      }
      addResultTrack({ session, assembly, features, trackIdPrefix, trackName })
      handleClose()
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

  async function solveChallenge(retry: () => void) {
    const solved = await openBlatChallenge(urlBase)
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
    apiKey,
    loading,
    challenged,
    error,
    setDb,
    setUrlBase,
    changeApiKey,
    changeAssembly,
    runQuery,
    solveChallenge,
  }
}

export type UcscQuery = ReturnType<typeof useUcscQuery>
