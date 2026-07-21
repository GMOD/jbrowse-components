import type { Recipe, RecipeStep } from './recipe.ts'

// First Desktop release carrying the jbrowse:// handler + "Open JBrowse Web
// link...". The docs deploy independently of a Desktop release, so this text
// has to stay true before one ships — update it if the target release moves.
const DESKTOP_LINK_MIN_VERSION = 'JBrowse Desktop 5.0'

// Docs markdown is rendered to an HTML string (src/lib/markdown.ts), not to
// Astro components, so this emits a plain <dialog> a small script in
// DocsLayout opens. Tabs are radio inputs switched with CSS — no hydration.

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

// `**bold**` in a step title marks the literal UI label to click.
function renderTitle(title: string): string {
  return escapeHtml(title).replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

// A code block with a Copy button. The button copies the block's own
// `<code>` text — decoded straight from the figure's link, so what a reader
// copies is exactly what produced the image above and cannot drift from it.
// The copy handler is delegated in DocsLayout (the dialog is not hydrated).
function copyableBlock(text: string, className: string): string {
  return [
    '<div class="spec-copywrap">',
    '<button type="button" class="spec-copy">Copy</button>',
    `<pre class="${className}"><code>${escapeHtml(text)}</code></pre>`,
    '</div>',
  ].join('')
}

function renderStep(step: RecipeStep): string {
  return [
    '<li>',
    `<span class="spec-step-title">${renderTitle(step.title)}</span>`,
    step.note
      ? `<span class="spec-step-note">${escapeHtml(step.note)}</span>`
      : '',
    step.example
      ? `<span class="spec-step-example">${escapeHtml(step.example)}</span>`
      : '',
    '</li>',
  ].join('')
}

interface Panel {
  label: string
  body: string
}

// One panel per way of reproducing the figure. Built as a list so a panel that
// doesn't apply (a notebook snippet for a synteny view) simply isn't in it —
// tab and panel positions stay in step with each other automatically, which
// index-per-panel markup could not guarantee.
function panels(recipe: Recipe): Panel[] {
  return [
    {
      label: 'Do it yourself',
      body: [
        '<p class="spec-intro">Steps that made the figure above, for your own data. The figure\'s values are the worked example.</p>',
        `<ol class="spec-steps">${recipe.steps.map(renderStep).join('')}</ol>`,
        recipe.unmapped.length
          ? '<p class="spec-config">A few of this figure\'s settings have no written step yet. The <strong>Session spec</strong> tab lists them all.</p>'
          : '',
      ].join(''),
    },
    {
      label: 'In Desktop',
      body: [
        `<p class="spec-desktop-open"><a href="${escapeHtml(recipe.desktopUrl)}">Open this view in JBrowse Desktop ↗</a></p>`,
        `<p class="spec-intro">Opens an installed JBrowse Desktop at this view (<strong>${DESKTOP_LINK_MIN_VERSION}+</strong>). Your browser asks permission the first time.</p>`,
        '<p class="spec-intro">If nothing happens (not installed, blocked, or an un-integrated Linux AppImage), copy the link below into Desktop\'s <strong>Open JBrowse Web link...</strong>, on the start screen or under <strong>File → Session</strong> once open.</p>',
        copyableBlock(recipe.desktopWebUrl, 'spec-json'),
        '<p class="spec-config">Desktop downloads this config and saves it as a session you can reopen. Swap in your own files afterwards.</p>',
      ].join(''),
    },
    {
      label: 'Session spec',
      body: [
        '<p class="spec-intro">The link above encodes this <a href="/docs/urlparams/#session-spec">session spec</a>. Paste it after <code>&amp;session=spec-</code> on any JBrowse Web instance, or adapt it with your own <code>trackId</code>s.</p>',
        copyableBlock(recipe.specJson, 'spec-json'),
        `<p class="spec-config">Loaded against config: <code>${escapeHtml(recipe.config)}</code></p>`,
      ].join(''),
    },
    ...(recipe.python
      ? [
          {
            label: 'In a notebook',
            body: [
              '<p class="spec-intro">The same view in a notebook with <a href="/docs/jbrowse_jupyter/">jbrowse-anywidget</a>. Point the adapter at your own file.</p>',
              copyableBlock(recipe.python, 'spec-python'),
            ].join(''),
          },
        ]
      : []),
  ]
}

export function recipeDialogHtml(recipe: Recipe, id: string): string {
  const name = `${id}-tabs`
  const list = panels(recipe)
  return [
    `<dialog class="spec-dialog" id="${id}">`,
    '<form method="dialog" class="spec-dialog-close-form">',
    '<button class="spec-dialog-close" aria-label="Close">✕</button>',
    '</form>',
    '<div class="spec-tabs">',
    // every input precedes every panel, so each panel is a following sibling of
    // its own tab (the CSS pairs them by ordinal)
    ...list.map((panel, i) =>
      [
        `<input type="radio" name="${name}" id="${id}-t${i}" class="spec-tab-input"${i === 0 ? ' checked' : ''}/>`,
        `<label for="${id}-t${i}" class="spec-tab-label">${escapeHtml(panel.label)}</label>`,
      ].join(''),
    ),
    ...list.map(
      (panel, i) =>
        `<div class="spec-panel spec-panel-${i + 1}">${panel.body}</div>`,
    ),
    '</div>',
    '</dialog>',
  ].join('')
}

// a subtle "steps/recipe" glyph (lucide clipboard-list) — every figure carries
// one, so it stays muted and out of the way; the tooltip tells the curious
// reader what it opens
const RECIPE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>'

export function recipeButtonHtml(id: string): string {
  return `<button type="button" class="spec-help" data-spec-dialog="${id}" aria-label="How to make this view yourself" title="How to make this view yourself">${RECIPE_ICON}</button>`
}
