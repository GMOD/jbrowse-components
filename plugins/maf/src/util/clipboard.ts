/**
 * Hand the browser a text file to save, through core's `saveAs`. This used to
 * hand-roll the anchor and call `URL.revokeObjectURL` on the line after
 * `a.click()`, which can cancel the download the click just started; `saveAs`
 * defers the click a tick and the revoke by 40s for that reason. Dynamically
 * imported, as core's other callers do.
 */
export async function downloadAsFile(
  content: string,
  filename: string,
  onSuccess?: () => void,
  onError?: (e: unknown) => void,
) {
  try {
    const { saveAs } = await import('@jbrowse/core/util/FileSaver')
    saveAs(new Blob([content], { type: 'text/plain' }), filename)
    onSuccess?.()
  } catch (e) {
    console.error(e)
    onError?.(e)
  }
}
