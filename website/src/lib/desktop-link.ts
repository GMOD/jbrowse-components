import { escapeAttr } from './inline-html.ts'

// First Desktop release carrying the jbrowse:// handler + "Open JBrowse Web
// link...". The docs deploy independently of a Desktop release, so this text
// has to stay true before one ships — update it if the target release moves.
const DESKTOP_LINK_MIN_VERSION = 'JBrowse Desktop 5.0'

// FNV-1a, so a page's popover ids are the same on every build
function hashId(text: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * An "open in JBrowse Desktop" control that opens a popover rather than
 * following the jbrowse:// link outright. The link does nothing where no
 * Desktop 5 registered the protocol, a Linux AppImage included, and the page
 * cannot tell, so the popover holds both routes: the link, and the web url to
 * paste into Desktop's "Open JBrowse Web link...", which unwraps either form.
 *
 * Block-level: the popover is a `<div>`, so a caller puts this in a `<div>`,
 * never a `<p>`. `id` must be unique on the page; without one it comes from the
 * link, so two controls for one link open the same, identical, popover.
 */
export function desktopLinkHtml({
  webUrl,
  desktopUrl,
  label,
  className = 'desktop-link-trigger',
  id = `desktop-link-${hashId(desktopUrl)}`,
}: {
  webUrl: string
  desktopUrl: string
  label: string
  className?: string
  id?: string
}): string {
  return [
    `<button type="button" class="${className}" popovertarget="${id}">${escapeAttr(label)}</button>`,
    `<div class="desktop-link-pop" id="${id}" popover>`,
    `<a class="desktop-link-open" href="${escapeAttr(desktopUrl)}">Open in JBrowse Desktop ↗</a>`,
    `<p>Needs ${DESKTOP_LINK_MIN_VERSION} or newer. If nothing opens, copy the link and paste it into Desktop's <strong>Open JBrowse Web link...</strong>, on the start screen or under <strong>File → Session</strong>.</p>`,
    '<div class="code-copywrap desktop-link-copy">',
    '<button type="button" class="code-copy">Copy</button>',
    `<pre><code>${escapeAttr(webUrl)}</code></pre>`,
    '</div>',
    '</div>',
  ].join('')
}
