// Copies text to the clipboard. Replaces the `copy-to-clipboard` dependency.
//
// The async Clipboard API is preferred for plain text, but it only works in
// secure contexts (https:// or localhost). JBrowse is frequently served over
// plain http:// on intranet/institutional servers, so we fall back to the
// execCommand('copy') path there. The execCommand path also handles rich
// `text/html` copying via the copy event's clipboardData, which writeText
// cannot do.
interface CopyOptions {
  // MIME type to write, e.g. 'text/plain' (default) or 'text/html'
  format?: string
}

export default function copyToClipboard(
  text: string,
  options: CopyOptions = {},
) {
  const format = options.format ?? 'text/plain'
  // navigator.clipboard is only present in secure contexts; isSecureContext is
  // the real gate, so insecure http:// falls through to execCommand below
  const useAsync = format === 'text/plain' && window.isSecureContext
  if (useAsync) {
    void navigator.clipboard.writeText(text)
  }
  return useAsync ? true : execCommandCopy(text, format)
}

function execCommandCopy(text: string, format: string) {
  const selection = document.getSelection()
  const previousRange =
    selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : undefined

  // offscreen span carrying the text, with whitespace preserved
  const span = document.createElement('span')
  span.textContent = text
  span.style.whiteSpace = 'pre'
  span.style.position = 'fixed'
  span.style.top = '0'
  span.style.left = '0'
  span.style.opacity = '0'
  document.body.append(span)

  const listener = (e: ClipboardEvent) => {
    if (e.clipboardData) {
      e.clipboardData.clearData()
      e.clipboardData.setData(format, text)
    }
    e.preventDefault()
  }
  document.addEventListener('copy', listener)

  let success = false
  try {
    const range = document.createRange()
    range.selectNodeContents(span)
    selection?.removeAllRanges()
    selection?.addRange(range)
    // execCommand is deprecated but is the only clipboard write available in
    // non-secure (http://) contexts, which JBrowse must support
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    success = document.execCommand('copy')
  } catch (e) {
    console.error(e)
  } finally {
    document.removeEventListener('copy', listener)
    selection?.removeAllRanges()
    if (previousRange) {
      selection?.addRange(previousRange)
    }
    span.remove()
  }
  return success
}
