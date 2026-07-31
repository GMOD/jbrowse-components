// Copies text to the clipboard. Replaces the `copy-to-clipboard` dependency.
//
// This is the bare write. A menu item should call `copyText` (./copyText.ts)
// instead, which confirms the copy in a snackbar and reports a failure.
//
// The async Clipboard API is preferred for plain text, but it only works in
// secure contexts (https:// or localhost). JBrowse is frequently served over
// plain http:// on intranet/institutional servers, so we fall back to the
// execCommand('copy') path there. The execCommand path also handles rich
// `text/html` copying via the copy event's clipboardData, which writeText
// cannot do.
export interface CopyOptions {
  // MIME type to write, e.g. 'text/plain' (default) or 'text/html'
  format?: string
}

// Throws when the write did not happen, which is the only signal the async API
// gives (it reports a denied permission or an unfocused document by rejecting).
// A caller that reports success must therefore await this, or it confirms a copy
// that never landed.
export default async function copyToClipboard(
  text: string,
  options: CopyOptions = {},
) {
  const format = options.format ?? 'text/plain'
  // navigator.clipboard is only present in secure contexts; isSecureContext is
  // the real gate, so insecure http:// falls through to execCommand below
  if (format === 'text/plain' && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
  } else if (!execCommandCopy(text, format)) {
    throw new Error('the browser rejected the clipboard write')
  }
}

function execCommandCopy(text: string, format: string) {
  const selection = document.getSelection()
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined

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
