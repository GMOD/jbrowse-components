// Minimal `saveAs`. The name/API derive from FileSaver.js by Eli Grey
// (https://github.com/eligrey/FileSaver.js, MIT), but this is reimplemented as
// the modern anchor-download path only, dropping the legacy browser fallbacks.
export function saveAs(blob: Blob | string, name?: string) {
  const filename = name || (blob instanceof File ? blob.name : '') || 'download'
  const a = document.createElement('a')
  a.download = filename
  a.rel = 'noopener'

  if (typeof blob === 'string') {
    a.href = blob
    if (
      new URL(a.href, window.location.href).origin !== window.location.origin
    ) {
      // Fallback for cross-origin URLs
      a.target = '_blank'
    }
    a.click()
  } else {
    const url = URL.createObjectURL(blob)
    a.href = url

    setTimeout(() => {
      a.click()
    }, 0)

    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 40000)
  }
}
