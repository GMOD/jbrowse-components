import { escapeAttr } from '../inline-html.ts'

import type { AgentRecipe } from './agent.ts'
import type { Recipe, RecipeStep } from './recipe.ts'

// First Desktop release carrying the jbrowse:// handler + "Open JBrowse Web
// link...". The docs deploy independently of a Desktop release, so this text
// has to stay true before one ships — update it if the target release moves.
export const DESKTOP_LINK_MIN_VERSION = 'JBrowse Desktop 5.0'

// Docs markdown is rendered to an HTML string (src/lib/markdown.ts), not to
// Astro components, so this emits a plain <dialog> a small script in
// DocsLayout opens. Tabs are radio inputs switched with CSS — no hydration.

// `**bold**` marks the literal UI label to click, `` `code` `` a value to type.
function renderInline(text: string): string {
  return escapeAttr(text)
    .replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replaceAll(/`([^`]+)`/g, '<code>$1</code>')
}

// A code block with a Copy button. The button copies the block's own
// `<code>` text — decoded straight from the figure's link, so what a reader
// copies is exactly what produced the image above and cannot drift from it.
// The copy handler is delegated in DocsLayout (the dialog is not hydrated).
function copyableBlock(text: string, className: string, wrap = ''): string {
  return [
    `<div class="code-copywrap${wrap ? ` ${wrap}` : ''}">`,
    '<button type="button" class="code-copy">Copy</button>',
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
    `<span class="spec-step-title">${renderInline(step.title)}</span>`,
    step.note
      ? `<span class="spec-step-note">${renderInline(step.note)}</span>`
      : '',
    step.example
      ? `<span class="spec-step-example">${renderInline(step.example)}</span>`
      : '',
    step.substeps
      ? `<ol class="spec-substeps">${step.substeps.map(renderStep).join('')}</ol>`
      : '',
    '</li>',
  ].join('')
}

function ownDataSteps(steps: RecipeStep[], unmapped: string[]): string {
  return [
    note(
      '<strong>From scratch with your own data</strong>, the steps behind the figure:',
    ),
    `<ol class="spec-steps">${steps.map(renderStep).join('')}</ol>`,
    unmapped.length
      ? note(
          'Some settings have no written step yet — see the <strong>Spec</strong> tab.',
        )
      : '',
  ].join('')
}

// The Desktop link is a jbrowse:// url, which does nothing without a Desktop
// that registers the protocol.
function desktopFallback(recipe: Recipe): string {
  return [
    '<details class="spec-fallback"><summary>Desktop link does nothing?</summary>',
    note(
      `It needs <strong>${DESKTOP_LINK_MIN_VERSION}+</strong>. Or paste this link into Desktop's <strong>Open JBrowse Web link...</strong> (start screen, or <strong>File → Session</strong>):`,
    ),
    copyableBlock(recipe.desktopWebUrl, 'spec-json', 'spec-url'),
    '</details>',
  ].join('')
}

interface Panel {
  label: string
  // what the tab is, for a page script that carries a reader's pick across
  // every tab widget on the page
  kind: string
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
function panels(recipe: Recipe, inlineOpens = false): Panel[] {
  return [
    {
      label: 'Steps',
      kind: 'desktop',
      body: [
        inlineOpens
          ? `<p class="spec-open"><a href="${escapeAttr(recipe.liveUrl)}" target="_blank" rel="noopener">Open this view in JBrowse Web ↗</a> · <a href="${escapeAttr(recipe.desktopUrl)}">Open this view in JBrowse Desktop ↗</a></p>${desktopFallback(recipe)}`
          : '',
        note(
          'The short route: open the view in JBrowse Web, where <strong>File → Open track...</strong> adds your own files beside its hosted genome and tracks.',
        ),
        ownDataSteps(recipe.steps, recipe.unmapped),
      ].join(''),
    },
    ...(recipe.cli
      ? [
          {
            label: 'CLI',
            kind: 'cli',
            body: [
              note(
                'A figure adds its tracks to one session. The <a href="/docs/cli/">jbrowse CLI</a> writes the same tracks into a <code>config.json</code> instead, where every session that opens it has them: <a href="/docs/cli/#jbrowse-add-track"><code>add-track</code></a> where flags cover the whole track, <a href="/docs/cli/#jbrowse-add-track-json"><code>add-track-json</code></a> where they do not.',
              ),
              copyableBlock(recipe.cli.commands, 'spec-json'),
              note(
                `Run these where the <code>config.json</code> is, or add <code>--out &lt;dir&gt;</code>, and point each <code>uri</code> at your own file.${assembliesNote(recipe.cli.assemblies)} The location and the settings the steps carry are session state rather than track config — that half is the <strong>Spec</strong> tab, or <a href="/docs/cli/#jbrowse-set-default-session"><code>jbrowse set-default-session</code></a>.`,
              ),
            ].join(''),
          },
        ]
      : []),
    {
      label: 'Spec',
      kind: 'spec',
      body: [
        note(
          `This <a href="/docs/urlparams/#session-spec">session spec</a> draws the figure. It goes after <code>&amp;session=spec-</code> on a JBrowse Web link that loads <a href="${escapeAttr(recipe.configUrl)}">${escapeAttr(recipe.configUrl)}</a>, which is what the Web button above opens.`,
        ),
        copyableBlock(recipe.specJson, 'spec-json'),
      ].join(''),
    },
    ...(recipe.python
      ? [
          {
            label: 'Notebook',
            kind: 'notebook',
            body: [
              note(
                'The same view with <a href="/docs/jbrowse_anywidget/">jbrowse-anywidget</a>, from the config the figure loads. Swap a track\'s <code>uri</code> for your own file.',
              ),
              copyableBlock(recipe.python, 'spec-python'),
            ].join(''),
          },
        ]
      : []),
    ...(recipe.img
      ? [
          {
            label: 'Image',
            kind: 'img',
            body: [
              note(
                '<a href="/docs/jbrowse-img/">jbrowse-img</a> draws the same view as an SVG, from the command line and without a browser. Point <code>--config</code> at your own config, or swap a track for your own file with <code>--bam</code>, <code>--vcfgz</code> and the other <a href="/docs/jbrowse-img/#track-params">file flags</a>.',
              ),
              copyableBlock(recipe.img.command, 'spec-json'),
              recipe.img.dropped.length
                ? note(
                    `It has no flag for this figure's ${recipe.img.dropped.map(f => `<code>${escapeAttr(f)}</code>`).join(', ')}, so its picture can differ there.`,
                  )
                : '',
              note(
                '<code>--out figure.png</code> writes a PNG instead, through <code>rsvg-convert</code> (<code>apt install librsvg2-bin</code>, <code>brew install librsvg</code>).',
              ),
            ].join(''),
          },
        ]
      : []),
    agentPanel(recipe.agent),
  ]
}

// One block per frame, each with what its command leaves out of the figure,
// then the line that stacks a composed figure's frames.
function agentPanel({ frames, stack, notes }: AgentRecipe): Panel {
  return {
    label: 'Agent',
    kind: 'agent',
    body: [
      note(
        'Hand this to a coding agent. It rebuilds the figure above headlessly, and the session file is then the thing to edit: change the location or a track\'s settings, or add your own track under <code>sessionTracks</code>, and rerun.',
      ),
      ...(frames.length > 1
        ? [
            note(
              `The figure stacks ${frames.length} frames: one command draws each, and ImageMagick stacks them.`,
            ),
          ]
        : []),
      ...frames.flatMap(frame => [
        ...(frame.label
          ? [note(`<strong>${escapeAttr(frame.label)}</strong>`)]
          : []),
        copyableBlock(frame.command, 'spec-json'),
        ...frame.notes.map(text => note(renderInline(text))),
      ]),
      ...(stack ? [copyableBlock(stack, 'spec-json')] : []),
      ...notes.map(text => note(renderInline(text))),
      note(
        '<a href="/docs/agents/">Using JBrowse with AI agents</a> covers the rest: <a href="/docs/agents_hosted_data/">hosted genomes</a> to point it at, and <a href="/docs/agents_capture/">why waiting for the render</a> is the part that goes wrong.',
      ),
    ].join(''),
  }
}

function tabsHtml(id: string, list: Panel[]): string {
  const name = `${id}-tabs`
  return [
    '<div class="spec-tabs">',
    ...list.map((panel, i) =>
      [
        `<input type="radio" name="${name}" id="${id}-t${i}" class="spec-tab-input" data-tab-kind="${panel.kind}"${i === 0 ? ' checked' : ''}/>`,
        `<label for="${id}-t${i}" class="spec-tab-label">${escapeAttr(panel.label)}</label>`,
        `<div class="spec-panel">${panel.body}</div>`,
      ].join(''),
    ),
    '</div>',
  ].join('')
}

function dialogHtml(id: string, body: string): string {
  return [
    `<dialog class="spec-dialog" id="${id}">`,
    '<form method="dialog" class="spec-dialog-close-form">',
    '<button class="spec-dialog-close" aria-label="Close">✕</button>',
    '</form>',
    body,
    '</dialog>',
  ].join('')
}

// Opening the finished view comes first, since most readers want only that;
// the tabs below are the ways to rebuild it from their own data.
function opensHtml(recipe: Recipe, slow: boolean): string {
  return [
    '<div class="spec-opens">',
    `<a class="spec-open-btn spec-open-primary" href="${escapeAttr(recipe.liveUrl)}" target="_blank" rel="noopener">Open in JBrowse Web ↗</a>`,
    `<a class="spec-open-btn" href="${escapeAttr(recipe.desktopUrl)}">Open in JBrowse Desktop ↗</a>`,
    '</div>',
    desktopFallback(recipe),
    slow
      ? '<p class="spec-rebuild-lead">This session loads a large dataset and takes a while to open.</p>'
      : '',
    '<p class="spec-rebuild-lead">Or rebuild it from your own data:</p>',
  ].join('')
}

export function recipeDialogHtml(
  recipe: Recipe,
  id: string,
  slow = false,
): string {
  return dialogHtml(id, opensHtml(recipe, slow) + tabsHtml(id, panels(recipe)))
}

export interface RecipeFrame {
  label: string
  recipe: Recipe
  slow: boolean
}

// A figure with several views behind it: one dialog, its view picked by a row
// of chips above the Open buttons, starting on the view the figure shows.
export function framesDialogHtml(
  frames: RecipeFrame[],
  id: string,
  shown: number,
): string {
  return dialogHtml(
    id,
    [
      '<div class="spec-frames" role="radiogroup" aria-label="Which view">',
      ...frames.map(({ label, recipe, slow }, i) =>
        [
          `<input type="radio" name="${id}-frame" id="${id}-f${i}" class="spec-frame-input"${i === shown ? ' checked' : ''}/>`,
          `<label for="${id}-f${i}" class="spec-frame-label">${escapeAttr(label)}</label>`,
          `<div class="spec-frame">${opensHtml(recipe, slow)}${tabsHtml(`${id}-f${i}`, panels(recipe))}</div>`,
        ].join(''),
      ),
      '</div>',
    ].join(''),
  )
}

// A composed figure none of whose frames is linked on its own: the commands,
// and nothing that would need one session to describe
export function agentDialogHtml(agent: AgentRecipe, id: string): string {
  return dialogHtml(id, tabsHtml(id, [agentPanel(agent)]))
}

// The video's own panel first: what the clip does, as the words it held on
// screen, and the config it pasted. The session panels that follow are the
// figure recipe's, built from the session the clip starts in.
export function videoRecipeDialogHtml(
  recipe: Recipe,
  id: string,
  video: { steps: string[]; paste?: string },
): string {
  const walkthrough: Panel = {
    label: 'Video',
    kind: 'video',
    body: [
      note(
        `<a href="${escapeAttr(recipe.liveUrl)}" target="_blank" rel="noopener noreferrer">Open the session the video starts in ↗</a>, then take the steps it shows:`,
      ),
      `<ol class="spec-steps">${video.steps
        .map(
          step =>
            `<li><span class="spec-step-title">${escapeAttr(step)}</span></li>`,
        )
        .join('')}</ol>`,
      ...(video.paste
        ? [
            note(
              'The track the video adds through the form, as the page above prints it:',
            ),
            copyableBlock(video.paste, 'spec-json'),
          ]
        : []),
    ].join(''),
  }
  return dialogHtml(id, tabsHtml(id, [walkthrough, ...panels(recipe, true)]))
}

// a "steps/recipe" glyph (lucide clipboard-list). The label beside it carries
// the meaning — an icon alone read as decoration and went unclicked — so the
// pair stays muted and the tooltip says the longer form
const RECIPE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>'

export function recipeButtonHtml(
  id: string,
  label = 'Open or rebuild this view',
  title = 'Open this view in JBrowse, or rebuild it from your own data',
): string {
  // no aria-label: the visible text is the accessible name, and an aria-label
  // that differs from it is what voice control tries and fails to match
  return `<button type="button" class="spec-help" data-spec-dialog="${id}" title="${escapeAttr(title)}">${RECIPE_ICON}<span>${escapeAttr(label)}</span></button>`
}
