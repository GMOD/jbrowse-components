/**
 * Modern implementation of saveAs.
 * Based on the concepts from FileSaver.js but simplified for modern environments.
 *
 * By Eli Grey, http://eligrey.com
 * License: https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md (MIT)
 */

interface SaveAsOptions {
  /**
   * Automatically provide Unicode text encoding hints.
   * @default false
   */
  autoBom?: boolean
}

/**
 * Saves a file to the user's computer.
 *
 * @param blob - The data to save. Can be a Blob or a URL string.
 * @param name - The desired filename.
 * @param opts - Options for saving.
 */
export function saveAs(
  blob: Blob | string,
  name?: string,
  opts: SaveAsOptions = { autoBom: false },
) {
  if (typeof window === 'undefined') {
    return
  }

  const filename =
    name || (blob instanceof Blob ? (blob as any).name : '') || 'download'
  const a = document.createElement('a')
  a.download = filename
  a.rel = 'noopener'

  if (typeof blob === 'string') {
    a.href = blob
    if (
      new URL(a.href, window.location.href).origin !== window.location.origin
    ) {
      // If it's a cross-origin URL, we can't force a download name using the
      // download attribute in most browsers. Opening in a new tab is the
      // standard fallback.
      a.target = '_blank'
    }
    a.click()
  } else {
    let finalBlob = blob
    if (
      opts.autoBom &&
      /^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(
        blob.type,
      )
    ) {
      finalBlob = new Blob([String.fromCharCode(0xfeff), blob], {
        type: blob.type,
      })
    }

    const url = URL.createObjectURL(finalBlob)
    a.href = url

    // Use a timeout to ensure the click happens before revocation
    setTimeout(() => {
      a.click()
    }, 0)

    // Revoke after a longer delay to ensure the browser has started the download
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 40000)
  }
}

export default saveAs
