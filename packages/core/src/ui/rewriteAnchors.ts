// Shared by the setHTML and dompurify sanitizer paths. A clickable anchor opens
// in a new tab without leaking the opener; where nothing can be clicked (a
// hover tooltip) it is unwrapped to its text, so it does not pose as a link.
export function rewriteAnchors(el: HTMLElement, unlink: boolean) {
  for (const a of el.querySelectorAll('a')) {
    if (unlink) {
      a.replaceWith(...a.childNodes)
    } else {
      a.setAttribute('rel', 'noopener noreferrer')
      a.setAttribute('target', '_blank')
    }
  }
}
