import { escapeAttr } from '../inline-html.ts'

import type { Recipe, RecipeStep } from './recipe.ts'

// First Desktop release carrying the jbrowse:// handler + "Open JBrowse Web
// link...". The docs deploy independently of a Desktop release, so this text
// has to stay true before one ships — update it if the target release moves.
const DESKTOP_LINK_MIN_VERSION = 'JBrowse Desktop 5.0'

// Docs markdown is rendered to an HTML string (src/lib/markdown.ts), not to
// Astro components, so this emits a plain <dialog> a small script in
// DocsLayout opens. Tabs are radio inputs switched with CSS — no hydration.

// `**bold**` in a step title marks the literal UI label to click.
function renderTitle(title: string): string {
  return escapeAttr(title).replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

// A code block with a Copy button. The button copies the block's own
// `<code>` text — decoded straight from the figure's link, so what a reader
// copies is exactly what produced the image above and cannot drift from it.
// The copy handler is delegated in DocsLayout (the dialog is not hydrated).
function copyableBlock(text: string, className: string): string {
  return [
    '<div class="spec-copywrap">',
    '<button type="button" class="spec-copy">Copy</button>',
    `<pre class="${className}"><code>${escapeAttr(text)}</code></pre>`,
    '</div>',
  ].join('')
}

// The dialog's connective prose between the steps and code blocks; a helper
// keeps the panels readable and the wording easy to edit in one place.
function note(html: string): string {
  return `<p class="spec-note">${html}</p>`
}

function renderStep(step: RecipeStep): string {
  return [
    '<li>',
    `<span class="spec-step-title">${renderTitle(step.title)}</span>`,
    step.note
      ? `<span class="spec-step-note">${escapeAttr(step.note)}</span>`
      : '',
    step.example
      ? `<span class="spec-step-example">${escapeAttr(step.example)}</span>`
      : '',
    '</li>',
  ].join('')
}

interface Panel {
  label: string
  body: string
}

// add-track only WARNS about an assembly its target config has no entry for, so
// the track lands and the instance opens it against nothing. Naming the
// assemblies here is the difference between that and a config that works.
function assembliesNote(assemblies: string[]): string {
  return assemblies.length
    ? ` The config needs ${assemblies.map(name => `<code>${escapeAttr(name)}</code>`).join(', ')} already — <a href="/docs/cli/#jbrowse-add-assembly"><code>jbrowse add-assembly</code></a> adds yours.`
    : ''
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
        note('The steps behind the figure above, run against your own data.'),
        `<ol class="spec-steps">${recipe.steps.map(renderStep).join('')}</ol>`,
        recipe.unmapped.length
          ? note('Some settings have no written step yet — see the <strong>Session spec</strong> tab.')
          : '',
      ].join(''),
    },
    {
      label: 'In Desktop',
      body: [
        `<p class="spec-desktop-open"><a href="${escapeAttr(recipe.desktopUrl)}">Open this view in JBrowse Desktop ↗</a></p>`,
        note(`Opens JBrowse Desktop (<strong>${DESKTOP_LINK_MIN_VERSION}+</strong>) at this view and saves it as a reopenable session — swap in your own files afterwards.`),
        note('Nothing happens? Paste this link into Desktop\'s <strong>Open JBrowse Web link...</strong> (start screen, or <strong>File → Session</strong>):'),
        copyableBlock(recipe.desktopWebUrl, 'spec-json'),
      ].join(''),
    },
    ...(recipe.cli
      ? [
          {
            label: 'With the CLI',
            body: [
              note('A figure adds its tracks to one session. The <a href="/docs/cli/">jbrowse CLI</a> writes the same tracks into a <code>config.json</code> instead, where every session that opens it has them: <a href="/docs/cli/#jbrowse-add-track"><code>add-track</code></a> where flags cover the whole track, <a href="/docs/cli/#jbrowse-add-track-json"><code>add-track-json</code></a> where they do not.'),
              copyableBlock(recipe.cli.commands, 'spec-json'),
              note(`Run these where the <code>config.json</code> is, or add <code>--out &lt;dir&gt;</code>, and point each <code>uri</code> at your own file.${assembliesNote(recipe.cli.assemblies)} The location and the settings the steps carry are session state rather than track config — that half is the <strong>Session spec</strong> tab, or <a href="/docs/cli/#jbrowse-set-default-session"><code>jbrowse set-default-session</code></a>.`),
            ].join(''),
          },
        ]
      : []),
    {
      label: 'Session spec',
      body: [
        note('This <a href="/docs/urlparams/#session-spec">session spec</a> pastes after <code>&amp;session=spec-</code> on any JBrowse Web instance.'),
        copyableBlock(recipe.specJson, 'spec-json'),
        note(`Loaded against config: <code>${escapeAttr(recipe.config)}</code>`),
      ].join(''),
    },
    ...(recipe.python
      ? [
          {
            label: 'In a notebook',
            body: [
              note('The same view with <a href="/docs/jbrowse_anywidget/">jbrowse-anywidget</a>. Point the adapter at your own file.'),
              copyableBlock(recipe.python, 'spec-python'),
            ].join(''),
          },
        ]
      : []),
    {
      label: 'With an agent',
      body: [
        note('Hand this to a coding agent. It rebuilds the figure above headlessly, and the session file is then the thing to edit — swap an adapter <code>uri</code> for your own file and rerun.'),
        copyableBlock(recipe.agentCommand, 'spec-json'),
        note('<a href="/docs/agents/">Using JBrowse with AI agents</a> covers the rest: <a href="/docs/agents_hosted_data/">hosted genomes</a> to point it at, and <a href="/docs/agents_capture/">why waiting for the render</a> is the part that goes wrong.'),
      ].join(''),
    },
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
        `<label for="${id}-t${i}" class="spec-tab-label">${escapeAttr(panel.label)}</label>`,
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

// a "steps/recipe" glyph (lucide clipboard-list). The label beside it carries
// the meaning — an icon alone read as decoration and went unclicked — so the
// pair stays muted and the tooltip says the longer form
const RECIPE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>'

export function recipeButtonHtml(id: string): string {
  // no aria-label: the visible text is the accessible name, and an aria-label
  // that differs from it is what voice control tries and fails to match
  return `<button type="button" class="spec-help" data-spec-dialog="${id}" title="How to make this view yourself">${RECIPE_ICON}<span>Make this view yourself</span></button>`
}
