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
        '<p class="spec-intro">These are the steps that made the figure above, written for your own data — the figure\'s values are shown as the worked example.</p>',
        `<ol class="spec-steps">${recipe.steps.map(renderStep).join('')}</ol>`,
      ].join(''),
    },
    {
      label: 'In Desktop',
      body: [
        `<p class="spec-desktop-open"><a href="${escapeHtml(recipe.desktopUrl)}">Open this view in JBrowse Desktop ↗</a></p>`,
        `<p class="spec-intro">Opens an installed JBrowse Desktop straight at this view (your browser will ask permission the first time), in <strong>${DESKTOP_LINK_MIN_VERSION} and newer</strong>. If nothing happens — Desktop isn't installed, the link is blocked, or you run the Linux AppImage, which doesn't register links unless you've integrated it with your desktop — copy the link below and paste it into Desktop's <strong>Open .jbrowse or config.json or link → Open JBrowse Web link...</strong>, on the start screen beside the recent sessions (or <strong>File → Session → Open JBrowse Web link...</strong> once a session is open). Either always works.</p>`,
        copyableBlock(recipe.desktopWebUrl, 'spec-json'),
        '<p class="spec-config">Desktop downloads this config and saves the result as a session on your machine, so you can reopen it later — swap in your own files afterwards, or follow the steps in the first tab to build it from scratch.</p>',
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

export function recipeButtonHtml(id: string): string {
  return `<button type="button" class="spec-help" data-spec-dialog="${id}" aria-label="How to make this view yourself" title="How to make this view yourself">?</button>`
}
