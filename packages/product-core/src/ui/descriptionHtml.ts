import { readConfSlot } from '@jbrowse/core/configuration'

import type { AboutConfig } from './util.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function descriptionUrl(value: string) {
  const href = new DOMParser()
    .parseFromString(value, 'text/html')
    .querySelector('a[href]')
    ?.getAttribute('href')
  const candidate = typeof href === 'string' ? href : value.trim()
  return /^https?:\/\//i.test(candidate) ? candidate : undefined
}

/**
 * The URL of a track's prose description page, as a UCSC track hub supplies it,
 * and undefined for anything that is not an http(s) url — the value reaches
 * `openLocation` and an anchor's href, so a `javascript:` or `file://` one does
 * not become one here.
 *
 * Four spellings: `UCSCTrackHubConnection` spreads the trackDb stanza across
 * `metadata`, the bulk converter behind genomes.jbrowse.org nests it under
 * `metadata.ucsc` (~50,700 configs at permanent URLs), and the stanza key is
 * `html` for a track and `htmlPath` for an assembly. Both producers write an
 * escaped anchor rather than a bare url, so the href comes back through a parse
 * rather than a regex.
 */
export function getDescriptionHtmlUrl(config: AboutConfig) {
  const metadata = readConfSlot(config, 'metadata')
  return [metadata, isRecord(metadata) ? metadata.ucsc : undefined]
    .flatMap(record => (isRecord(record) ? [record.html, record.htmlPath] : []))
    .filter(candidate => typeof candidate === 'string')
    .map(candidate => descriptionUrl(candidate))
    .find(url => url !== undefined)
}

function absolute(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).href
  } catch {
    return value
  }
}

/**
 * A fetched description page as markup for `SanitizedHTML`: links and images
 * resolved against the page they came from rather than the JBrowse origin, and
 * `<form>` dropped, which the sanitizer keeps and which in a document off a
 * third-party origin is a credential prompt wearing the app's own chrome.
 *
 * Parsing rather than string-rewriting is what makes taking `body` handle the
 * pages that are whole documents in the same pass. The parse is inert — no
 * scripts run, no images load — and the sanitizer still sees everything after.
 */
export function rebaseDescriptionHtml(html: string, baseUrl: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const form of doc.querySelectorAll('form')) {
    form.remove()
  }
  for (const el of doc.querySelectorAll('[href], [src]')) {
    for (const attribute of ['href', 'src']) {
      const value = el.getAttribute(attribute)
      if (value) {
        el.setAttribute(attribute, absolute(value, baseUrl))
      }
    }
  }
  return doc.body.innerHTML
}
