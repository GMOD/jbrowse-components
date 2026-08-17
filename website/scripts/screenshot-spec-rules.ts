// The rules a spec list has to satisfy, over a list handed in.
//
// Split out of screenshot-specs.ts so it can be imported without the spec list:
// that barrel reaches @jbrowse/browser-test-utils through every specs/*.ts, and
// that package's entry pulls in puppeteer, which is ESM and which jest will not
// transform. So a test that imports the barrel fails at `export * from
// 'puppeteer-core'` before reaching a single assertion, and the rules below —
// the one thing here worth testing — were untestable for that reason alone. The
// types module carries only type-only imports, so this file has no runtime
// dependency at all.
//
// Both entry points still pass the real list: check-specs.ts in `pnpm
// check-docs`, and generate-screenshots before it renders anything.

import type {
  Annotation,
  ScreenshotAction,
  ScreenshotSpec,
} from './screenshot-spec-types.ts'

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
// - a field a spec sets that the shape it chose then discards: a spec with
//   `stages` draws each stage's own `annotations` and never its top-level ones,
//   and a stage's `readySelector` is only consulted when that stage navigates.
//   Both read as callouts that vanished, or a gate that never ran
// - a compose whose part is itself a compose built LATER in the list, which
//   stacks the part's previous image every time and never says so — the compose
//   pass walks the list in order
export function validateSpecs(list: ScreenshotSpec[]) {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const spec of list) {
    if (seen.has(spec.name)) {
      problems.push(`${spec.name}: two specs share this name`)
    }
    seen.add(spec.name)
  }
  // compose order: the compose pass runs in list order after the render pool, so
  // a part that is itself a compose has to already be built by the time its
  // parent is reached
  const composeIndex = new Map(
    list.flatMap((spec, i) =>
      spec.mode === 'compose' ? [[spec.name, i]] : [],
    ),
  )
  for (const [i, spec] of list.entries()) {
    if (spec.mode === 'compose') {
      for (const part of spec.parts) {
        if (!seen.has(part)) {
          problems.push(`${spec.name}: part "${part}" is not a spec`)
        }
        if (part === spec.name) {
          problems.push(`${spec.name}: lists itself as a part`)
        } else if ((composeIndex.get(part) ?? -1) > i) {
          problems.push(
            `${spec.name}: part "${part}" is a compose spec declared after it, so it would be stacked from its previous image`,
          )
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
          // no `recordTooltip` on this path either, so a declared tooltip is
          // neither hidden nor reported missing
          ['expectTooltip', spec.expectTooltip],
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
    // drawn by `captureStages` and nothing else, so on a single-frame spec it
    // is callouts that silently never appear
    if (
      'gridAnnotations' in spec &&
      spec.gridAnnotations?.length &&
      !spec.stages?.length
    ) {
      problems.push(`${spec.name}: gridAnnotations without stages`)
    }
    // padPanels is the grid arm alone, so a stack's gutter does nothing
    if (
      'stageGutter' in spec &&
      spec.stageGutter !== undefined &&
      !((spec.stageColumns ?? 0) > 1)
    ) {
      problems.push(`${spec.name}: stageGutter without a stageColumns grid`)
    }
    if ('expectTooltip' in spec && spec.expectTooltip && spec.hideTooltip) {
      problems.push(
        `${spec.name}: expectTooltip and hideTooltip contradict each other`,
      )
    }
    if ('stages' in spec && spec.stages?.length) {
      if (spec.annotations?.length) {
        problems.push(
          `${spec.name}: ${spec.annotations.length} top-level annotation(s) alongside stages — a staged figure draws each stage's own, never these`,
        )
      }
      for (const [s, stage] of spec.stages.entries()) {
        if (stage.readySelector && !stage.url) {
          problems.push(
            `${spec.name} stage ${s}: readySelector without url — only a stage that navigates is readied`,
          )
        }
      }
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
// 41. Lower CALLOUT_BASELINE whenever a conversion lands — the check tells you
// to, and tells you the number.
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
export const CALLOUT_BASELINE = 35

export function countRawCallouts(list: ScreenshotSpec[]) {
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
  return { found, baseline: CALLOUT_BASELINE }
}

// ── The detached-label ratchet ─────────────────────────────────────────────
//
// A `text` pill and an `arrow` whose tail leaves that same pill, written as two
// annotations. The gap between them is then a number in the spec, and no number
// is right: a tail belongs at the pill's edge, and a pill's width is only known
// once the page measures its text. One spacing fits one label length, so the
// pair drifts apart the moment anyone edits the label or the font size — with
// nothing to catch it, since both shapes resolve and both draw in frame.
//
// It has been caught three times by a human reading a committed PNG:
// dog10k-size-fst-scan-genome (IGF1 50px clear of its arrow, IGF2BP2's tail
// inside its pill), ld/lct_fst_scan, and homoeolog_synteny/oat_homoeologs.
// `leader: true` on the text draws the arrow from the measured pill instead and
// takes the number out of the spec entirely.
//
// Paired by ANCHOR EQUALITY rather than by proximity: an arrow whose
// `fromAnchor` resolves to the same place as a pill's `anchor` is a pill-arrow
// pair by authorship, so this cannot fire on an arrow that legitimately starts
// in open space.
//
// A ratchet for the same reason the one above is: converting a pair moves
// pixels, so each conversion wants its figure regenerated and they land as
// figures are touched. Lower LEADER_BASELINE when one does.
export const LEADER_BASELINE = 25

// Only the fields that place the anchor — dx/dy are the offsets that differ
// BETWEEN the pill and its tail, which is the whole point.
function anchorSite(anchor: Annotation['anchor']) {
  return anchor
    ? JSON.stringify([
        anchor.track,
        anchor.locus,
        anchor.selector,
        anchor.text,
        anchor.graphNode,
        anchor.hLocus,
        anchor.vLocus,
        anchor.view,
        anchor.fracY,
      ])
    : undefined
}

export function countDetachableLabels(list: ScreenshotSpec[]) {
  const found: string[] = []
  const annotations = (name: string, anns: Annotation[] | undefined) => {
    for (const pill of anns ?? []) {
      if (pill.type !== 'text' || pill.leader) {
        continue
      }
      const site = anchorSite(pill.anchor)
      if (site === undefined) {
        continue
      }
      for (const arrow of anns ?? []) {
        if (arrow.type === 'arrow' && anchorSite(arrow.fromAnchor) === site) {
          found.push(`${name}: "${(pill.text ?? '').split('\n')[0]}"`)
        }
      }
    }
  }
  for (const spec of list) {
    if (spec.mode === 'cli') {
      continue
    }
    annotations(spec.name, spec.annotations)
    const stages = spec.mode === 'compose' ? [] : (spec.stages ?? [])
    for (const [i, stage] of stages.entries()) {
      annotations(`${spec.name} stage ${i}`, stage.annotations)
    }
  }
  return { found, baseline: LEADER_BASELINE }
}
