/**
 * The few track load failures whose cause the error text gives away, each told
 * in one sentence: what is wrong, the URL where the error names one, and what
 * fixes it — the voice of `refNameMismatchMessage`. Classified on the text and
 * never on the error's type, because a failure from the RPC worker arrives as
 * a string. Anything else answers undefined and is shown as it always was.
 *
 * The wording matched is that of the two libraries remote reads go through:
 * `@gmod/range-cache-filehandle` (`HTTP 404 fetching <url> bytes 0-65535 (no
 * such file; ...)`, `Network error fetching <url> (...)`) and
 * generic-filehandle2 under it (`Failed to fetch fetching <url>`). The first
 * already appends a parenthetical hint; the sentence here replaces it with
 * one that leads with the URL and names the setting to change. Two of its
 * network diagnoses are more specific than "server down or CORS" — a mixed
 * content block and an offline browser — so those stay as they are.
 */
const INDEX_EXTENSION = /\.(bai|csi|tbi|crai|fai|gzi)(?:[?#]|$)/i

const NETWORK_FAILURE =
  /(?:Network error|Failed to fetch|NetworkError when attempting to fetch resource|Load failed) fetching (\S+)/

const SPECIFIC_NETWORK_DIAGNOSIS =
  /no network connection|a page served over https may not load/

const IGNORED_RANGE =
  /HTTP 200 fetching (\S+) bytes|(\S+) fetch returned status 200, expected 206/

function indexFormatHint(format: string) {
  return `The index is not a ${format} file: point the track's index location at the .${format.toLowerCase()} made for this data file.`
}

export function loadErrorHint(text: string) {
  const notFound = /HTTP 404 fetching (\S+)/.exec(text)?.[1]
  const unreachable = SPECIFIC_NETWORK_DIAGNOSIS.test(text)
    ? undefined
    : NETWORK_FAILURE.exec(text)?.[1]
  const rangeMatch = IGNORED_RANGE.exec(text)
  const ignoredRange = rangeMatch?.[1] ?? rangeMatch?.[2]
  const wrongIndex = /Not a (BAI|TBI|CSI) file/.exec(text)?.[1]
  return notFound
    ? INDEX_EXTENSION.test(notFound)
      ? `The index ${notFound} was not found (HTTP 404): set the track's index location, or put the index beside the data file.`
      : `${notFound} was not found (HTTP 404): check the track's file location for a typo or a file that moved.`
    : unreachable
      ? `${unreachable} could not be reached: the server is down, or it does not send the CORS headers (Access-Control-Allow-Origin, Access-Control-Expose-Headers: Content-Range) that let this site read it.`
      : ignoredRange
        ? `${ignoredRange} sent the whole file instead of the requested bytes: the server must support HTTP Range requests.`
        : wrongIndex
          ? indexFormatHint(wrongIndex)
          : text.includes('invalid .crai index file')
            ? indexFormatHint('CRAI')
            : undefined
}
