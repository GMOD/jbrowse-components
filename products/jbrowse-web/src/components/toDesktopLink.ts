export function toDesktopLink(shareUrl: string) {
  return `jbrowse://open?url=${encodeURIComponent(shareUrl)}`
}
