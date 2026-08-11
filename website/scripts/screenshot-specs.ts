export type {
  Annotation,
  AnnotationAnchor,
  BaseSpecFields,
  BrowserScreenshotSpec,
  CliSpec,
  CommonSpecFields,
  ComposeSpec,
  EmbeddedSpec,
  ScreenshotAction,
  ScreenshotSpec,
  ScreenshotStage,
  SessionUrlSpec,
} from './screenshot-spec-types.ts'

import { CODE_BASE } from '../src/lib/code-base.ts'
// jbrowse-img CLI example figures (products/jbrowse-img/README.md)
import { jbrowseImgSpecs } from './screenshot-spec-helpers.ts'
import { alignmentsSpecs } from './specs/alignments.ts'
import { bigwigSpecs } from './specs/bigwig.ts'
import { cancerSvSpecs } from './specs/cancer_sv.ts'
import { cnv1000gSpecs } from './specs/cnv1000g.ts'
import { conservationSpecs } from './specs/conservation.ts'
import { cookbookSpecs } from './specs/cookbook.ts'
import { dog10kSpecs } from './specs/dog10k.ts'
import { dtuSpecs } from './specs/dtu.ts'
import { embeddedSpecs } from './specs/embedded.ts'
import { featuresSpecs } from './specs/features.ts'
import { gallerySpecs } from './specs/gallery.ts'
import { graphSpecs } from './specs/graph.ts'
import { gwasSpecs } from './specs/gwas.ts'
import { hg002HaplotypeSpecs } from './specs/hg002_haplotypes.ts'
import { hicSpecs } from './specs/hic.ts'
import { ldSpecs } from './specs/ld.ts'
import { mafSpecs } from './specs/maf.ts'
import { methylationSpecs } from './specs/methylation.ts'
import { msaSpecs } from './specs/msa.ts'
import { pangenomeSpecs } from './specs/pangenome.ts'
import { pangenomeCactusSpecs } from './specs/pangenome_cactus.ts'
import { popgenSpecs } from './specs/popgen.ts'
import { qcSpecs } from './specs/qc.ts'
import { qtlSpecs } from './specs/qtl.ts'
import { scatacSpecs } from './specs/scatac.ts'
import { scrnaSpecs } from './specs/scrna.ts'
import { svSpecs } from './specs/sv.ts'
import { syntenySpecs } from './specs/synteny.ts'
import { tcgaSpecs } from './specs/tcga.ts'
import { trioSpecs } from './specs/trio.ts'
import { uiSpecs } from './specs/ui.ts'
import { variantsSpecs } from './specs/variants.ts'

import type {
  Annotation,
  ScreenshotAction,
  ScreenshotSpec,
} from './screenshot-spec-types.ts'

export const specs: ScreenshotSpec[] = [
  ...syntenySpecs,
  ...alignmentsSpecs,
  ...variantsSpecs,
  ...dtuSpecs,
  ...bigwigSpecs,
  ...conservationSpecs,
  ...featuresSpecs,
  ...uiSpecs,
  ...methylationSpecs,
  ...ldSpecs,
  ...popgenSpecs,
  ...qcSpecs,
  ...scatacSpecs,
  ...scrnaSpecs,
  ...svSpecs,
  ...cancerSvSpecs,
  ...tcgaSpecs,
  ...cnv1000gSpecs,
  ...gwasSpecs,
  ...hg002HaplotypeSpecs,
  ...hicSpecs,
  ...qtlSpecs,
  ...trioSpecs,
  ...dog10kSpecs,
  ...gallerySpecs,
  ...mafSpecs,
  ...msaSpecs,
  ...pangenomeSpecs,
  ...pangenomeCactusSpecs,
  ...graphSpecs,
  ...cookbookSpecs,
  ...embeddedSpecs,
  ...jbrowseImgSpecs,
  // The one composed jbrowse-img figure. It lives here rather than in
  // `jbrowseImgSpecs`, which is typed `CliSpec[]` because `sync-img-readme.ts`
  // walks it to regenerate every command fence in the jb2export README -- and
  // this is not a command. Its two halves are: the compose is the figure
  // pipeline putting one render beside another, which is what the review asked
  // for ("not something jbrowse-img has to do").
  {
    mode: 'compose',
    name: 'jbrowse-img/sv_review_pair',
    parts: ['jbrowse-img/sv_review_tumor', 'jbrowse-img/sv_review_normal'],
    direction: 'horizontal',
  },
]

// jbrowse.org hosts the same test_data/ configs (and the cgiab/hpylori demos)
// these specs load, so every spec's session can be opened as a live, clickable
// instance. The website Figure macro uses screenshotLiveUrls to link each
// screenshot to the running view that produced it. CODE_BASE is the hosted build
// they open in — see src/lib/code-base.ts for retargeting it.
export function specLiveUrl(spec: ScreenshotSpec): string | undefined {
  if (spec.mode === 'url') {
    if (spec.url.startsWith('http')) {
      // an absolute url is used verbatim — unless it's a localhost capture (a
      // local dev-plugin build, e.g. protein/connected), which has no public
      // equivalent and so can't become a reader-facing live link
      return /^https?:\/\/(localhost|127\.0\.0\.1)\b/.test(spec.url)
        ? undefined
        : spec.url
    } else {
      // a bare `?config=...` captured against the local build opens identically
      // on the public hosted instance
      return `${CODE_BASE}${spec.url}`
    }
  } else {
    return undefined
  }
}

// screenshot name -> live-instance URL (all current specs are url-mode)
export const screenshotLiveUrls: Record<string, string> = Object.fromEntries(
  specs.flatMap(spec => {
    const url = specLiveUrl(spec)
    return url ? [[spec.name, url] as const] : []
  }),
)

// Specs whose live session is genuinely slow to open — a heavy remote fetch
// (heavyNetwork) or a whole-genome view that clusters thousands of rows, which
// the reader pays for in their own browser. The Figure macro annotates their
// "Open in JBrowse" link so a reader who clicks it knows to expect a wait rather
// than a broken page. Derived from the spec, not a hand-kept list, so it can't
// drift: a raised timeout is the spec's own statement that this one is slow.
//
// Both kinds of timeout count, because a spec can put its whole wait in either.
// `readyTimeout` covers getting to a session, but a session spec that launches
// work — an MsaView building an alignment out of NCBI and EBI, an rGFA graph
// assembling itself — reaches "ready" quickly and then waits on the result in an
// action. Reading readyTimeout alone classified genomes_msa/pyrin_residues as
// slow only by luck (its 120000 is the ~570-track UCSC config, not the ~3 minute
// alignment), and would have said "fast" outright for the same spec against a
// cheaper config.
const SLOW_TIMEOUT_MS = 120000

// The longest an action is allowed to wait, across a spec's own actions and
// every stage's. A stage frame is part of the same live session.
function longestActionTimeout(spec: ScreenshotSpec) {
  const stages =
    spec.mode === 'url' || spec.mode === 'embedded' ? (spec.stages ?? []) : []
  const actions = [
    ...(spec.mode === 'url' ? (spec.actions ?? []) : []),
    ...stages.flatMap(stage => stage.actions ?? []),
  ]
  return Math.max(0, ...actions.map(action => action.timeout ?? 0))
}

export const screenshotSlowSpecNames = new Set(
  specs
    .filter(
      spec =>
        spec.mode === 'url' &&
        (spec.heavyNetwork ||
          (spec.readyTimeout ?? 0) >= SLOW_TIMEOUT_MS ||
          longestActionTimeout(spec) >= SLOW_TIMEOUT_MS),
    )
    .map(spec => spec.name),
)

// Every figure produced by a spec, whether or not it has a public live URL.
// audit-figures uses this to classify a figure as autogenerated — an embedded
// or localhost-build capture is still autogenerated even though it has no
// interactive jbrowse.org link.
export const screenshotSpecNames = new Set(specs.map(spec => spec.name))

// Spec-list mistakes that produce a plausible-looking figure instead of an
// error. Each of these has a silent failure mode, which is the bar for being
// here — a spec that is merely unusual is not a problem:
//
// - two specs sharing a name write the same PNG, so the second silently
//   overwrites the first every regen, and the `--filter` that "fixes" one keeps
//   flipping the committed image back and forth
// - a compose part naming no spec is only caught at capture time by the
//   missing-file check, which cannot fire after a RENAME: the old part's PNG is
//   still on disk, so the stack keeps being built from an image nothing renders
//   any more
// - the fields an embedded capture ignores (it screenshots the component
//   element, bypassing the shoot path) do nothing at all when set, and nothing
//   said so
//
// Run at the top of a generate-screenshots run — before an hour of rendering —
// and in CI via check-specs.ts, which needs no browser.
export function validateSpecs(list: ScreenshotSpec[] = specs) {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const spec of list) {
    if (seen.has(spec.name)) {
      problems.push(`${spec.name}: two specs share this name`)
    }
    seen.add(spec.name)
  }
  for (const spec of list) {
    if (spec.mode === 'compose') {
      for (const part of spec.parts) {
        if (!seen.has(part)) {
          problems.push(`${spec.name}: part "${part}" is not a spec`)
        }
      }
    } else if (spec.mode === 'embedded') {
      const ignored = (
        [
          ['annotations', spec.annotations?.length],
          ['stages', spec.stages?.length],
          ['crop', spec.crop],
          ['hideSelectors', spec.hideSelectors?.length],
          ['hideTooltip', spec.hideTooltip],
        ] as const
      )
        .filter(([, set]) => set)
        .map(([field]) => field)
      if (ignored.length > 0) {
        problems.push(
          `${spec.name}: embedded specs ignore ${ignored.join(', ')} (they screenshot the component element, not the page)`,
        )
      }
    }
    if ('stageColumns' in spec && spec.stageColumns && !spec.stages?.length) {
      problems.push(`${spec.name}: stageColumns without stages`)
    }
    if ('expectTooltip' in spec && spec.expectTooltip && spec.hideTooltip) {
      problems.push(
        `${spec.name}: expectTooltip and hideTooltip contradict each other`,
      )
    }
  }
  return problems
}

// ── The raw-pixel ratchet ──────────────────────────────────────────────────
//
// `website/CLAUDE.md` says it twice — "never hand-measure a callout position —
// every annotation `anchor`s" and "a click anchors too" — and a rule nothing
// counts is a rule that drifts. This counts.
//
// It is a RATCHET, not a gate: the remaining entries are deliberate (see below),
// so failing on their existence would fail every run. What it stops is number
// 41. Lower BASELINE whenever a conversion lands — the check tells you to, and
// tells you the number.
//
// What is left, and why each is not a bug:
//
// - a caption parked in a corner or a margin, which points at nothing, so the
//   failure this rule guards against (a callout landing off its target) does
//   not apply to it. Anchoring one RELOCATES it, which is a composition change
//   dressed up as a cleanup.
// - the tail of an arrow leaving one of those captions. The caption and its
//   tail are one unit in page coordinates; anchoring only the tail pulls the
//   arrow off the pill it leaves. Both or neither.
// - `dismissMenus`, and the one other backdrop click: they hit nothing on
//   purpose, since a menu's backdrop covers the viewport.
//
// Anything else is a callout that names a thing without saying which one, and
// `scripts/locusAnchor.ts` explains what that has cost.
const BASELINE = 35

export function countRawCallouts(list: ScreenshotSpec[] = specs) {
  const found: string[] = []
  const annotations = (name: string, anns: Annotation[] | undefined) => {
    for (const a of anns ?? []) {
      const raw = [
        (a.x !== undefined || a.y !== undefined) && !a.anchor && 'x/y',
        a.from && !a.fromAnchor && 'from',
        a.to && !a.anchor && 'to',
      ].filter(Boolean)
      if (raw.length > 0) {
        found.push(`${name}: ${a.type} ${raw.join(' + ')}`)
      }
    }
  }
  const actions = (name: string, list: ScreenshotAction[] | undefined) => {
    for (const action of list ?? []) {
      // a rubberband drag genuinely is two viewport points
      if (action.type !== 'drag' && action.from && !action.anchor) {
        found.push(`${name}: ${action.type} from`)
      }
    }
  }
  for (const spec of list) {
    if (spec.mode === 'cli' || spec.mode === 'compose') {
      continue
    }
    annotations(spec.name, spec.annotations)
    actions(spec.name, spec.mode === 'url' ? spec.actions : undefined)
    for (const [i, stage] of (spec.stages ?? []).entries()) {
      annotations(`${spec.name} stage ${i}`, stage.annotations)
      actions(`${spec.name} stage ${i}`, stage.actions)
    }
  }
  return { found, baseline: BASELINE }
}
