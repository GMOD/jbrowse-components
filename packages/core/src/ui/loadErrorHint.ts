/**
 * The few track load failures whose cause the error text gives away, each told
 * in one sentence: what is wrong, the URL where the error names one, and what
 * fixes it — the voice of `refNameMismatchMessage`. Classified on the text and
 * never on the error's type, because a failure from the RPC worker arrives as
 * a string. Anything else answers undefined and is shown as it always was.
 *
 * The URL comes from generic-filehandle2's wording, `<what> fetching <url>`
 * and `<url> fetch returned status 200, expected 206`.
 */
const INDEX_EXTENSION = /\.(bai|csi|tbi|crai|fai|gzi)(?:[?#]|$)/i

const NETWORK_FAILURE =
  /(?:Failed to fetch|NetworkError when attempting to fetch resource|Load failed) fetching (\S+)/

function indexFormatHint(format: string) {
  return `The index is not a ${format} file: point the track's index location at the .${format.toLowerCase()} made for this data file.`
}

export function loadErrorHint(text: string) {
  const notFound = /HTTP 404 fetching (\S+)/.exec(text)?.[1]
  const unreachable = NETWORK_FAILURE.exec(text)?.[1]
  const ignoredRange = /(\S+) fetch returned status 200, expected 206/.exec(
    text,
  )?.[1]
  const wrongIndex = /Not a (BAI|TBI|CSI) file/.exec(text)?.[1]
  return notFound
    ? INDEX_EXTENSION.test(notFound)
      ? `The index ${notFound} was not found (HTTP 404): set the track's index location, or put the index beside the data file.`
      : `${notFound} was not found (HTTP 404): check the track's file location for a typo or a file that moved.`
    : unreachable
      ? `${unreachable} could not be reached: the server is down, or it does not send the CORS headers that let this site read it.`
      : ignoredRange
        ? `${ignoredRange} sent the whole file instead of the requested bytes: the server must support HTTP Range requests.`
        : wrongIndex
          ? indexFormatHint(wrongIndex)
          : text.includes('invalid .crai index file')
            ? indexFormatHint('CRAI')
            : undefined
}
