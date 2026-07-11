// Harden anchors in sanitized HTML: open in a new tab without leaking the
// opener reference. Shared by the setHTML and dompurify sanitizer paths.
export function rewriteExternalAnchors(el: HTMLElement) {
  for (const a of el.querySelectorAll('a')) {
    a.setAttribute('rel', 'noopener noreferrer')
    a.setAttribute('target', '_blank')
  }
}
