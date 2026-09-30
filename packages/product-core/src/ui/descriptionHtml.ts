function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

/**
 * Where UCSC trackDb text sits when the golden-path assemblies the UCSC
 * Genome Browser serves itself carry it inline: their `html` holds the page,
 * written to render inside `hgTrackUi`, so its relative links (`hgTables`,
 * `/goldenPath/help/…`) resolve against that.
 */
const UCSC_TRACK_PAGE = 'https://genome.ucsc.edu/cgi-bin/hgTrackUi'

export type TrackDescription = { url: string } | { html: string }

function parseDescription(value: string, inline: boolean) {
  const body = new DOMParser().parseFromString(value, 'text/html').body
  const [first] = body.children
  if (!first) {
    const text = value.trim()
    return isHttpUrl(text) ? { url: text } : undefined
  }
  const loneAnchor =
    body.children.length === 1 &&
    first.matches('a[href]') &&
    body.textContent.trim() === first.textContent.trim()
  if (loneAnchor) {
    const href = first.getAttribute('href') ?? ''
    return isHttpUrl(href) ? { url: href } : undefined
  }
  return inline
    ? { html: rebaseDescriptionHtml(value, UCSC_TRACK_PAGE) }
    : undefined
}

/**
 * A track's prose description in its `metadata`, as UCSC trackDb supplies it:
 * a link to a page to fetch, or the page itself.
 *
 * Four spellings: `UCSCTrackHubConnection` spreads the trackDb stanza across
 * `metadata`, the bulk converter behind genomes.jbrowse.org nests it under
 * `metadata.ucsc` (~50,700 configs at permanent URLs), and the stanza key is
 * `html` for a track and `htmlPath` for an assembly. Both producers write an
 * escaped anchor for a hub's page, so the href comes back through a parse. The
 * converter writes golden-path assemblies' pages inline, and only under `ucsc`
 * is markup read as a page, so a track's own `html` column stays a column.
 *
 * A url is http(s) only: it reaches `openLocation` and an anchor's href.
 * `path` names the key read, which the metadata card leaves out.
 */
export function findTrackDescription(metadata: unknown) {
  const ucsc = isRecord(metadata) ? metadata.ucsc : undefined
  const places = [
    { record: metadata, prefix: [] as string[], inline: false },
    { record: ucsc, prefix: ['ucsc'], inline: true },
  ]
  for (const { record, prefix, inline } of places) {
    for (const key of ['html', 'htmlPath']) {
      const value = isRecord(record) ? record[key] : undefined
      const description =
        typeof value === 'string' ? parseDescription(value, inline) : undefined
      if (description) {
        return { description, path: [...prefix, key] }
      }
    }
  }
  return undefined
}

export function getTrackDescription(
  metadata: unknown,
): TrackDescription | undefined {
  return findTrackDescription(metadata)?.description
}

/**
 * `metadata` without the key its description came from, since the Description
 * card shows that one.
 */
export function omitTrackDescription(metadata: Record<string, unknown>) {
  const path = findTrackDescription(metadata)?.path
  if (!path) {
    return metadata
  }
  const [key = '', nestedKey] = path
  const nested = metadata[key]
  return nestedKey !== undefined && isRecord(nested)
    ? { ...metadata, [key]: without(nested, nestedKey) }
    : without(metadata, key)
}

function without(record: Record<string, unknown>, key: string) {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key))
}

function absolute(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).href
  } catch {
    return value
  }
}

/**
 * A description page as markup for `SanitizedHTML`: links and images resolved
 * against the page they came from rather than the JBrowse origin, and
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
