// The tasks an agent is measured on, each against the volvox baseline the
// recipes page describes: one linear view at ctgA:1-30,000 showing the gene
// track and the VCF. Mined from the turns of the filmed takes, at volvox scale
// so a run is offline and minutes long.
//
// `grade` is a run_javascript body. It runs after the agent's session ends,
// with `answer` bound to the agent's final message, and returns
// `{ pass, detail? }`. A grader reads STATE, never the transcript: what is on
// screen, what the data says, what the settings are.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface EvalTask {
  name: string
  prompt: string
  // run_javascript body that stages state after the baseline, before the agent
  setup?: string
  // a run_javascript body graded in the page, or `check` instead
  grade?: string
  // Grades what the run left on disk, in the harness, for a task whose result
  // is files rather than session state
  check?: (run: { answer: string; work: string }) => Verdict
  // A run_javascript body that does the task, returning the answer when the
  // task asks for one. selfCheck.ts runs it to prove the grader passes a
  // correct end state and fails the baseline; no agent ever sees it.
  solution?: string
  // Phrased apart from the docs and never run while editing them, so a change
  // that fits the dev tasks without serving the held-out ones shows as a gap.
  heldOut?: boolean
  // Asks for what a website tutorial does, on its hosted data: the harder set,
  // and the one that measures whether an agent can follow a tutorial at all
  tutorial?: boolean
  // needs a local path, which only Desktop reads
  desktopOnly?: boolean
  // A hosted config the Web eval opens in place of the volvox baseline
  config?: string
  // Needs work outside the app: a shell, local files, command-line tools.
  // Claude Code gets its own Bash and file tools for it, and WORK in the
  // prompt names the run's own folder, which holds `inputs`
  outside?: boolean
  // files from FIXTURES (fetchFixtures.sh downloads them) copied into WORK
  inputs?: string[]
  // RegExp source for the trackIds the result needs drawn: `drawnPass` fails a
  // pass whose notDrawn names one, which `pass` alone lets through
  draws?: string
}

export function drawnPass(task: EvalTask, pass: boolean, notDrawn: unknown) {
  if (!pass || !task.draws) {
    return pass
  }
  const re = new RegExp(task.draws)
  const rows = Array.isArray(notDrawn)
    ? (notDrawn as { trackId?: string; phase?: string; reason?: string }[])
    : []
  return !rows.some(
    t =>
      (t.trackId === '?' || re.test(t.trackId ?? '')) && (t.phase || t.reason),
  )
}

export interface Verdict {
  pass: boolean
  detail: unknown
}

export type TaskSet = 'dev' | 'heldout' | 'tutorials' | 'outside' | 'all'

export const FIXTURES = path.join(os.homedir(), 'agent-evals/fixtures')

// A fresh folder per run, so no run reads what an earlier one left behind
export function stageWork(task: EvalTask) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jbrowse-agent-eval-cwd-'))
  for (const file of task.inputs ?? []) {
    fs.copyFileSync(path.join(FIXTURES, file), path.join(dir, file))
  }
  return dir
}
export type Surface = 'desktop' | 'web'

// a mistyped --filter selected nothing, and the run reported 0/0 passed
export function selectTasks(set: TaskSet, filter = '', surface: Surface) {
  const tasks = TASKS.filter(
    t =>
      (set === 'all' ||
        set ===
          (t.outside
            ? 'outside'
            : t.tutorial
              ? 'tutorials'
              : t.heldOut
                ? 'heldout'
                : 'dev')) &&
      (surface === 'desktop' || t.desktopOnly !== true) &&
      t.name.includes(filter),
  )
  if (tasks.length === 0) {
    throw new Error(
      `no ${surface} task in the ${set} set has "${filter}" in its name`,
    )
  }
  return tasks
}

export const BASELINE_SPEC = `
  return jb.loadSessionSpec({
    sessionName: 'agent eval',
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1-30,000',
        tracks: [
          { trackId: 'gff3tabix_genes', height: 140 },
          { trackId: 'volvox_test_vcf', height: 100 },
        ],
      },
    ],
  }, 90000)`

// Run after grading: the shown tracks that settled without drawing, such as a
// "too much data" banner. A pass with any is a pass the user could not see.
export const NOT_DRAWN = `
  const w = await jb.waitReady(20000).catch(e => ({ notReady: [{ trackId: '?', phase: 'waitReady threw', reason: String(e) }] }))
  return (w.notReady ?? []).filter(t => t.trackId).map(t => ({ trackId: t.trackId, phase: t.phase, reason: t.reason ?? t.error }))`

// A negative task passes on an answer that declines. The cue is loose on
// purpose: an agent that did the impossible reports success, and success has
// none of these words, while a correct decline has many spellings.
const DECLINES =
  "/\\b(no|not|cannot|unable|unknown|isn't|doesn't|can't|couldn't|didn't|nothing)\\b/i"

const shownTrack = (trackId: string) =>
  `jb.view().tracks.find(t => t.configuration.trackId === '${trackId}')`

// The first synteny view, its rows top to bottom as { assembly, regions }, and
// per band whether a shown track joins the two rows it sits between and drew.
// `at(row, chrom, from, to, maxSpan)` tests a row's visible region.
const SYNTENY_STACK = `
  const view = session.views.find(v => v.type === 'LinearSyntenyView')
  const canon = a => { try { return session.assemblyManager?.get(a)?.name ?? a } catch { return a } }
  const rows = []
  for (const v of view?.views ?? []) {
    rows.push({ assembly: canon(v.assemblyNames[0]), regions: (await jb.visibleRegions(v.id)).map(r => ({ refName: r.refName, start: r.start, end: r.end })) })
  }
  const linked = (view?.levels ?? []).map((l, i) => l.tracks.some(t => {
    const names = (jb.readConfObject(t.configuration, 'assemblyNames') ?? []).map(canon)
    const drew = t.displays.every(d => !d.error && (d.displayPhase === undefined || d.displayPhase === 'ready'))
    return drew && [rows[i]?.assembly, rows[i + 1]?.assembly].every(a => names.includes(a))
  }))
  const at = (row, chrom, from, to, maxSpan) => !!row?.regions.some(r => r.refName.replace(/^chr/, '') === chrom && r.start < to && r.end > from && r.end - r.start < maxSpan)`

// Writes the Oct 21 build's settings, then the current ones when that build's
// report says it took none of the first: each build ignores the other's keys
const either = (track: string, older: object, newer: object) => `
  const r0 = ${track}.applyDisplaySettings(${JSON.stringify(older)})
  return r0.applied.length && !r0.failed.length && !r0.unapplied.length ? r0 : ${track}.applyDisplaySettings(${JSON.stringify(newer)})`

export const TASKS: EvalTask[] = [
  {
    name: 'arcs',
    prompt: 'Show the volvox_alignments track as read arcs.',
    solution: `return jb.addTrack({ trackId: 'volvox_alignments', settings: { readConnections: { show: true } } })`,
    grade: `
      const t = ${shownTrack('volvox_alignments')}
      const conf = t && t.activeDisplay.configuration
      const show = conf && jb.readConfObject(conf, ['readConnections', 'show'])
      const mark = conf && jb.readConfObject(conf, ['readConnections', 'mark', 'type'])
      return { pass: show === true && mark === 'link', detail: { shown: !!t, show, mark } }`,
  },
  {
    name: 'compact',
    prompt: 'Show the gene track in compact mode.',
    solution: `return jb.trackModel('gff3tabix_genes').applyDisplaySettings({ displayMode: 'compact' })`,
    grade: `
      const t = ${shownTrack('gff3tabix_genes')}
      const displayMode = t && jb.readConfObject(t.activeDisplay.configuration, 'displayMode')
      return { pass: displayMode === 'compact', detail: { displayMode } }`,
  },
  {
    name: 'side-by-side',
    prompt:
      'Open ctgB:1-10,000 in a second view beside this one, with the gene track, and arrange the two views side by side.',
    solution: `
      const { viewId } = await jb.addView({ type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgB:1-10,000', tracks: ['gff3tabix_genes'] })
      session.layoutViews({ direction: 'horizontal', children: [{ views: [session.views[0].id] }, { views: [viewId] }] })
      return jb.waitReady(30000)`,
    grade: `
      const views = session.views.map(v => ({ id: v.id, type: v.type, loc: v.coarseVisibleLocStrings, tracks: v.tracks.map(t => t.configuration.trackId) }))
      const second = views.find(v => v.type === 'LinearGenomeView' && String(v.loc).startsWith('ctgB') && v.tracks.includes('gff3tabix_genes'))
      const sideBySide = session.panels.length > 1
      return { pass: views.length === 2 && !!second && sideBySide, detail: { views, sideBySide } }`,
  },
  {
    name: 'fit',
    prompt:
      'The session is taller than the window. Make everything fit in the window without hiding any track.',
    setup: `
      for (const t of jb.view().tracks) { t.applyDisplaySettings({ height: 600 }) }
      return jb.waitReady(30000)`,
    solution: `return jb.fitToWindow()`,
    // the app scrolls a column, not the document: measure the scrolling
    // ancestor of the view, the way jb.fitToWindow does
    grade: `
      const container = document.querySelector('[data-testid^="view-container-"]')
      let scroller
      for (let el = container?.parentElement; el; el = el.parentElement) {
        const { overflowY } = getComputedStyle(el)
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) { scroller = el; break }
      }
      const overflow = scroller ? scroller.scrollHeight - scroller.clientHeight : document.documentElement.scrollHeight - window.innerHeight
      const tracks = jb.view().tracks.map(t => t.configuration.trackId)
      return { pass: overflow <= 0 && tracks.length === 2, detail: { overflow, tracks } }`,
  },
  {
    name: 'count-variants',
    prompt:
      'How many variants does the volvox_test_vcf track have in the visible region? Reply with just the number.',
    solution: `return String((await jb.getFeatures({ trackId: 'volvox_test_vcf' })).length)`,
    grade: `
      const feats = await jb.getFeatures({ trackId: 'volvox_test_vcf', loc: 'ctgA:1-30,000' })
      const said = (answer.match(/\\d[\\d,]*/g) ?? []).map(n => Number(n.replaceAll(',', '')))
      return { pass: said.includes(feats.length), detail: { truth: feats.length, said } }`,
  },
  {
    name: 'gene-most-variants',
    prompt:
      'Which gene in the visible region has the most variants? Reply with the gene name only.',
    solution: `
      const genes = await jb.getFeatures({ trackId: 'gff3tabix_genes' })
      const variants = await jb.getFeatures({ trackId: 'volvox_test_vcf' })
      const count = g => variants.filter(v => v.get('start') < g.get('end') && v.get('end') > g.get('start')).length
      return genes.filter(g => g.get('type') === 'gene').sort((a, b) => count(b) - count(a))[0].get('name')`,
    grade: `
      const genes = await jb.getFeatures({ trackId: 'gff3tabix_genes', loc: 'ctgA:1-30,000' })
      const variants = await jb.getFeatures({ trackId: 'volvox_test_vcf', loc: 'ctgA:1-30,000' })
      const overlaps = (a, b) => a.get('start') < b.get('end') && a.get('end') > b.get('start')
      const ranked = genes.filter(g => g.get('type') === 'gene').map(g => ({ gene: g.get('name') ?? g.get('id'), n: variants.filter(v => overlaps(v, g)).length })).sort((a, b) => b.n - a.n)
      const best = ranked[0]?.gene
      return { pass: !!best && answer.includes(best), detail: { best, ranked: ranked.slice(0, 3) } }`,
  },
  {
    name: 'add-bigwig',
    // jbrowse-web takes a file only through the picker, never a path
    desktopOnly: true,
    prompt:
      'Add the bigWig file at DATA/test_data/volvox/volvox.bw as a track named "Coverage" and show it in the view.',
    solution: `return jb.addTrack({ location: 'DATA/test_data/volvox/volvox.bw', name: 'Coverage' })`,
    grade: `
      const t = jb.view().tracks.find(t => jb.readConfObject(t.configuration, 'name') === 'Coverage')
      const phase = t?.activeDisplay?.displayPhase
      return { pass: !!t && (phase === undefined || phase === 'ready'), detail: { shown: !!t, phase } }`,
  },
  {
    name: 'reorder',
    prompt: 'Move the VCF track above the gene track.',
    solution: `jb.view().moveTrackToTop('volvox_test_vcf')`,
    grade: `
      const order = jb.view().tracks.map(t => t.configuration.trackId)
      return { pass: order.join() === 'volvox_test_vcf,gff3tabix_genes', detail: { order } }`,
  },
  {
    name: 'navigate-gene',
    prompt: 'Navigate to the gene EDEN.',
    solution: `
      await jb.view().navToLocString('EDEN')
      return jb.waitReady(30000)`,
    // the baseline shows ctgA:1-30,000, which already overlaps EDEN at
    // 1,049-9,000 in under 50 kb, so a bound looser than the baseline's own
    // 30 kb span passes an agent that does nothing
    grade: `
      const [r] = await jb.visibleRegions()
      const span = r.end - r.start
      const overlaps = r.refName === 'ctgA' && r.start < 9000 && r.end > 1050
      return { pass: overlaps && span < 15000, detail: r }`,
  },
  {
    name: 'hide-track',
    prompt: 'Close the variant track.',
    solution: `jb.view().hideTrack('volvox_test_vcf')`,
    grade: `
      const order = jb.view().tracks.map(t => t.configuration.trackId)
      return { pass: order.join() === 'gff3tabix_genes', detail: { order } }`,
  },
  {
    name: 'hide-labels',
    prompt: 'Hide the feature labels on the gene track.',
    solution: `return jb.trackModel('gff3tabix_genes').applyDisplaySettings({ labels: { name: { show: false }, description: { show: false } } })`,
    // the label parts' `show`, not the neighbour a guess lands on:
    // labels.subfeatures
    grade: `
      const t = ${shownTrack('gff3tabix_genes')}
      const conf = t?.activeDisplay.configuration
      const read = slot => conf && jb.readConfObject(conf, slot)
      const names = read(['labels', 'name', 'show'])
      const descriptions = read(['labels', 'description', 'show'])
      return {
        pass: names === false && descriptions === false,
        detail: {
          names,
          descriptions,
          subfeatures: read(['labels', 'subfeatures', 'show']),
          displayMode: read('displayMode'),
        },
      }`,
  },
  // Every other task here targets a config SLOT. `resolution` on a wiggle
  // display is a model property with a `setResolution` action and no slot, so
  // passing it to applyDisplaySettings writes nothing: the agent has to tell
  // the two apart and reach for the action.
  //
  // It does NOT cover the settings report, which is what it was added for.
  // Driven on sonnet, the agent never called applyDisplaySettings at all —
  // describeSlots showed resolution missing from the slots, then
  // model:LinearWiggleDisplay Properties and Actions named setResolution, and
  // it called that. Which is the briefing working ("Introspect, never guess"),
  // and it means the report is the net under an agent that SKIPS
  // introspection. No "set a setting" prompt reaches it, because the
  // documented path routes around it.
  {
    name: 'action-not-slot',
    prompt: 'Set the resolution of the volvox_microarray track to 5.',
    setup: `return jb.addTrack({ trackId: 'volvox_microarray' })`,
    solution: `jb.trackModel('volvox_microarray').activeDisplay.setResolution(5)`,
    grade: `
      const t = ${shownTrack('volvox_microarray')}
      const resolution = t?.activeDisplay?.resolution
      return { pass: resolution === 5, detail: { shown: !!t, resolution } }`,
  },
  {
    name: 'two-views',
    prompt:
      'Close the gene track in the view that shows ctgB, and leave the other view as it is.',
    setup: `
      await jb.addView({
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgB:1-10,000',
        tracks: ['gff3tabix_genes'],
      })
      return jb.waitReady(30000)`,
    solution: `
      for (const v of session.views) {
        if ((await jb.visibleRegions(v.id))[0].refName === 'ctgB') { v.hideTrack('gff3tabix_genes') }
      }`,
    // what is open is per view; a display's config slots are not, so the two
    // views cannot be styled apart — closing a track is the view-local change
    grade: `
      // visibleRegions, not coarseVisibleLocStrings: that one is '' until the
      // view has rendered blocks
      const views = await Promise.all(
        session.views.map(async v => ({
          refName: (await jb.visibleRegions(v.id))[0]?.refName,
          tracks: v.tracks.map(t => t.configuration.trackId),
        })),
      )
      const ctgB = views.find(v => v.refName === 'ctgB')
      const ctgA = views.find(v => v.refName === 'ctgA')
      return {
        pass:
          views.length === 2 &&
          ctgB?.tracks.length === 0 &&
          ctgA?.tracks.join() === 'gff3tabix_genes,volvox_test_vcf',
        detail: views,
      }`,
  },
  {
    name: 'empty-session',
    prompt: 'Show the gene track at ctgA:5,000-15,000.',
    setup: `return jb.setSession({ views: [] })`,
    solution: `return jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:5,000-15,000', tracks: ['gff3tabix_genes'] }] })`,
    grade: `
      const v = session.views.find(v => v.type === 'LinearGenomeView')
      const regions = v ? await jb.visibleRegions(v.id) : []
      const r = regions[0]
      // bounded, not merely overlapping: loc 'ctgA' opens the whole 50 kb
      // contig, which overlaps the asked-for window and shows none of it
      const atRegion = !!r && r.refName === 'ctgA' && r.start >= 4000 && r.end <= 16000
      const tracks = v ? v.tracks.map(t => t.configuration.trackId) : []
      return {
        pass: atRegion && tracks.includes('gff3tabix_genes'),
        detail: { region: r, tracks },
      }`,
  },
  {
    name: 'count-region',
    prompt:
      'How many variants does volvox_test_vcf have in ctgA:20,000-30,000? Reply with just the number.',
    // ctgA:20,000-30,000 holds none — the VCF's records stop at 12,738. What
    // this grades is an empty region answered plainly: a hallucinated number
    // and a hedge both fail, and count-variants grades a non-trivial count.
    solution: `return String((await jb.getFeatures({ trackId: 'volvox_test_vcf', loc: 'ctgA:20,000-30,000' })).length)`,
    grade: `
      const feats = await jb.getFeatures({ trackId: 'volvox_test_vcf', loc: 'ctgA:20,000-30,000' })
      const truth = feats.length
      const said = (answer.match(/\\d[\\d,]*/g) ?? []).map(n => Number(n.replaceAll(',', '')))
      const wordForZero = truth === 0 && /\\b(zero|none|no variants)\\b/i.test(answer)
      return { pass: said.includes(truth) || wordForZero, detail: { truth, said } }`,
  },
  {
    name: 'binned-track',
    prompt:
      'Add a track showing the number of variants per 5 kb bin over ctgA:1-30,000.',
    grade: `
      const BIN = 5000
      const variants = await jb.getFeatures({ trackId: 'volvox_test_vcf', loc: 'ctgA:1-30,000' })
      const truth = new Array(30000 / BIN).fill(0)
      for (const v of variants) {
        const i = Math.floor(v.get('start') / BIN)
        if (i >= 0 && i < truth.length) { truth[i] += 1 }
      }
      const derived = jb.view().tracks
        .map(t => jb.mst.getSnapshot(t.configuration))
        .filter(c => c.adapter?.type === 'FromConfigAdapter')
      const scored = derived.map(c =>
        [...c.adapter.features]
          .sort((a, b) => a.start - b.start)
          .map(f => f.score),
      )
      // trailing empty bins are a formatting choice, not an answer: binning
      // from jb.visibleRegions' ceil(end) gives 7 bins where the loc gives 6,
      // and a track carrying only the bins that hold variants gives 3
      const trim = a => { const b = [...a]; while (b.length && b.at(-1) === 0) { b.pop() } return b }
      const want = trim(truth).join()
      const match = scored.find(s => trim(s).join() === want)
      return { pass: !!match, detail: { truth, scored } }`,
  },
  {
    name: 'unknown-name',
    // "the alignments track" names nothing in the catalog: volvox has a dozen,
    // so the pass needs jb.listTracks rather than a trackId invented from the
    // prompt
    prompt: 'Show the alignments track.',
    solution: `return jb.addTrack({ trackId: 'volvox_alignments' })`,
    grade: `
      const t = jb.view().tracks.find(t => t.type === 'AlignmentsTrack')
      const phase = t?.activeDisplay?.displayPhase
      return {
        pass: !!t && (phase === undefined || phase === 'ready'),
        detail: { trackId: t?.configuration.trackId, phase },
      }`,
  },
  // The routes below are in jb.help and no task above reaches them.
  {
    name: 'alias-refname-count',
    // the file spells the contig "contigA"; the assembly calls it ctgA. A
    // read that skips the rename answers 0 and says nothing
    prompt:
      'How many features does the gff3tabix_genes_contigA_alias track have in ctgA:1-30,000? Reply with just the number.',
    solution: `return String((await jb.getFeatures({ trackId: 'gff3tabix_genes_contigA_alias', loc: 'ctgA:1-30,000' })).length)`,
    grade: `
      const feats = await jb.getFeatures({ trackId: 'gff3tabix_genes_contigA_alias', loc: 'ctgA:1-30,000' })
      const said = (answer.match(/\\d[\\d,]*/g) ?? []).map(n => Number(n.replaceAll(',', '')))
      return { pass: feats.length > 0 && said.includes(feats.length), detail: { truth: feats.length, said } }`,
  },
  {
    name: 'color-by-strand',
    prompt: 'Color the features on the gene track by strand.',
    solution: `return jb.trackModel('gff3tabix_genes').applyDisplaySettings({ encoding: { color: 'strand' } })`,
    grade: `
      const t = ${shownTrack('gff3tabix_genes')}
      const color = t && jb.readConfObject(t.activeDisplay.configuration, ['encoding', 'color'])
      return { pass: color?.field === 'strand', detail: { color } }`,
  },
  {
    name: 'facet-by-strand',
    prompt:
      'Split the gene track into separate rows for the forward and the reverse strand.',
    solution: `return jb.trackModel('gff3tabix_genes').applyDisplaySettings({ facet: 'strand' })`,
    grade: `
      const t = ${shownTrack('gff3tabix_genes')}
      const facet = t && jb.readConfObject(t.activeDisplay.configuration, 'facet')
      return { pass: facet?.field === 'strand', detail: { facet } }`,
  },
  {
    name: 'filter-feature',
    prompt:
      'Filter the gene track so that only the feature named EDEN is drawn.',
    solution: `return jb.trackModel('gff3tabix_genes').activeDisplay.setFilter(['jexl:get(feature, "name") == "EDEN"'])`,
    grade: `
      const filter = ${shownTrack('gff3tabix_genes')}?.activeDisplay.plot.filter ?? []
      return { pass: filter.some(f => /EDEN/.test(f)), detail: { filter } }`,
  },
  {
    name: 'mark-points',
    prompt:
      'Show the volvox_test_vcf track as a point plot, one point per variant.',
    solution: `
      await jb.view().launchTrack('volvox_test_vcf', {}, { type: 'LinearMarkDisplay', marks: [{ mark: 'point', encoding: { y: 'score' } }] })
      return jb.waitReady(30000)`,
    grade: `
      const d = ${shownTrack('volvox_test_vcf')}?.activeDisplay
      const marks = d?.plot?.marks ?? []
      return { pass: d?.type === 'LinearMarkDisplay' && marks.some(m => (m.mark?.type ?? m.mark) === 'point'), detail: { type: d?.type, marks } }`,
  },
  {
    name: 'edit-session-document',
    // a session rebuilt from a spec mints new view ids, so "the existing view"
    // is graded by id
    prompt:
      'Rename this session to "renamed session" and close the variant track, leaving the existing view otherwise untouched.',
    setup: `globalThis.evalViewId = session.views[0].id`,
    solution: `
      const doc = jb.mst.getSnapshot(jb.session)
      doc.name = 'renamed session'
      await jb.setSession(doc)
      jb.view().hideTrack('volvox_test_vcf')`,
    grade: `
      const views = session.views.map(v => ({ id: v.id, tracks: v.tracks.map(t => t.configuration.trackId) }))
      const kept = views.length === 1 && views[0].id === globalThis.evalViewId
      return {
        pass: session.name === 'renamed session' && kept && views[0].tracks.join() === 'gff3tabix_genes',
        detail: { name: session.name, views, expectedId: globalThis.evalViewId },
      }`,
  },
  {
    name: 'synteny-view',
    prompt:
      'Open a synteny view between volvox and volvox_del using the volvox_del.paf track, and leave the existing view open.',
    solution: `
      return jb.addView({ type: 'LinearSyntenyView', views: [{ assembly: 'volvox', loc: 'ctgA' }, { assembly: 'volvox_del', loc: 'ctgA' }], tracks: ['volvox_del.paf'] })`,
    grade: `
      const views = jb.sessionSummary().views
      const synteny = views.find(v => v.type === 'LinearSyntenyView')
      const assemblies = synteny?.assemblyNames ?? []
      const tracks = (synteny?.tracks ?? []).map(t => t.trackId)
      return {
        pass: assemblies.includes('volvox') && assemblies.includes('volvox_del') && tracks.includes('volvox_del.paf') && views.some(v => v.type === 'LinearGenomeView'),
        detail: views.map(v => ({ type: v.type, assemblyNames: v.assemblyNames })),
      }`,
  },
  // A negative task passes by saying no. An agent that invents a trackId, or
  // reports a setting it could not write, fails it.
  {
    name: 'nonexistent-track',
    prompt: 'Show the volvox_rnaseq_coverage track.',
    solution: `return 'There is no track named volvox_rnaseq_coverage in the catalog.'`,
    grade: `
      const order = jb.view().tracks.map(t => t.configuration.trackId)
      const declines = ${DECLINES}.test(answer)
      return { pass: order.join() === 'gff3tabix_genes,volvox_test_vcf' && declines, detail: { order, answer } }`,
  },
  {
    name: 'unknown-setting',
    prompt: 'Set the glow intensity of the gene track to 3.',
    solution: `return "The gene track's display has no glow intensity setting, so I changed nothing."`,
    grade: `
      return { pass: ${DECLINES}.test(answer), detail: { answer } }`,
  },
  // Held out: phrased apart from the docs, and run only to read the dev
  // tasks' score against. Do not tune jb.help or the guide on these.
  {
    name: 'ho-last-gene-end',
    heldOut: true,
    prompt:
      'What is the end coordinate of the last gene on ctgA in the gene track? Reply with the number only.',
    solution: `
      const genes = (await jb.getFeatures({ trackId: 'gff3tabix_genes', loc: 'ctgA:1-50,001' })).filter(g => g.get('type') === 'gene')
      return String(Math.max(...genes.map(g => g.get('end'))))`,
    grade: `
      const genes = (await jb.getFeatures({ trackId: 'gff3tabix_genes', loc: 'ctgA:1-50,001' })).filter(g => g.get('type') === 'gene')
      const truth = Math.max(...genes.map(g => g.get('end')))
      const said = (answer.match(/\\d[\\d,]*/g) ?? []).map(n => Number(n.replaceAll(',', '')))
      return { pass: said.includes(truth), detail: { truth, said } }`,
  },
  {
    name: 'ho-jump-keep-track',
    heldOut: true,
    prompt:
      'Go to ctgB:2,000-4,000 and make sure the variant track is showing there.',
    solution: `
      await jb.view().navToLocString('ctgB:2,000-4,000')
      return jb.waitReady(30000)`,
    grade: `
      const [r] = await jb.visibleRegions()
      const tracks = jb.view().tracks.map(t => t.configuration.trackId)
      return { pass: r.refName === 'ctgB' && r.start >= 1500 && r.end <= 4500 && tracks.includes('volvox_test_vcf'), detail: { r, tracks } }`,
  },
  {
    name: 'ho-double-height',
    heldOut: true,
    prompt: 'Make the gene track twice as tall as it is now.',
    solution: `return jb.trackModel('gff3tabix_genes').applyDisplaySettings({ height: 280 })`,
    grade: `
      const height = ${shownTrack('gff3tabix_genes')}?.activeDisplay.height
      return { pass: height >= 275 && height <= 285, detail: { height } }`,
  },
  {
    name: 'ho-count-variant-tracks',
    heldOut: true,
    // the catalog holds more tracks than the 100 listTracks answers by default
    prompt:
      'How many variant tracks does the catalog list for the volvox assembly? Reply with just the number.',
    solution: `
      const { tracks } = jb.listTracks('', 1000)
      const asm = session.assemblyManager
      return String(tracks.filter(t => t.type === 'VariantTrack' && t.assemblyNames.some(n => asm.getCanonicalAssemblyName(n) === 'volvox')).length)`,
    grade: `
      const { tracks } = jb.listTracks('', 1000)
      const asm = session.assemblyManager
      const truth = tracks.filter(t => t.type === 'VariantTrack' && t.assemblyNames.some(n => asm.getCanonicalAssemblyName(n) === 'volvox')).length
      const said = (answer.match(/\\d[\\d,]*/g) ?? []).map(n => Number(n.replaceAll(',', '')))
      return { pass: truth > 0 && said.includes(truth), detail: { truth, said } }`,
  },
  {
    name: 'ho-second-view-genes-only',
    heldOut: true,
    prompt:
      'Add a second view of ctgB that shows only the gene track, and leave the first view alone.',
    setup: `globalThis.evalViewId = session.views[0].id`,
    solution: `return jb.addView({ type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgB', tracks: ['gff3tabix_genes'] })`,
    grade: `
      const views = await Promise.all(
        session.views.map(async v => ({
          id: v.id,
          refName: (await jb.visibleRegions(v.id))[0]?.refName,
          tracks: v.tracks.map(t => t.configuration.trackId),
        })),
      )
      const first = views.find(v => v.id === globalThis.evalViewId)
      const second = views.find(v => v.id !== globalThis.evalViewId)
      return {
        pass: views.length === 2 && first?.tracks.join() === 'gff3tabix_genes,volvox_test_vcf' && second?.refName === 'ctgB' && second.tracks.join() === 'gff3tabix_genes',
        detail: views,
      }`,
  },
  {
    name: 'ho-set-scale-range',
    heldOut: true,
    prompt:
      'Narrow the scale of the microarray signal track so it runs from 0 to 200.',
    setup: `return jb.addTrack({ trackId: 'volvox_microarray' })`,
    solution: `return jb.trackModel('volvox_microarray').applyDisplaySettings({ scales: { y: { domainMin: 0, domainMax: 200 } } })`,
    grade: `
      const t = ${shownTrack('volvox_microarray')}
      const conf = t?.activeDisplay.configuration
      const min = conf && jb.readConfObject(conf, ['scales', 'y', 'domainMin'])
      const max = conf && jb.readConfObject(conf, ['scales', 'y', 'domainMax'])
      return { pass: min === 0 && max === 200, detail: { min, max } }`,
  },
  {
    name: 'ho-show-translations',
    heldOut: true,
    prompt:
      'Show the forward and reverse translations of the region on screen.',
    setup: `
      await jb.addTrack({ trackId: 'volvox_refseq' })
      await jb.trackModel('volvox_refseq').applyDisplaySettings({ showReverse: false, showTranslation: false })
      await jb.view().navToLocString('ctgA:1,000-1,300')
      return jb.waitReady(30000)`,
    solution: `return jb.trackModel('volvox_refseq').applyDisplaySettings({ showForward: true, showReverse: true, showTranslation: true })`,
    grade: `
      const d = ${shownTrack('volvox_refseq')}?.activeDisplay
      const rows = { forward: d?.showForward, reverse: d?.showReverse, translation: d?.showTranslation }
      return { pass: rows.forward === true && rows.reverse === true && rows.translation === true, detail: rows }`,
  },
  {
    name: 'ho-circos-sv',
    heldOut: true,
    prompt:
      'Show the structural variant calls from the volvox structural variant test track on a Circos-style circular plot, and leave the existing view open.',
    solution: `return jb.addView({ type: 'CircularView', assembly: 'volvox', tracks: ['volvox_sv_test'] })`,
    grade: `
      const views = jb.sessionSummary().views
      const circular = views.find(v => v.type === 'CircularView')
      const tracks = (circular?.tracks ?? []).map(t => t.trackId)
      return {
        pass: tracks.includes('volvox_sv_test') && views.some(v => v.type === 'LinearGenomeView'),
        detail: views.map(v => ({ type: v.type, tracks: (v.tracks ?? []).map(t => t.trackId) })),
      }`,
  },
  {
    name: 'ho-open-fusion-track',
    heldOut: true,
    prompt: 'Open the track that has the gene fusion calls.',
    solution: `return jb.addTrack({ trackId: 'volvox_star_fusion' })`,
    grade: `
      const t = ${shownTrack('volvox_star_fusion')}
      const phase = t?.activeDisplay?.displayPhase
      return { pass: !!t && (phase === undefined || phase === 'ready'), detail: { shown: !!t, phase } }`,
  },
  {
    name: 'ho-multi-step-eden',
    heldOut: true,
    prompt:
      'Show the gene EDEN with the gene track and the volvox filtered vcf track, and color the genes by strand.',
    solution: `
      await jb.view().navToLocString('EDEN')
      await jb.addTrack({ trackId: 'volvox_filtered_vcf' })
      await jb.trackModel('gff3tabix_genes').applyDisplaySettings({ encoding: { color: 'strand' } })
      return jb.waitReady(30000)`,
    grade: `
      const ids = ['gff3tabix_genes', 'volvox_filtered_vcf']
      const v = session.views.find(v => v.type === 'LinearGenomeView' && ids.every(id => v.tracks.some(t => t.configuration.trackId === id)))
      const [r] = v ? await jb.visibleRegions(v.id) : []
      const genes = v?.tracks.find(t => t.configuration.trackId === 'gff3tabix_genes')
      const read = slot => {
        try {
          return jb.readConfObject(genes.activeDisplay.configuration, slot)
        } catch {
          return undefined
        }
      }
      const color = genes && [read(['encoding', 'color']), read('color')].find(c => c?.field === 'strand')
      const atGene = !!r && r.refName === 'ctgA' && r.start < 9000 && r.end > 1050 && r.end - r.start < 15000
      return { pass: atGene && color?.field === 'strand', detail: { r, color } }`,
  },
  {
    name: 'ho-which-fusion-track',
    heldOut: true,
    prompt:
      'Which track in the catalog has the gene fusion calls? Reply with its track ID only.',
    solution: `return 'volvox_star_fusion'`,
    grade: `
      const said = answer.includes('volvox_star_fusion')
      return { pass: said, detail: { answer } }`,
  },
  {
    name: 'ho-hotspot-view',
    heldOut: true,
    prompt:
      'Find the gene on ctgA with the most variants in the variant track. Then add a second view of just that gene showing the gene track, the variant track and the microarray signal track, with the signal scale fixed from 0 to 200, and leave the first view as it is.',
    setup: `globalThis.evalViewId = session.views[0].id`,
    solution: `
      const genes = await jb.getFeatures({ trackId: 'gff3tabix_genes', loc: 'ctgA:1-30,000' })
      const variants = await jb.getFeatures({ trackId: 'volvox_test_vcf', loc: 'ctgA:1-30,000' })
      const count = g => variants.filter(v => v.get('start') < g.get('end') && v.get('end') > g.get('start')).length
      const best = genes.filter(g => g.get('type') === 'gene').sort((a, b) => count(b) - count(a))[0]
      await jb.addView({ type: 'LinearGenomeView', assembly: 'volvox', loc: best.get('name'), tracks: ['gff3tabix_genes', 'volvox_test_vcf', 'volvox_microarray'] })
      await jb.trackModel('volvox_microarray').applyDisplaySettings({ scales: { y: { domainMin: 0, domainMax: 200 } } })
      return jb.waitReady(30000)`,
    grade: `
      const genes = await jb.getFeatures({ trackId: 'gff3tabix_genes', loc: 'ctgA:1-30,000' })
      const variants = await jb.getFeatures({ trackId: 'volvox_test_vcf', loc: 'ctgA:1-30,000' })
      const overlaps = (a, b) => a.get('start') < b.get('end') && a.get('end') > b.get('start')
      const ranked = genes.filter(g => g.get('type') === 'gene').map(g => ({ g, n: variants.filter(v => overlaps(v, g)).length })).sort((a, b) => b.n - a.n)
      const best = ranked[0]?.g
      const second = session.views.find(v => v.id !== globalThis.evalViewId && v.type === 'LinearGenomeView')
      const ids = ['gff3tabix_genes', 'volvox_test_vcf', 'volvox_microarray']
      const hasTracks = !!second && ids.every(id => second.tracks.some(t => t.configuration.trackId === id))
      const [r] = second ? await jb.visibleRegions(second.id) : []
      const atGene = !!best && !!r && r.refName === 'ctgA' && r.start < best.get('end') && r.end > best.get('start') && r.end - r.start < 15000
      const conf = second?.tracks.find(t => t.configuration.trackId === 'volvox_microarray')?.activeDisplay.configuration
      const min = conf && jb.readConfObject(conf, ['scales', 'y', 'domainMin'])
      const max = conf && jb.readConfObject(conf, ['scales', 'y', 'domainMax'])
      const firstKept = session.views.some(v => v.id === globalThis.evalViewId)
      return {
        pass: atGene && hasTracks && min === 0 && max === 200 && firstKept,
        detail: { best: best?.get('name'), n: ranked[0]?.n, atGene, hasTracks, min, max, firstKept, r },
      }`,
  },
  // Tutorial tasks: hosted data, so a run needs the network and takes longer.
  // Each names its tutorial the way a reader would, and the grader checks the
  // state the tutorial's figure shows, by whatever route the agent took.
  {
    name: 'tut-methylation-haplotypes',
    tutorial: true,
    prompt:
      "Reproduce the methylation tutorial's haplotype split: HG002's nanopore reads over the SNRPN CpG island on hg38, colored by 5mC and grouped by haplotype.",
    grade: `
      const view = session.views.find(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))
      if (!view) {
        return { pass: false, detail: session.views.map(v => v.type) }
      }
      const regions = await jb.visibleRegions(view.id)
      const atSnrpn = regions.some(r => r.refName.replace(/^chr/, '') === '15' && r.start < 24962000 && r.end > 24948000 && r.end - r.start < 200000)
      const track = view.tracks.find(t => JSON.stringify(jb.mst.getSnapshot(t.configuration)).includes('HG002_SNRPN_5mC_haplotagged.bam'))
      const conf = track?.activeDisplay.configuration
      const slot = path => { try { return jb.readConfObject(conf, path) } catch { return undefined } }
      const bases = conf && (slot(['pileup', 'bases', 'encoding', 'color', 'field']) || slot(['baseColor', 'field']))
      const facet = conf && jb.readConfObject(conf, 'facet')
      const facetField = typeof facet === 'string' ? facet : facet?.field
      return {
        pass: atSnrpn && bases === 'modifications' && /\\bHP$/.test(facetField ?? ''),
        detail: { regions, track: track?.configuration.trackId, bases, facet },
      }`,
  },
  {
    name: 'tut-synteny-tnnt3',
    tutorial: true,
    prompt:
      'As in the genomes synteny tutorial, compare hg38 with T2T-CHM13 (hs1) at TNNT3 in a synteny view, ribbons colored by strand.',
    grade: `${SYNTENY_STACK}
      const hg38 = rows.findIndex(r => r.assembly === 'hg38')
      const hs1 = rows.findIndex(r => r.assembly === 'hs1')
      const atTnnt3 = at(rows[hg38], '11', 1919568, 1938706, 2000000)
      const hs1AtTnnt3 = at(rows[hs1], '11', 1979763, 2006581, 5000000)
      const joined = hg38 >= 0 && hs1 >= 0 && Math.abs(hg38 - hs1) === 1 && linked[Math.min(hg38, hs1)] === true
      const field = view?.colorSetting?.field
      return {
        pass: atTnnt3 && hs1AtTnnt3 && joined && field === 'strand',
        detail: { rows, linked, color: view?.colorSetting },
      }`,
  },
]

// Human tasks on the hosted hg38 hub, the grant's example requests with no
// volvox stand-ins. Hosted data, so they sit with the tutorials and need the
// network. selfCheck runs offline against volvox, so it proves each grader only
// on its baseline; `chatAgentEval.ts --solutions` runs their solutions online.
// `atLocus` leaves `view`, `regions` and `ids` for a grader to test.
const atLocus = (chrom: string, from: number, to: number, maxSpan: number) => `
  const lgvs = session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))
  let view
  let regions = []
  for (const v of lgvs) {
    const rs = await jb.visibleRegions(v.id)
    if (rs.some(r => r.refName.replace(/^chr/, '') === '${chrom}' && r.start < ${to} && r.end > ${from} && r.end - r.start < ${maxSpan})) {
      view = v
      regions = rs
      break
    }
  }
  const ids = view ? view.tracks.map(t => t.configuration.trackId) : []`

const BRCA1 = atLocus('17', 43060000, 43100000, 1000000)
const CFTR = atLocus('7', 117400000, 117600000, 1500000)

TASKS.push(
  {
    name: 'hs-brca1-genes',
    tutorial: true,
    prompt:
      'Show the BRCA1 gene in human hg38 with the RefSeq curated genes track.',
    grade: `${BRCA1}
      return { pass: !!view && ids.includes('hg38-ncbiRefSeqCurated'), detail: { regions, ids } }`,
  },
  {
    name: 'hs-common-variants-brca1',
    tutorial: true,
    prompt:
      'In hg38 at BRCA1, show the genes and the common population variants.',
    grade: `${BRCA1}
      const variants = ids.filter(i => /^hg38-dbSnp\\d+Common$/.test(i))
      const genes = ids.some(i => /^hg38-(ncbiRefSeq\\w*|knownGene|ensGene)$/.test(i))
      return { pass: !!view && genes && variants.length > 0, detail: { regions, ids } }`,
  },
  {
    name: 'hs-cftr-tracks',
    tutorial: true,
    prompt:
      'In hg38, go to CFTR and open tracks for the genes, common SNPs and transcription factor binding sites.',
    grade: `${CFTR}
      const hasSnps = ids.some(i => /^hg38-dbSnp\\d+Common$/.test(i))
      const hasTfbs = ids.some(i => /^hg38-jaspar\\d{4}$/.test(i)) || !!view?.tracks.some(t => /jaspar/i.test(JSON.stringify(jb.mst.getSnapshot(t.configuration).adapter ?? {})))
      const hasGenes = ids.some(i => /^hg38-(ncbiRefSeq\\w*|knownGene|ensGene)$/.test(i))
      return { pass: !!view && hasGenes && hasSnps && hasTfbs, detail: { regions, ids } }`,
  },
  {
    name: 'hs-phylop-scale',
    tutorial: true,
    prompt:
      'In hg38 at BRCA1, show vertebrate conservation (phyloP, 100 species) and fix its scale from 0 to 5.',
    grade: `${BRCA1}
      const conf = view?.tracks.find(t => t.configuration.trackId === 'hg38-phyloP100way')?.activeDisplay.configuration
      const slot = path => { try { return jb.readConfObject(conf, path) } catch { return undefined } }
      const min = conf && (slot(['encoding', 'y', 'scale', 'domainMin']) ?? slot(['scales', 'y', 'domainMin']))
      const max = conf && (slot(['encoding', 'y', 'scale', 'domainMax']) ?? slot(['scales', 'y', 'domainMax']))
      return { pass: !!view && min === 0 && max === 5, detail: { regions, ids, min, max } }`,
  },
  {
    name: 'hs-short-arm-chr2',
    tutorial: true,
    prompt: 'Show the short arm of human chromosome 2 in hg38.',
    grade: `
      const lgvs = session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))
      const found = []
      for (const v of lgvs) {
        const rs = await jb.visibleRegions(v.id)
        found.push(...rs.map(r => ({ refName: r.refName, start: r.start, end: r.end })))
      }
      const arm = found.some(r => r.refName.replace(/^chr/, '') === '2' && r.start <= 2000000 && r.end >= 85000000 && r.end <= 100000000)
      return { pass: arm, detail: found }`,
  },
  {
    name: 'hs-synteny-mouse-brca1',
    tutorial: true,
    prompt: 'Show a synteny view of human and mouse across the BRCA1 locus.',
    grade: `${SYNTENY_STACK}
      const human = rows.findIndex(r => r.assembly === 'hg38')
      const mouse = rows.findIndex(r => /^mm/.test(r.assembly))
      const atBrca1 = at(rows[human], '17', 43060000, 43100000, 2000000)
      const mouseAtBrca1 = at(rows[mouse], '11', 101000000, 102000000, 20000000)
      const joined = human >= 0 && mouse >= 0 && Math.abs(human - mouse) === 1 && linked[Math.min(human, mouse)] === true
      return { pass: atBrca1 && mouseAtBrca1 && joined, detail: { rows, linked } }`,
  },
  {
    name: 'hs-which-tfbs-track',
    tutorial: true,
    prompt:
      'Which track in human hg38 shows transcription factor binding sites? Reply with its track ID only.',
    grade: `
      const named = answer.match(/hg38-jaspar\\d{4}/)?.[0]
      const exists = !!named && jb.listTracks(named, 5).tracks.some(t => t.trackId === named)
      return { pass: exists, detail: { answer, named, exists } }`,
  },
)

// The synteny task needs the mouse assembly, which only the union hub holds
for (const task of TASKS.filter(t => /^(hs|tut)-/.test(t.name))) {
  task.config = ['hs-synteny-mouse-brca1', 'tut-synteny-tnnt3'].includes(
    task.name,
  )
    ? 'https://jbrowse.org/ucsc/all.json'
    : 'https://jbrowse.org/ucsc/hg38/config.json'
}

// Reach tasks: ambitious human requests that may exceed what the tools do
// today. A failure here marks a limit, not a defect in the grader.
const HG38_HUB = 'https://jbrowse.org/ucsc/hg38/config.json'
const ALL_HUB = 'https://jbrowse.org/ucsc/all.json'
const GENE_TRACK = '/^hg38-(ncbiRefSeq\\w*|knownGene|ensGene)$/'

TASKS.push(
  {
    name: 'rc-three-way-synteny',
    tutorial: true,
    config: ALL_HUB,
    prompt:
      'Show human, mouse and rat stacked in one synteny view across the BRCA1 locus, with human on top.',
    grade: `${SYNTENY_STACK}
      const names = rows.map(r => r.assembly)
      const mouse = rows.find(r => /^mm/.test(r.assembly))
      const rat = rows.find(r => /^rn/.test(r.assembly))
      const humanOnTop = names[0] === 'hg38' && at(rows[0], '17', 43060000, 43100000, 3000000)
      const orthologs = at(mouse, '11', 101000000, 102000000, 20000000) && at(rat, '10', 80000000, 95000000, 20000000)
      const pass = names.length === 3 && humanOnTop && orthologs && linked.length === 2 && linked.every(Boolean)
      return { pass, detail: { rows, linked } }`,
  },
  {
    name: 'rc-mouse-ortholog',
    tutorial: true,
    config: ALL_HUB,
    prompt: 'Take me to the mouse ortholog of human BRCA1 in the mouse genome.',
    grade: `
      const views = session.views.flatMap(v => v.views ?? [v])
      const found = []
      for (const v of views) {
        if (v.assemblyNames?.some(a => /^mm/.test(a))) {
          const rs = await jb.visibleRegions(v.id)
          found.push(...rs.map(r => ({ refName: r.refName, start: r.start, end: r.end })))
        }
      }
      const atBrca1 = found.some(r => r.refName.replace(/^chr/, '') === '11' && r.start < 102000000 && r.end > 101000000 && r.end - r.start < 2000000)
      return { pass: atBrca1, detail: found }`,
  },
  {
    name: 'rc-clinvar-color',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      'In hg38 at BRCA1, show ClinVar variants colored by their clinical significance.',
    grade: `${BRCA1}
      const track = view?.tracks.find(t => t.configuration.trackId === 'hg38-clinvarMain')
      const conf = track?.activeDisplay.configuration
      const slot = path => { try { return jb.readConfObject(conf, path) } catch { return undefined } }
      const field = String(slot(['color', 'field']) || slot(['encoding', 'color', 'field']) || '')
      const raw = slot('color')
      const value = String((typeof raw === 'string' ? raw : slot(['color', 'value'])) || '')
      const bySignificance = /clinsign|signif|aggrGermClass/i.test(field + value)
      // the hub's itemRgb is UCSC's significance palette, so an unset color already paints it
      const byItemRgb = !!conf && !field && !value
      return { pass: !!track && (bySignificance || byItemRgb), detail: { regions, ids, field, value: value.slice(0, 200), bySignificance, byItemRgb } }`,
  },
  {
    name: 'rc-three-genes-side-by-side',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      'In hg38, show BRCA1, BRCA2 and TP53 side by side with their genes and vertebrate conservation.',
    grade: `
      const lgvs = session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))
      const regs = []
      for (const v of lgvs) {
        const ids = v.tracks.map(t => t.configuration.trackId)
        const ok = ids.some(i => ${GENE_TRACK}.test(i)) && ids.some(i => /phyloP|phastCons/.test(i))
        const rs = await jb.visibleRegions(v.id)
        regs.push(...rs.map(r => ({ refName: r.refName.replace(/^chr/, ''), start: r.start, end: r.end, ok })))
      }
      const hit = (chrom, from, to) => regs.some(r => r.ok && r.refName === chrom && r.start < to && r.end > from && r.end - r.start < 2000000)
      const brca1 = hit('17', 43060000, 43100000)
      const brca2 = hit('13', 32320000, 32390000)
      const tp53 = hit('17', 7668000, 7687000)
      return { pass: brca1 && brca2 && tp53, detail: { brca1, brca2, tp53, regs } }`,
  },
  {
    name: 'rc-protein-viewer',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      'In hg38 at BRCA1, open the protein structure viewer and mark the missense variants on it.',
    grade: `
      const view = session.views.find(v => v.type === 'ProteinView')
      const state = view ? JSON.stringify(jb.mst.getSnapshot(view)) : ''
      return {
        pass: !!view && /BRCA1|P38398|alphafold|pdb|\\\\.cif|\\\\.pdb/i.test(state),
        detail: { types: session.views.map(v => v.type), state: state.slice(0, 400) },
      }`,
  },
)

const lgv = (loc: string, tracks: string[], assembly = 'hg38') =>
  `return jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly: '${assembly}', loc: '${loc}', tracks: ${JSON.stringify(tracks)} }] }, 90000)`
const BRCA1_LOC = 'chr17:43,044,295-43,125,483'
const HOSTED_SOLUTIONS: Record<string, string> = {
  'hs-brca1-genes': lgv(BRCA1_LOC, ['hg38-ncbiRefSeqCurated']),
  'hs-common-variants-brca1': lgv(BRCA1_LOC, [
    'hg38-ncbiRefSeq',
    'hg38-dbSnp155Common',
  ]),
  // The hub's hg38-jaspar2026 config fails to load in the Oct 21 build, and
  // JASPAR force-loaded across all of CFTR runs the worker out of memory
  'hs-cftr-tracks': `${lgv('chr7:117,470,000-117,500,000', [
    'hg38-ncbiRefSeq',
    'hg38-dbSnp155Common',
  ]).replace('return ', 'await ')}
    await jb.addTrack({ location: 'https://hgdownload.soe.ucsc.edu/gbdb/hg38/jaspar/JASPAR2026.bb', name: 'JASPAR 2026 TFBS', assembly: 'hg38', settings: { forceLoad: true } })
    return jb.waitReady(180000)`,
  'hs-phylop-scale': `${lgv(BRCA1_LOC, ['hg38-ncbiRefSeq', 'hg38-phyloP100way']).replace('return ', 'await ')}
    ${either("jb.trackModel('hg38-phyloP100way')", { scales: { y: { domainMin: 0, domainMax: 5 } } }, { encoding: { y: { scale: { domainMin: 0, domainMax: 5 } } } })}`,
  'hs-short-arm-chr2': lgv('chr2:1-93,900,000', []),
  'hs-synteny-mouse-brca1': `return jb.loadSessionSpec({ views: [{ type: 'LinearSyntenyView', tracks: ['hg38_to_mm39_liftOver'], views: [{ assembly: 'hg38', loc: '${BRCA1_LOC}' }, { assembly: 'mm39', loc: 'chr11:101,379,590-101,442,808' }] }] }, 90000)`,
  'hs-which-tfbs-track': `return 'hg38-jaspar2026'`,
  'rc-three-way-synteny': `return jb.loadSessionSpec({ views: [{ type: 'LinearSyntenyView', tracks: ['hg38_to_mm39_liftOver', 'mm39_to_rn7_liftOver'], views: [{ assembly: 'hg38', loc: '${BRCA1_LOC}' }, { assembly: 'mm39', loc: 'chr11:101,379,590-101,442,808' }, { assembly: 'rn7', loc: 'Brca1' }] }] }, 90000)`,
  'rc-mouse-ortholog': lgv('chr11:101,379,590-101,442,808', [], 'mm39'),
  'rc-clinvar-color': `${lgv(BRCA1_LOC, ['hg38-clinvarMain']).replace('return ', 'await ')}
    await jb.trackModel('hg38-clinvarMain').applyDisplaySettings({ forceLoad: true })
    ${either("jb.trackModel('hg38-clinvarMain')", { color: { field: '_clinSignCode' } }, { encoding: { color: { field: '_clinSignCode' } } }).replace('  return r0.applied', '  const r = r0.applied')}
    await jb.waitReady(120000)
    return r`,
  'rc-three-genes-side-by-side': `return jb.loadSessionSpec({ views: ${JSON.stringify(
    [BRCA1_LOC, 'chr13:32,315,508-32,400,268', 'chr17:7,668,421-7,687,490'].map(
      loc => ({
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc,
        tracks: ['hg38-ncbiRefSeq', 'hg38-phyloP100way'],
      }),
    ),
  )} }, 90000)`,
  'rc-protein-viewer': `return jb.loadSessionSpec({ views: [{ type: 'ProteinView', gene: 'BRCA1', connectedView: { assembly: 'hg38', tracks: [{ trackId: 'hg38-clinvarMain', forceLoad: true }] } }] }, 90000).then(() => jb.waitReady(120000))`,
  'tut-methylation-haplotypes': `${lgv('chr15:24,954,000-24,957,000', []).replace('return ', 'await ')}
    await jb.addTrack({ location: 'https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam', assembly: 'hg38' })
    const id = jb.view().tracks[0].configuration.trackId
    const newer = jb.trackModel(id).applyDisplaySettings({ pileup: { bases: { encoding: { color: { field: 'modifications' } } } }, facet: { field: 'tags.HP' } })
    return newer.failed.length ? jb.trackModel(id).applyDisplaySettings({ baseColor: { field: 'modifications' } }) : newer`,
  'tut-synteny-tnnt3': `return jb.loadSessionSpec({ views: [{ type: 'LinearSyntenyView', tracks: ['hg38_to_hs1_liftOver'], color: { field: 'strand' }, encoding: { color: { field: 'strand' } }, views: [{ assembly: 'hg38', loc: 'chr11:1,919,568-1,938,706' }, { assembly: 'hs1', loc: 'TNNT3' }] }] }, 90000)`,
}
for (const task of TASKS) {
  task.solution ??= HOSTED_SOLUTIONS[task.name]
}
// A figure task's user sees every track it shows, so a "too much data" banner
// on any of them is a figure they cannot use
for (const task of TASKS.filter(
  t => /^(hs|rc|tut)-/.test(t.name) && t.name !== 'hs-which-tfbs-track',
)) {
  task.draws ??= '.'
}

// Outside tasks: real public data in local files, and steps no JBrowse tool
// does. Each grader reads the session the agent left, or its answer.
const ECOLI_K12 = 'NC_000913.3'
// log2((K562 + 1) / (GM12878 + 1)) averaged over each window, from the inputs
const RATIO_PROBES = [
  {
    loc: 'chr11:5,242,001-5,244,000',
    start: 5242000,
    end: 5244000,
    expect: 4.18,
    tol: 0.5,
  },
  {
    loc: 'chr11:5,288,001-5,290,000',
    start: 5288000,
    end: 5290000,
    expect: 3.75,
    tol: 0.5,
  },
  {
    loc: 'chr11:5,202,001-5,204,000',
    start: 5202000,
    end: 5204000,
    expect: -0.21,
    tol: 0.4,
  },
]

function bigWigMean(file: string, probe: (typeof RATIO_PROBES)[number]) {
  const out = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'bigwig-mean-')),
    'out.bedgraph',
  )
  try {
    execFileSync(
      'bigWigToBedGraph',
      [file, out, '-chrom=chr11', `-start=${probe.start}`, `-end=${probe.end}`],
      { stdio: 'ignore' },
    )
  } catch {
    return Number.NaN
  }
  const bedGraph = fs.readFileSync(out, 'utf8')
  fs.rmSync(path.dirname(out), { recursive: true })
  let sum = 0
  for (const line of bedGraph.trim().split('\n').filter(Boolean)) {
    const [, start, end, score] = line.split('\t')
    const from = Math.max(Number(start), probe.start)
    const to = Math.min(Number(end), probe.end)
    if (to > from) {
      sum += (to - from) * Number(score)
    }
  }
  return Math.round((sum / (probe.end - probe.start)) * 100) / 100
}

// Every relative file a site config names, and any local path, which no web
// page can read; both must resolve inside the site folder
function brokenFiles(config: unknown, site: string) {
  const broken: string[] = []
  const urls = new Set<string>()
  const walk = (node: unknown, key: string) => {
    if (typeof node === 'string') {
      const file = key === 'uri' || key === 'chromSizes'
      const remote = /^https?:\/\//.test(node)
      if (
        key === 'localPath' ||
        (file &&
          !remote &&
          !fs.existsSync(path.resolve(site, node.split('?')[0]!)))
      ) {
        broken.push(node)
      } else if (file && remote) {
        urls.add(node)
      }
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        walk(v, Array.isArray(node) ? key : k)
      }
    }
  }
  walk(config, '')
  for (const url of [...urls].slice(0, 30)) {
    try {
      execFileSync('curl', [
        '-sfL',
        '-r',
        '0-0',
        '-o',
        '/dev/null',
        '--max-time',
        '20',
        url,
      ])
    } catch {
      broken.push(url)
    }
  }
  return broken
}

function checkSite({ work }: { work: string }): Verdict {
  const site = path.join(work, 'site')
  const configPath = path.join(site, 'config.json')
  if (
    !fs.existsSync(path.join(site, 'index.html')) ||
    !fs.existsSync(configPath)
  ) {
    return {
      pass: false,
      detail: { site: fs.existsSync(site) ? fs.readdirSync(site) : 'missing' },
    }
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
    assemblies?: unknown[]
    assembly?: unknown
    tracks?: { type?: string }[]
    defaultSession?: unknown
  }
  const text = (x: unknown) => JSON.stringify(x)
  const assemblies = [
    ...(config.assemblies ?? []),
    ...(config.assembly ? [config.assembly] : []),
  ]
  const hg38 = assemblies.some(a => /hg38|GRCh38/i.test(text(a)))
  const tracks = config.tracks ?? []
  const genes = tracks.some(t =>
    /ncbiRefSeq|knownGene|refGene|ensGene|gencode/i.test(text(t)),
  )
  const k562 = tracks.some(t => text(t).includes('k562_h3k27ac.bw'))
  const gm12878 = tracks.some(t => text(t).includes('gm12878_h3k27ac.bw'))
  const ratioTrack = tracks.find(
    t =>
      /\.bw|\.bigwig/i.test(text(t)) &&
      !/k562_h3k27ac\.bw|gm12878_h3k27ac\.bw/.test(text(t)),
  )
  const ratioUri = /"uri":"([^"]+\.(bw|bigwig))"/i.exec(
    text(ratioTrack ?? {}),
  )?.[1]
  const ratioFile =
    ratioUri && !/^https?:/.test(ratioUri)
      ? path.resolve(site, ratioUri)
      : undefined
  const means =
    ratioFile && fs.existsSync(ratioFile)
      ? RATIO_PROBES.map(p => bigWigMean(ratioFile, p))
      : []
  const ratio =
    means.length > 0 &&
    means.every(
      (m, i) => Math.abs(m - RATIO_PROBES[i]!.expect) <= RATIO_PROBES[i]!.tol,
    )
  const atGlobin = /chr11[:"]|"refName":"11"|\b11:5[,.]?[23]/.test(
    text(config.defaultSession ?? ''),
  )
  const broken = brokenFiles(config, site)
  return {
    pass:
      hg38 &&
      genes &&
      k562 &&
      gm12878 &&
      ratio &&
      atGlobin &&
      broken.length === 0,
    detail: {
      hg38,
      genes,
      k562,
      gm12878,
      ratioUri,
      means,
      atGlobin,
      broken: broken.slice(0, 10),
    },
  }
}
const ECOLI_SAKAI = 'NC_002695.2'

TASKS.push(
  {
    name: 'ob-ecoli-synteny',
    outside: true,
    inputs: ['k12.fna.gz', 'sakai.fna.gz'],
    prompt:
      'WORK/k12.fna.gz and WORK/sakai.fna.gz are the genomes of E. coli K-12 MG1655 and O157:H7 Sakai, from NCBI. Compare them in a synteny view.',
    grade: `
      const view = session.views.find(v => v.type === 'LinearSyntenyView')
      if (!view) {
        return { pass: false, detail: session.views.map(v => v.type) }
      }
      const rows = view.views.map(v => {
        const name = v.assemblyNames?.[0]
        const asm = session.assemblyManager.get(name)
        return { name, refNames: asm?.refNames ?? [] }
      })
      const k12 = rows.some(r => r.refNames.includes('${ECOLI_K12}'))
      const sakai = rows.some(r => r.refNames.includes('${ECOLI_SAKAI}'))
      const tracks = view.syntenyTracks().map(t => t.configuration.trackId)
      return { pass: k12 && sakai && tracks.length > 0, detail: { rows, tracks } }`,
  },
  {
    name: 'ob-ecoli-map-reads',
    outside: true,
    inputs: ['k12.fna.gz', 'reads.fastq.gz'],
    prompt:
      'WORK/reads.fastq.gz holds Illumina reads from E. coli K-12 (ENA run ERR022075), and WORK/k12.fna.gz is the K-12 MG1655 genome. Map the reads to the genome and show them at lacZ.',
    grade: `
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView')) {
        const regions = await jb.visibleRegions(v.id)
        const atLacZ = regions.some(r => r.refName === '${ECOLI_K12}' && r.start < 365529 && r.end > 362455 && r.end - r.start < 200000)
        for (const t of v.tracks.filter(t => t.type === 'AlignmentsTrack')) {
          const reads = [...await jb.getFeatures({ trackId: t.configuration.trackId, viewId: v.id, loc: '${ECOLI_K12}:362,456-365,529', byteLimit: 50e6 })].length
          out.push({ atLacZ, track: t.configuration.trackId, reads })
        }
      }
      return { pass: out.some(o => o.atLacZ && o.reads >= 75), detail: out }`,
  },
  {
    name: 'ob-h3k27ac-ratio',
    outside: true,
    inputs: ['k562_h3k27ac.bw', 'gm12878_h3k27ac.bw'],
    prompt:
      'WORK/k562_h3k27ac.bw and WORK/gm12878_h3k27ac.bw are ENCODE H3K27ac fold-change signal on hg38 over the beta-globin locus (ENCFF289IVJ and ENCFF469WVA). Make a bigWig of log2((K562 + 1) / (GM12878 + 1)), save it as WORK/ratio.bw, and show it on hg38 at the beta-globin locus.',
    grade: `
      const probes = ${JSON.stringify(RATIO_PROBES)}
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))) {
        for (const t of v.tracks.filter(t => JSON.stringify(jb.mst.getSnapshot(t.configuration)).includes('ratio.bw'))) {
          const means = []
          for (const p of probes) {
            let sum = 0
            for (const f of await jb.getFeatures({ trackId: t.configuration.trackId, viewId: v.id, loc: p.loc })) {
              const from = Math.max(f.get('start'), p.start)
              const to = Math.min(f.get('end'), p.end)
              if (to > from) {
                sum += (to - from) * f.get('score')
              }
            }
            means.push(Math.round((sum / (p.end - p.start)) * 100) / 100)
          }
          out.push({ track: t.configuration.trackId, means, ok: means.every((m, i) => Math.abs(m - probes[i].expect) <= probes[i].tol) })
        }
      }
      return { pass: out.some(o => o.ok), detail: out }`,
  },
  {
    name: 'ob-brca1-read-count',
    outside: true,
    inputs: ['na12878_brca1.bam', 'na12878_brca1.bam.bai'],
    prompt:
      'WORK/na12878_brca1.bam holds NA12878 reads around BRCA1 from the 1000 Genomes 30x CRAM, on GRCh38. How many primary, non-duplicate reads with mapping quality 30 or more overlap chr17:43,119,000-43,120,000? Reply with the number.',
    grade: `return { pass: /\\b291\\b/.test(answer), detail: { answer: answer.slice(0, 300) } }`,
    solution: `return '291'`,
  },
)

// A JBrowse warning (too much data, an error) fills full-width rows with this
// background, so a figure carrying one shows a track that never drew
const FIGURE_CHECK = `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
w, h = im.size
xs = range(0, w, 10)
banner = sum(1 for y in range(h) if sum(1 for x in xs if im.getpixel((x, y)) == (255, 244, 229)) > 0.6 * len(xs))
ink = sum(1 for y in range(0, h, 10) for x in xs if im.getpixel((x, y)) != (255, 255, 255)) / (len(xs) * len(range(0, h, 10)))
print(w, h, banner, round(ink, 3))
`

function checkFigure({ work }: { work: string }): Verdict {
  const file = path.join(work, 'brca1.png')
  if (!fs.existsSync(file)) {
    return { pass: false, detail: { files: fs.readdirSync(work) } }
  }
  try {
    const [width, height, bannerRows, ink] = execFileSync(
      'python3',
      ['-I', '-c', FIGURE_CHECK, file],
      { encoding: 'utf8' },
    )
      .trim()
      .split(' ')
      .map(Number)
    return {
      pass: width! >= 600 && bannerRows! < 5 && ink! > 0.05,
      detail: { width, height, bannerRows, ink },
    }
  } catch (e) {
    return { pass: false, detail: { unreadable: String(e).slice(0, 200) } }
  }
}

TASKS.push({
  name: 'ob-capture-figure',
  outside: true,
  prompt:
    'Make a PNG figure, WORK/brca1.png, of BRCA1 on hg38 showing RefSeq genes, ClinVar variants and phyloP conservation, with every track fully drawn. The hosted genomes on genomes.jbrowse.org and the @jbrowse/capture CLI (npx @jbrowse/capture) are available.',
  check: checkFigure,
})

TASKS.push({
  name: 'ob-build-site',
  outside: true,
  inputs: ['k562_h3k27ac.bw', 'gm12878_h3k27ac.bw'],
  prompt:
    'Build a standalone JBrowse Web site in WORK/site that I can send a collaborator: hg38 with RefSeq genes, the ENCODE H3K27ac tracks WORK/k562_h3k27ac.bw and WORK/gm12878_h3k27ac.bw, and a log2((K562 + 1) / (GM12878 + 1)) ratio track, opening at the beta-globin locus. Reusing the hosted hg38 genome and annotation configs on genomes.jbrowse.org (https://jbrowse.org/ucsc/hg38/config.json, listed on genomes.jbrowse.org) is fine.',
  check: checkSite,
})

// Frontier tasks: human requests on the hosted hg38 hub that today's agents
// are expected to miss some of the time. Answers come from the data, read live
// by the grader, so a hub update moves the truth and the grader together.
// The chat plugin's answer is its whole reply, narration and tool markers
// included; the result is what follows the last tool call, without the UI's
// Copy and Refresh labels, with small number words as digits
const FINAL = `
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
  const final = (answer.split(/Used tool: \\w+/).at(-1).replace(/\\b(Copy|Refresh)\\s*$/g, '').replace(/\\b(Copy|Refresh)\\s*$/g, '').trim() || answer)
    .replace(new RegExp('\\\\b(' + WORDS.join('|') + ')\\\\b', 'gi'), w => String(WORDS.indexOf(w.toLowerCase())))`
const said = `${FINAL}
  const said = (final.match(/\\d[\\d,]*/g) ?? []).map(n => Number(n.replaceAll(',', '')))`
const LCT_SNP = `
  const snp = (await jb.getFeatures({ trackId: 'hg38-hprc-v2.0-pangenome-vcf', loc: 'chr2:135,851,070-135,851,082', byteLimit: 80e6 }))
    .find(f => f.get('POS') === 135851076 && f.get('REF') === 'G' && f.get('ALT')?.[0] === 'A')
  const gts = Object.values(snp?.get('samples') ?? {}).map(s => (s?.GT ?? []).join())
  const homAlt = gts.filter(g => g === '1|1').length
  const homRef = gts.filter(g => g === '0|0').length`
const NEAR_LCT = `
  const genes = await jb.getFeatures({ trackId: 'hg38-pliByGene', loc: 'chr2:134,851,076-136,851,076', byteLimit: 80e6 })
  const top = Math.max(...genes.map(g => Number(g.get('_pli'))))
  const best = [...new Set(genes.filter(g => Number(g.get('_pli')) === top).map(g => g.get('geneName')))]`
const TP53_PATHOGENIC = `
  const tp53 = (await jb.getFeatures({ trackId: 'hg38-clinvarMain', loc: 'chr17:7,661,779-7,687,546', byteLimit: 80e6 }))
    .filter(f => f.get('clinSign') === 'Pathogenic')
  const spans = (await jb.getFeatures({ trackId: 'hg38-ncbiRefSeq', loc: 'chr17:7,661,779-7,687,546', byteLimit: 80e6 }))
    .filter(g => [g.get('id'), g.get('gene_id'), g.get('name'), g.get('Name')].includes('TP53'))
    .map(t => [t.get('start'), t.get('end')])
  const counts = [...new Set([
    tp53.length,
    tp53.filter(f => String(f.get('geneId')).split(/[,|]/).includes('TP53')).length,
    ...spans.map(([s, e]) => tp53.filter(f => f.get('start') < e && f.get('end') > s).length),
  ])]`
const BRCA1_DEL = `
  const dels = (await jb.getFeatures({ trackId: 'hg38-gnomadStructuralVariants', loc: '${BRCA1_LOC}', byteLimit: 80e6 }))
    .filter(f => f.get('svtype') === 'DEL' && f.get('FILTER') === 'PASS')
  const longest = dels.reduce((a, f) => (Number(f.get('svlen')) > Number(a?.get('svlen') ?? 0) ? f : a), undefined)
  const truth = [Number(longest?.get('svlen')), longest ? longest.get('end') - longest.get('start') : NaN]`
const PATIENT_SVS =
  'https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20210124.SV_Illumina_Integration/1KGP_3202.gatksv_svtools_novelins.freeze_V3.wAF.vcf.gz'
const RS80357906 = 43057062

TASKS.push(
  {
    name: 'fr-lct-homozygous-hprc',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      'In hg38, how many HPRC pangenome samples are homozygous for the lactase-persistence allele at rs4988235? Reply with the number.',
    solution: `${LCT_SNP}
      return String(homAlt)`,
    grade: `${LCT_SNP}
      ${said}
      const sentences = final.split(/(?<=[.!?\\n])\\s*/).filter(t => /homozygous|1\\|1/i.test(t) && !/reference|0\\|0/i.test(t))
      const stated = sentences.some(t => new RegExp('(^|[^\\\\d,])' + homAlt + '(?![\\\\d,])').test(t)) || final.split(/\\s+/).at(-1) === String(homAlt)
      return { pass: homAlt > 0 && said.includes(homAlt) && stated, detail: { homAlt, homRef, n: gts.length, said, sentences: sentences.slice(0, 4) } }`,
  },
  {
    name: 'fr-pli-near-lct',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      'In hg38, which gene within 1 Mb of rs4988235 is the most intolerant of loss-of-function variants by gnomAD pLI? Reply with the gene symbol.',
    solution: `${NEAR_LCT}
      return best[0]`,
    grade: `${NEAR_LCT}
      ${FINAL}
      const names = [...new Set(genes.map(g => String(g.get('geneName'))))].filter(n => /^[\\w.-]+$/.test(n))
      const firstIn = t => names.map(n => ({ n, i: t.search(new RegExp('\\\\b' + n + '\\\\b')) })).filter(m => m.i >= 0).sort((a, b) => a.i - b.i)[0]?.n
      const claim = final.split(/(?<=[.!?\\n])\\s*/).find(t => firstIn(t) && (/pLI|most|highest|intolerant|answer/i.test(t) || t.trim().split(/\\s+/).length <= 4))
      const first = claim ? firstIn(claim) : firstIn(final)
      return { pass: best.includes(first), detail: { best, top, first, final: final.slice(0, 300) } }`,
  },
  {
    name: 'fr-tp53-pathogenic-count',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      'In hg38, how many ClinVar variants in TP53 are classified Pathogenic, leaving out Likely pathogenic and conflicting classifications? Reply with the number.',
    solution: `${TP53_PATHOGENIC}
      return String(counts[0])`,
    grade: `${TP53_PATHOGENIC}
      ${said}
      return { pass: counts[0] > 0 && counts.some(c => said.includes(c)), detail: { counts, spans, said } }`,
  },
  {
    name: 'fr-brca1-longest-deletion',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      'In hg38, what is the longest deletion in gnomAD structural variants that passed all filters and overlaps BRCA1? Reply with its length in base pairs.',
    solution: `${BRCA1_DEL}
      return String(truth[0])`,
    grade: `${BRCA1_DEL}
      ${said}
      return { pass: truth.some(t => t > 0 && said.includes(t)), detail: { truth, name: longest?.get('name'), said } }`,
  },
  {
    name: 'fr-brca1-wrong-chromosome',
    tutorial: true,
    config: HG38_HUB,
    prompt: 'In hg38, take me to BRCA1 on chromosome 13.',
    solution: `${lgv(BRCA1_LOC, []).replace('return ', 'await ')}
      return 'BRCA1 is on chromosome 17, not 13, so I opened it at chr17:43,044,295-43,125,483.'`,
    grade: `${BRCA1}
      const corrects = /\\b(chr|chromosome )17\\b/i.test(answer)
      return { pass: !!view && corrects, detail: { regions, answer: answer.slice(0, 300) } }`,
  },
  {
    name: 'fr-brca1-variants-drawn',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      'In hg38, show ClinVar and common dbSNP variants across BRCA1 and 500 kb either side, with every track actually drawn.',
    solution: `${lgv('chr17:42,544,295-43,625,483', ['hg38-clinvarMain', 'hg38-dbSnp155Common']).replace('return ', 'await ')}
      await jb.trackModel('hg38-clinvarMain').applyDisplaySettings({ forceLoad: true })
      await jb.trackModel('hg38-dbSnp155Common').applyDisplaySettings({ forceLoad: true })
      return jb.waitReady(120000)`,
    grade: `
      const w = await jb.waitReady(60000).catch(() => ({}))
      const undrawn = (w.notReady ?? []).map(t => t.trackId)
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))) {
        const rs = await jb.visibleRegions(v.id)
        const wide = rs.some(r => r.refName.replace(/^chr/, '') === '17' && r.start <= 42644295 && r.end >= 43525483)
        const ids = v.tracks.map(t => t.configuration.trackId)
        const want = ids.filter(i => i === 'hg38-clinvarMain' || /^hg38-dbSnp\\d+Common$/.test(i))
        out.push({ wide, ids, drawn: want.filter(i => !undrawn.includes(i)) })
      }
      return { pass: out.some(o => o.wide && o.drawn.includes('hg38-clinvarMain') && o.drawn.some(i => /dbSnp/.test(i))), detail: { out, undrawn } }`,
  },
  {
    name: 'fr-repair-broken-index',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      "The 'Patient SVs' track at BRCA1 shows an error. Fix that track so it shows its variants.",
    setup: `${lgv(BRCA1_LOC, []).replace('return ', 'await ')}
      jb.session.addTrackConf({ type: 'VariantTrack', trackId: 'patient-svs', name: 'Patient SVs', assemblyNames: ['hg38'], adapter: { type: 'VcfTabixAdapter', vcfGzLocation: { uri: '${PATIENT_SVS}', locationType: 'UriLocation' }, index: { location: { uri: '${PATIENT_SVS}.tbi.bak', locationType: 'UriLocation' } } } })
      jb.view().showTrack('patient-svs')
      return jb.waitReady(60000).catch(e => String(e))`,
    solution: `
      jb.view().hideTrack('patient-svs')
      jb.session.addTrackConf({ type: 'VariantTrack', trackId: 'patient-svs-fixed', name: 'Patient SVs', assemblyNames: ['hg38'], adapter: { type: 'VcfTabixAdapter', vcfGzLocation: { uri: '${PATIENT_SVS}', locationType: 'UriLocation' }, index: { location: { uri: '${PATIENT_SVS}.tbi', locationType: 'UriLocation' } } } })
      jb.view().showTrack('patient-svs-fixed')
      return jb.waitReady(60000)`,
    grade: `
      await jb.waitReady(60000).catch(() => undefined)
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView')) {
        for (const t of v.tracks.filter(t => t.configuration.name === 'Patient SVs')) {
          const id = t.configuration.trackId
          let n = 0
          let err = String(t.activeDisplay.error ?? '')
          try {
            n = (await jb.getFeatures({ trackId: id, viewId: v.id, loc: '${BRCA1_LOC}', byteLimit: 80e6 })).length
          } catch (e) {
            err ||= String(e).slice(0, 200)
          }
          out.push({ id, n, err })
        }
      }
      return { pass: out.length > 0 && out.every(o => !o.err) && out.some(o => o.n > 0), detail: out }`,
  },
  {
    name: 'fr-brca1-founder-codon',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      "In hg38, zoom to base level on BRCA1's 5382insC founder variant (rs80357906) and show the amino-acid translation of the strand BRCA1 is read from.",
    solution: `${lgv('chr17:43,057,000-43,057,120', ['hg38-refseq']).replace('return ', 'await ')}
      return jb.trackModel('hg38-refseq').applyDisplaySettings({ showReverse: true, showTranslation: true })`,
    grade: `
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))) {
        const rs = await jb.visibleRegions(v.id)
        const at = rs.some(r => r.refName.replace(/^chr/, '') === '17' && r.start < ${RS80357906} && r.end >= ${RS80357906} && r.end - r.start <= 500)
        for (const t of v.tracks.filter(t => t.type === 'ReferenceSequenceTrack')) {
          const d = t.activeDisplay
          out.push({ at, span: rs.map(r => r.end - r.start), reverse: d.showReverse, translation: d.showTranslation })
        }
        if (!v.tracks.some(t => t.type === 'ReferenceSequenceTrack')) {
          out.push({ at, span: rs.map(r => r.end - r.start), sequence: false })
        }
      }
      return { pass: out.some(o => o.at && o.reverse === true && o.translation === true), detail: out }`,
  },
)

for (const name of [
  'fr-brca1-wrong-chromosome',
  'fr-brca1-variants-drawn',
  'fr-repair-broken-index',
  'fr-brca1-founder-codon',
]) {
  TASKS.find(t => t.name === name)!.draws = '.'
}

// Tutorial reach tasks on each tutorial's own hosted config. Every grader
// reads the figure the tutorial shows and fails a track that did not draw.
const drew = `const drew = d => !!d && !d.error && !d.renderError && (d.displayPhase === undefined || d.displayPhase === 'ready')`
const GRAPE = 'GCF_030704535.1'
const PEACH = 'GCF_000346465.2'
const CACAO = 'GCF_000208745.1'
const TREE_ORDER = [
  'panTro6',
  'gorGor6',
  'ponAbe3',
  'rheMac10',
  'calJac4',
  'mm39',
  'canFam6',
  'bosTau9',
]
const DER3_PANELS = [
  ['3', 25359111, 25359568],
  ['10', 58717464, 58717662],
  ['12', 72273112, 72273294],
]
const tumorPanel = (loc: string) => ({
  assembly: 'hg38',
  loc,
  tracks: [
    {
      trackId: 'COLO829_tumor_ont',
      forceLoad: true,
      height: 200,
    },
  ],
})

TASKS.push(
  {
    name: 'tut-multiway-grape-peach-cacao',
    tutorial: true,
    draws: '.',
    config: 'https://jbrowse.org/demos/grape_peach_cacao/config.json',
    prompt:
      "Reproduce the multi-way synteny tutorial's conserved block: peach stacked over grape over cacao in one synteny view, at peach chrG7:18,565,100-18,700,100, grape chr11:787,000-914,000 and cacao chr9:3,898,700-4,003,700, ribbons colored by syntenic depth.",
    solution: `return jb.loadSessionSpec({ views: [{ type: 'LinearSyntenyView', tracks: ['grape_peach_cacao_blocks'], color: { field: 'syntenicDepth' }, encoding: { color: { field: 'syntenicDepth' } }, views: [
      { assembly: '${PEACH}', loc: 'chrG7:18,565,100-18,700,100', tracks: ['${PEACH}-ncbiRefSeq'] },
      { assembly: '${GRAPE}', loc: 'chr11:787,000-914,000', tracks: ['${GRAPE}-ncbiRefSeq'] },
      { assembly: '${CACAO}', loc: 'chr9:3,898,700-4,003,700', tracks: ['${CACAO}-ncbiRefSeq'] } ] }] }, 120000)`,
    grade: `${SYNTENY_STACK}
      const order = rows.map(r => r.assembly).join() === ['${PEACH}', '${GRAPE}', '${CACAO}'].join()
      const loci = at(rows[0], 'G7', 18565100, 18700100, 400000) && at(rows[1], '11', 787000, 914000, 400000) && at(rows[2], '9', 3898700, 4003700, 400000)
      const field = view?.colorSetting?.field
      return { pass: order && loci && linked.length === 2 && linked.every(Boolean) && field === 'syntenicDepth', detail: { rows, linked, field } }`,
  },
  {
    name: 'tut-multiway-hg38-tp53',
    tutorial: true,
    draws: '.',
    config: 'https://jbrowse.org/demos/hg38_vertebrates/config.json',
    prompt:
      'As in the hg38 vertebrates synteny tutorial, show TP53 on hg38 with the liftOver chains drawn as one lane per genome beneath it, stacked down the tree: chimp, gorilla, orangutan, macaque, marmoset, mouse, dog, then cow.',
    solution: `await jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr17:7,400,000-7,700,000', tracks: ['hg38-ncbiRefSeq', { trackId: 'hg38_liftover_multiway', type: 'MultiWaySyntenyDisplay', height: 600 }] }] }, 180000)
      ${either("jb.trackModel('hg38_liftover_multiway')", { rows: { domain: TREE_ORDER } }, { rows: { sort: TREE_ORDER } }).replace('  return r0.applied', '  const r = r0.applied')}
      await jb.waitReady(60000)
      return r`,
    grade: `${atLocus('17', 7668402, 7687550, 3000000)}
      ${drew}
      const want = ${JSON.stringify(TREE_ORDER)}
      const out = (view?.tracks ?? []).filter(t => t.activeDisplay?.type === 'MultiWaySyntenyDisplay').map(t => {
        const d = t.activeDisplay
        const lanes = (d.laneStack?.lanes ?? []).filter(l => !l.isAnchor)
        return { id: t.configuration.trackId, lanes: lanes.map(l => l.assemblyName), placed: lanes.filter(l => l.frame).length, painted: d.painted === true, drew: drew(d) }
      })
      return { pass: out.some(o => o.lanes.join() === want.join() && o.placed >= 7 && o.painted && o.drew), detail: { regions, ids, out } }`,
  },
  {
    name: 'tut-hic-bcr-abl1',
    tutorial: true,
    draws: '.',
    config: 'https://jbrowse.org/code/jb2/main/test_data/config_demo.json',
    prompt:
      "Reproduce the Hi-C tutorial's BCR-ABL1 figure: one hg38 view with a window on ABL1 (chr9) beside a window on BCR (chr22), showing K562 Hi-C and GM12878 Hi-C as the control, both as raw counts with no normalization.",
    solution: `return jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr9:129,730,000-131,730,000 chr22:22,285,000-24,285,000', tracks: [{ trackId: 'hic_gm12878_insitu', selectedNormalization: 'NONE' }, { trackId: 'hic_k562_insitu', selectedNormalization: 'NONE' }] }] }, 240000)`,
    grade: `
      ${drew}
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))) {
        const rs = await jb.visibleRegions(v.id)
        const hit = (chrom, from, to) => rs.some(r => r.refName.replace(/^chr/, '') === chrom && r.start < to && r.end > from && r.end - r.start < 10000000)
        const hic = v.tracks.filter(t => t.type === 'HicTrack').map(t => {
          const d = t.activeDisplay
          const text = String(t.configuration.name) + JSON.stringify(jb.mst.getSnapshot(t.configuration).adapter ?? {})
          let norm
          try { norm = d.activeNormalization ?? jb.readConfObject(d.configuration, 'selectedNormalization') } catch {}
          return { id: t.configuration.trackId, k562: /K562|ENCFF080DPJ/i.test(text), gm12878: /GM12878/i.test(text), norm, drew: drew(d) }
        })
        const good = hic.filter(h => h.norm === 'NONE' && h.drew)
        out.push({ abl1: hit('9', 130713881, 130887675), bcr: hit('22', 23180509, 23318037), hic, ok: good.some(h => h.k562) && good.some(h => h.gm12878 && !h.k562) })
      }
      return { pass: out.some(o => o.abl1 && o.bcr && o.ok), detail: out }`,
  },
  {
    name: 'tut-cancer-sv-der3-chain',
    tutorial: true,
    draws: '.',
    config: 'https://jbrowse.org/demos/cancer_sv/config.json',
    prompt:
      "As in the cancer SV tutorial, follow COLO829's der(3) rearrangement chain through chr3, chr10 and chr12 in a breakpoint split view, one panel per breakpoint, with the tumor reads drawn in every panel and their soft clipping shown.",
    solution: `await jb.loadSessionSpec({ views: [{ type: 'BreakpointSplitView', views: ${JSON.stringify(
      [
        'chr3:25,357,000-25,362,000',
        'chr10:58,715,000-58,720,000',
        'chr12:72,270,700-72,275,700',
      ].map(tumorPanel),
    )} }] }, 300000)
      for (const p of jb.session.views[0].views) {
        await (async () => {${either("jb.trackModel('COLO829_tumor_ont', p.id)", { pileup: { showSoftClipping: true, readHeight: 2 } }, { pileup: { softClips: { show: true } } })}
        })()
      }
      return jb.waitReady(120000)`,
    grade: `
      ${drew}
      const want = ${JSON.stringify(DER3_PANELS)}
      const out = []
      for (const v of session.views.filter(v => v.type === 'BreakpointSplitView')) {
        const panels = []
        for (const p of v.views) {
          const rs = await jb.visibleRegions(p.id)
          const tumor = p.tracks.filter(t => /COLO829_tumor|COLO829_tumor\\.ht\\.cram/.test(JSON.stringify(jb.mst.getSnapshot(t.configuration)))).map(t => {
            const c = t.activeDisplay.configuration
            const slot = path => { try { return jb.readConfObject(c, path) } catch { return undefined } }
            return { drew: drew(t.activeDisplay), clips: slot(['pileup', 'showSoftClipping']) === true || slot(['pileup', 'softClips', 'show']) === true }
          })
          panels.push({ rs: rs.map(r => r.refName + ':' + r.start + '-' + r.end), ok: tumor.some(t => t.drew && t.clips), rsRaw: rs })
        }
        const covered = want.map(([chrom, from, to]) => panels.some(p => p.ok && p.rsRaw.some(r => r.refName.replace(/^chr/, '') === chrom && r.start < to && r.end > from && r.end - r.start < 100000)))
        out.push({ panels: panels.map(({ rsRaw, ...p }) => p), covered })
      }
      return { pass: out.some(o => o.covered.every(Boolean)), detail: out }`,
  },
)

// Hard tasks: several sources joined, a step where the naive path answers
// wrong, a second assembly, or a figure with many graded constraints. Each
// grader reads its truth live from the hub.
const HPRC_DEMO = 'https://jbrowse.org/demos/hprc/config.json'
const sentences = `${FINAL}
  const sentences = final.split(/(?<=[.!?\\n])\\s*/)`
const TP53_EXONS = `
  const tx = (await jb.getFeatures({ trackId: 'hg38-mane', loc: 'chr17:7,661,779-7,690,000', byteLimit: 80e6 })).find(g => g.get('name') === 'TP53')?.get('subfeatures')?.[0]
  const parts = (tx?.get('subfeatures') ?? []).map(s => [s.get('start'), s.get('end')]).sort((a, b) => a[0] - b[0])
  const exons = []
  for (const [s, e] of parts) {
    const last = exons.at(-1)
    if (last && last[1] === s) { last[1] = e } else { exons.push([s, e]) }
  }
  if (tx?.get('strand') === -1) { exons.reverse() }
  const pathogenic = (await jb.getFeatures({ trackId: 'hg38-clinvarMain', loc: 'chr17:7,661,779-7,690,000', byteLimit: 80e6 })).filter(f => f.get('clinSign') === 'Pathogenic')
  const counts = exons.map(([s, e]) => pathogenic.filter(f => f.get('start') >= s && f.get('end') <= e).length)
  const top = Math.max(...counts)
  const best = counts.flatMap((c, i) => (c === top ? [i + 1] : []))`
// The A of TP53's ATG on hg38, then the same base on hs1, found as the one
// exact match of its 51 bp context near where the liftOver chain puts it
const TP53_ATG_HS1 = `
  const refTrack = a => jb.session.assemblyManager.get(a).configuration.sequence.trackId
  const tx = (await jb.getFeatures({ trackId: 'hg38-mane', loc: 'chr17:7,661,779-7,690,000', byteLimit: 80e6 })).find(g => g.get('name') === 'TP53')?.get('subfeatures')?.[0]
  const cds = (tx?.get('subfeatures') ?? []).filter(s => s.get('type') === 'CDS')
  const atg = tx?.get('strand') === -1 ? Math.max(...cds.map(s => s.get('end'))) : Math.min(...cds.map(s => s.get('start'))) + 1
  const ctx = (await jb.getFeatures({ trackId: refTrack('hg38'), loc: 'chr17:' + (atg - 25) + '-' + (atg + 25), assembly: 'hg38' }))[0].get('seq').toUpperCase()
  const chain = (await jb.getFeatures({ trackId: 'hg38_to_hs1_liftOver', loc: 'chr17:' + atg + '-' + (atg + 1), assembly: 'hg38', byteLimit: 80e6 }))[0]
  const guess = chain.get('mate').start + (atg - chain.get('start'))
  const from = Math.max(1, guess - 300000)
  const win = (await jb.getFeatures({ trackId: refTrack('hs1'), loc: 'chr17:' + from + '-' + (guess + 300000), assembly: 'hs1' }))[0].get('seq').toUpperCase()
  const hits = []
  for (let i = win.indexOf(ctx); i >= 0; i = win.indexOf(ctx, i + 1)) { hits.push(from + i + 25) }
  const hs1 = hits.length === 1 ? hits[0] : NaN`
const CFTR_SPAN = [117480024, 117668665]
const F508DEL = 117559592
const SARS_REF = 'https://jbrowse.org/ucsc/wuhCor1/config.json'
const CHIMP_T2T =
  'https://jbrowse.org/hubs/genark/GCF/028/858/775/GCF_028858775.2/'
// Adds an assembly and some of its tracks from another hub's config.json to
// the open session, its relative uris resolved against that config
const importHub = (base: string, file: string, tracks: string) => `
  const base = '${base}'
  const conf = await (await fetch(base + '${file}')).json()
  const abs = o => JSON.parse(JSON.stringify(o), (k, v) => ((k === 'uri' || k === 'chromSizes') && typeof v === 'string' && !/^https?:/.test(v) ? new URL(v, base).href : v))
  const asm = abs(conf.assemblies[0])
  jb.session.addAssemblyConf(asm)
  for (const t of conf.tracks.filter(t => ${tracks}.test(t.trackId))) { jb.session.addTrackConf(abs(t)) }
  await jb.session.assemblyManager.waitForAssembly(asm.name)`
// HG00133's KIV-2 copies per haplotype: an allele's copies are the RUC of
// its RN runs, which RUC lists allele after allele
const KIV2 = `
  const kiv2 = (await jb.getFeatures({ trackId: 'hprc_kiv2_copies_all', loc: 'chr6:160,610,000-160,652,000', byteLimit: 80e6 }))[0]
  const info = kiv2.get('INFO')
  const ends = info.RN.reduce((a, n) => [...a, a.at(-1) + n], [0])
  const copies = String(kiv2.get('samples').HG00133.GT).split(/[|/]/).filter(a => a !== '.' && a !== '0').map(a => info.RUC.slice(ends[a - 1], ends[a]).reduce((n, x) => n + Number(x), 0))`
const marksOf = `const marksOf = d => { try { return jb.readConfObject(d.configuration, 'marks') ?? [] } catch { return [] } }
  const markType = m => (typeof m.mark === 'string' ? m.mark : m.mark?.type) ?? 'bar'
  const field = c => (typeof c === 'string' ? c : c?.field ?? c?.value ?? '')`

TASKS.push(
  {
    name: 'fx-tp53-exon-hotspot',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      "In hg38, which exon of TP53's MANE Select transcript, numbered from the transcript's 5' end, holds the most ClinVar variants classified Pathogenic (leaving out Likely pathogenic and conflicting), counting variants that lie wholly inside the exon? Reply with the exon number.",
    solution: `${TP53_EXONS}
      return 'Exon ' + best[0] + ' has the most, with ' + top + ' Pathogenic variants.'`,
    grade: `${TP53_EXONS}
      ${sentences}
      const claims = sentences.filter(t => /\\bexon\\s*\\d+/i.test(t) && /most|highest|largest|greatest|top|densest|answer/i.test(t))
      const lastClaim = claims.at(-1)?.match(/\\bexon\\s*(\\d+)/i)?.[1]
      const bare = final.trim().match(/(\\d+)\\D*$/)?.[1]
      const claimed = Number(lastClaim ?? bare)
      return { pass: top > 0 && best.includes(claimed), detail: { counts, best, claimed, claim: lastClaim && claims.at(-1).slice(0, 200) } }`,
  },
  {
    name: 'fx-tp53-atg-hs1',
    tutorial: true,
    config: ALL_HUB,
    prompt:
      "Where is the first base (the A) of TP53's start codon, from its MANE Select transcript on hg38, in the T2T-CHM13 assembly (hs1)? Reply with the hs1 position as a 1-based chr:position.",
    solution: `${TP53_ATG_HS1}
      return 'On hs1 the A of the TP53 ATG is at chr17:' + hs1.toLocaleString('en-US') + '.'`,
    grade: `${TP53_ATG_HS1}
      ${FINAL}
      const near = (final.match(/\\d[\\d,]*/g) ?? []).map(n => Number(n.replaceAll(',', ''))).filter(n => Math.abs(n - hs1) <= 50000)
      return { pass: Number.isFinite(hs1) && near.at(-1) === hs1, detail: { atg, hs1, guess, hits, near } }`,
  },
  {
    name: 'fx-cftr-three-panel',
    tutorial: true,
    draws: '.',
    config: ALL_HUB,
    prompt:
      'In hg38, build a three-part figure of CFTR: (1) a view of the whole CFTR gene with MANE transcripts, ClinVar variants and phyloP 100-way conservation, its scale fixed from -2 to 5; (2) a second view under 100 bp wide on the F508del deletion (rs113993960), with the reference sequence translated in the direction CFTR is read; (3) a synteny view of the human CFTR locus over mouse Cftr. Every track must actually draw.',
    solution: `
      await jb.loadSessionSpec({ views: [
        { type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr7:117,470,000-117,680,000', tracks: ['hg38-mane', 'hg38-clinvarMain', 'hg38-phyloP100way'] },
        { type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr7:117,559,560-117,559,620', tracks: ['hg38-mane'] },
        { type: 'LinearSyntenyView', tracks: ['hg38_to_mm39_liftOver'], views: [
          { assembly: 'hg38', loc: 'chr7:117,400,000-117,750,000', tracks: [] },
          { assembly: 'mm39', loc: 'chr6:18,100,000-18,400,000', tracks: [] } ] } ] }, 120000)
      const [whole, zoom] = jb.session.views
      const t = (id, v) => jb.trackModel(id, v.id)
      await t('hg38-clinvarMain', whole).applyDisplaySettings({ forceLoad: true })
      const phylo = t('hg38-phyloP100way', whole)
      const r = await phylo.applyDisplaySettings({ encoding: { y: { scale: { domainMin: -2, domainMax: 5 } } } })
      if (!r.applied.includes('encoding')) { await phylo.applyDisplaySettings({ scales: { y: { domainMin: -2, domainMax: 5 } } }) }
      await zoom.launchTrack(jb.session.assemblyManager.get('hg38').configuration.sequence.trackId, {}, { showTranslation: true, showForward: true, showReverse: false })
      return jb.waitReady(120000)`,
    grade: `${SYNTENY_STACK}
      const seqId = jb.session.assemblyManager.get('hg38').configuration.sequence.trackId
      const lgvs = session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))
      const out = []
      for (const v of lgvs) {
        const rs = (await jb.visibleRegions(v.id)).filter(r => r.refName.replace(/^chr/, '') === '7')
        const span = rs.reduce((n, r) => n + r.end - r.start, 0)
        const ids = v.tracks.map(t => t.configuration.trackId)
        const phylo = v.tracks.find(t => t.configuration.trackId === 'hg38-phyloP100way')?.activeDisplay
        const domain = phylo?.domain
        const seq = v.tracks.find(t => t.configuration.trackId === seqId)?.activeDisplay
        out.push({
          whole: rs.some(r => r.start <= ${CFTR_SPAN[0]} && r.end >= ${CFTR_SPAN[1]}) && span < 1500000 && ids.includes('hg38-mane') && ids.includes('hg38-clinvarMain') && domain?.[0] === -2 && domain?.[1] === 5,
          zoom: rs.some(r => r.start < ${F508DEL} && r.end > ${F508DEL}) && span <= 100 && seq?.showTranslation === true && seq?.showForward !== false,
          span, ids, domain, translation: seq && [seq.showForward, seq.showReverse, seq.showTranslation],
        })
      }
      const human = rows.findIndex(r => r.assembly === 'hg38')
      const mouse = rows.findIndex(r => r.assembly === 'mm39')
      const synteny = human >= 0 && mouse >= 0 && Math.abs(human - mouse) === 1 && linked[Math.min(human, mouse)] === true && at(rows[human], '7', ${CFTR_SPAN[0]}, ${CFTR_SPAN[1]}, 5000000) && at(rows[mouse], '6', 18170000, 18320000, 5000000)
      return { pass: out.some(o => o.whole) && out.some(o => o.zoom) && synteny, detail: { out, rows, linked } }`,
  },
  {
    name: 'fx-lct-figure',
    tutorial: true,
    draws: '.',
    config: HG38_HUB,
    prompt:
      'In hg38, make one view of the lactase-persistence enhancer, rs4988235 with about 1 kb either side, styled as a figure: the HPRC pangenome genotypes as a matrix with one row per haplotype, phyloP 100-way conservation as a line plot fixed from -4 to 8, RefSeq curated genes squeezed into compact rows, and ClinVar showing only variants classified Pathogenic. Every track must actually draw.',
    solution: `
      await jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr2:135,850,076-135,852,076', tracks: ['hg38-phyloP100way', 'hg38-ncbiRefSeqCurated', 'hg38-clinvarMain'] }] }, 90000)
      await jb.view().launchTrack('hg38-hprc-v2.0-pangenome-vcf', {}, { type: 'LinearMultiSampleVariantDisplay', unit: 'haplotype' })
      const phylo = jb.trackModel('hg38-phyloP100way')
      const r = await phylo.applyDisplaySettings({ mark: 'line', encoding: { y: { scale: { domainMin: -4, domainMax: 8 } } } })
      if (!r.applied.includes('encoding')) { await phylo.applyDisplaySettings({ scales: { y: { domainMin: -4, domainMax: 8 } } }) }
      await jb.trackModel('hg38-ncbiRefSeqCurated').applyDisplaySettings({ displayMode: 'compact' })
      await jb.trackModel('hg38-clinvarMain').applyDisplaySettings({ filter: ["jexl:get(feature,'clinSign') == 'Pathogenic'"] })
      return jb.waitReady(120000)`,
    grade: `
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))) {
        const rs = await jb.visibleRegions(v.id)
        const at = rs.some(r => r.refName.replace(/^chr/, '') === '2' && r.start < 135851076 && r.end >= 135851076 && r.end - r.start >= 1000 && r.end - r.start <= 5000)
        const d = id => v.tracks.find(t => t.configuration.trackId === id)?.activeDisplay
        const hprc = d('hg38-hprc-v2.0-pangenome-vcf')
        const phylo = d('hg38-phyloP100way')
        const mark = phylo?.plot?.mark
        const genes = d('hg38-ncbiRefSeqCurated')
        const filters = JSON.stringify(d('hg38-clinvarMain')?.plot?.filter ?? '')
        const checks = {
          at,
          haplotypes: hprc?.type === 'LinearMultiSampleVariantDisplay' && hprc.unit === 'haplotype' && (hprc.sources ?? []).some(s => s.HP === 1),
          line: (typeof mark === 'string' ? mark : mark?.type) === 'line' && phylo?.domain?.[0] === -4 && phylo?.domain?.[1] === 8,
          compact: genes?.displayMode === 'compact',
          pathogenic: /clinSign|_clinSignCode|aggrGermClass/.test(filters) && /Pathogenic|PATH|\\bP\\b/.test(filters),
        }
        out.push({ checks, mark, domain: phylo?.domain, filters: filters.slice(0, 200) })
      }
      return { pass: out.some(o => Object.values(o.checks).every(Boolean)), detail: out }`,
  },
  {
    name: 'fx-kiv2-walk-rows',
    tutorial: true,
    draws: '.',
    config: HPRC_DEMO,
    prompt:
      "On this HPRC pangenome site, show the LPA KIV-2 array on hg38 with the HPRC v2.1 walks graph track laid out as one bar per haplotype walk, showing only HG00133's haplotypes, and tell me how many KIV-2 copies, KIV-2A and KIV-2B together, each of HG00133's two haplotypes carries.",
    solution: `
      await jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr6:160,610,000-160,652,000', tracks: ['hprc_v2_1_walks'] }] }, 120000)
      await jb.trackModel('hprc_v2_1_walks').applyDisplaySettings({ layoutMode: 'walkrows', rows: { kept: ['HG00133'] } })
      await jb.waitReady(120000)
      ${KIV2}
      return "HG00133's haplotypes carry " + copies.join(' and ') + ' KIV-2 copies.'`,
    grade: `${KIV2}
      ${said}
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))) {
        const rs = await jb.visibleRegions(v.id)
        const at = rs.some(r => r.refName.replace(/^chr/, '') === '6' && r.start < 160646753 && r.end > 160616002 && r.end - r.start < 1000000)
        for (const t of v.tracks.filter(t => t.type === 'GraphTrack')) {
          const d = t.activeDisplay
          const samples = [...(d.walkRowSamples ?? [])]
          out.push({ at, id: t.configuration.trackId, mode: d.chosenLayoutMode, samples, ok: at && d.chosenLayoutMode === 'walkrows' && samples.length > 0 && samples.every(s => /^HG00133\\b/.test(s)) && !d.error })
        }
      }
      return { pass: copies.length === 2 && copies.every(c => said.includes(c)) && out.some(o => o.ok), detail: { copies, said, out } }`,
  },
  {
    name: 'fx-clinvar-lollipop',
    tutorial: true,
    draws: '.',
    config: HG38_HUB,
    prompt:
      'In hg38 at BRCA1, draw ClinVar as a lollipop plot: each variant a dot whose height is its review-status star count and whose color is its clinical significance, standing on a thin stem from the baseline.',
    solution: `
      await jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly: 'hg38', loc: '${BRCA1_LOC}', tracks: [] }] }, 90000)
      await jb.view().launchTrack('hg38-clinvarMain', {}, { type: 'LinearMarkDisplay', forceLoad: true, marks: [
        { mark: 'bar', encoding: { y: '_starCount', color: { value: '#999' } } },
        { mark: 'point', encoding: { y: '_starCount', color: { field: 'clinSign' }, size: 6 } } ] })
      await jb.trackModel('hg38-clinvarMain').applyDisplaySettings({ forceLoad: true })
      return jb.waitReady(120000)`,
    grade: `${BRCA1}
      ${marksOf}
      const stars = y => /_starCount|reviewStatus|stars?/i.test(String(y))
      const out = (view?.tracks ?? []).filter(t => t.configuration.trackId === 'hg38-clinvarMain' || /clinvarMain/.test(JSON.stringify(jb.mst.getSnapshot(t.configuration).adapter ?? ''))).map(t => {
        const d = t.activeDisplay
        const marks = marksOf(d)
        const dot = marks.some(m => markType(m) === 'point' && stars(field(m.encoding?.y)) && /clinSign|_clinSignCode|aggrGermClass|signif/i.test(JSON.stringify(m.encoding?.color ?? '')))
        const stem = marks.some(m => ['bar', 'rule'].includes(markType(m)) && stars(field(m.encoding?.y)))
        const errors = (d.notices ?? []).filter(n => n.level === 'error')
        return { id: t.configuration.trackId, type: d.type, dot, stem, errors, marks: JSON.stringify(marks).slice(0, 400) }
      })
      return { pass: !!view && out.some(o => o.type === 'LinearMarkDisplay' && o.dot && o.stem && !o.errors.length), detail: { regions, out } }`,
  },
  {
    name: 'fx-gnomad-sv-density',
    tutorial: true,
    draws: '.',
    config: HG38_HUB,
    prompt:
      'In hg38, across the whole of chromosome 17, plot how many gnomAD structural variants that passed all filters start in each 1 Mb window, as bars, with a separate panel for each SV type.',
    solution: `
      await jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr17', tracks: [] }] }, 90000)
      await jb.view().launchTrack('hg38-gnomadStructuralVariants', {}, { type: 'LinearMarkDisplay', facet: 'svtype', transform: [{ type: 'filter', expr: "jexl:feature.FILTER == 'PASS'" }], marks: [
        { mark: 'bar', transform: [{ type: 'bin', step: 1000000 }, { type: 'aggregate', ops: [{ op: 'count' }] }], encoding: { y: 'count' } } ] })
      await jb.trackModel('hg38-gnomadStructuralVariants').applyDisplaySettings({ forceLoad: true })
      return jb.waitReady(240000)`,
    grade: `
      ${marksOf}
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))) {
        const rs = (await jb.visibleRegions(v.id)).filter(r => r.refName.replace(/^chr/, '') === '17')
        const whole = rs.reduce((n, r) => n + r.end - r.start, 0) >= 0.9 * 83257441
        for (const t of v.tracks.filter(t => /gnomadStructuralVariants/.test(t.configuration.trackId + JSON.stringify(jb.mst.getSnapshot(t.configuration).adapter ?? '')))) {
          const d = t.activeDisplay
          let facet, transform
          try { facet = jb.readConfObject(d.configuration, 'facet'); transform = jb.readConfObject(d.configuration, 'transform') } catch {}
          const marks = marksOf(d)
          const steps = [...(transform ?? []), ...marks.flatMap(m => m.transform ?? [])]
          const pass = JSON.stringify([...steps, ...marks.map(m => m.encoding ?? {}), facet]).match(/FILTER[^"]*PASS|PASS[^"]*FILTER/) !== null
          const bin = steps.some(s => s.type === 'bin' && Number(s.step) === 1000000)
          const count = steps.some(s => s.type === 'aggregate' && (s.ops ?? [{}]).some(o => (o.op ?? 'count') === 'count'))
          const bars = marks.some(m => markType(m) === 'bar')
          const byType = /svtype|SVTYPE/.test(JSON.stringify(facet ?? ''))
          const errors = (d.notices ?? []).filter(n => n.level === 'error')
          out.push({ whole, type: d.type, pass, bin, count, bars, byType, errors, ok: whole && d.type === 'LinearMarkDisplay' && pass && bin && count && bars && byType && !errors.length })
        }
      }
      return { pass: out.some(o => o.ok), detail: out }`,
  },
  {
    name: 'fx-genark-chimp-foxp2',
    tutorial: true,
    draws: '.',
    config: HG38_HUB,
    prompt:
      "From genomes.jbrowse.org, open the telomere-to-telomere chimpanzee assembly (mPanTro3, the RefSeq primary haplotype) and show chimpanzee FOXP2 with that assembly's RefSeq genes.",
    solution: `${importHub(CHIMP_T2T, 'config.json', '/ncbiRefSeq$/')}
      await jb.addView({ type: 'LinearGenomeView', assembly: asm.name, loc: 'NC_072404.2:129,400,000-130,100,000', tracks: [asm.name + '-ncbiRefSeq'] })
      return jb.waitReady(120000)`,
    grade: `
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.some(a => /^GC[AF]_028858775\\.\\d+$/.test(a)))) {
        const rs = await jb.visibleRegions(v.id)
        const span = rs.reduce((n, r) => n + r.end - r.start, 0)
        const hits = []
        for (const t of v.tracks.filter(t => t.type === 'FeatureTrack')) {
          for (const r of rs) {
            const fs = await jb.getFeatures({ trackId: t.configuration.trackId, viewId: v.id, loc: r.refName + ':' + (r.start + 1) + '-' + r.end, byteLimit: 80e6 }).catch(() => [])
            if (fs.some(f => [f.get('name'), f.get('geneName'), f.get('gene'), f.get('name2')].includes('FOXP2'))) { hits.push(t.configuration.trackId) }
          }
        }
        out.push({ asm: v.assemblyNames[0], rs: rs.map(r => r.refName + ':' + r.start + '-' + r.end), span, hits })
      }
      return { pass: out.some(o => o.hits.length > 0 && o.span < 2000000), detail: out }`,
  },
  {
    name: 'fx-genark-sars-furin',
    tutorial: true,
    draws: '.',
    config: HG38_HUB,
    prompt:
      "From genomes.jbrowse.org, open the SARS-CoV-2 reference genome and zoom to base level on the spike protein's furin cleavage site (the PRRAR motif, residues 681-685), with its genes and the reference sequence translated so the motif reads out.",
    solution: `${importHub('https://jbrowse.org/ucsc/wuhCor1/', 'config.json', '/ncbiGeneBGP$/')}
      await jb.addView({ type: 'LinearGenomeView', assembly: asm.name, loc: 'NC_045512v2:23,560-23,660', tracks: [asm.name + '-ncbiGeneBGP'] })
      const v = jb.session.views.at(-1)
      await v.launchTrack(jb.session.assemblyManager.get(asm.name).configuration.sequence.trackId, {}, { showTranslation: true })
      return jb.waitReady(120000)`,
    grade: `
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.some(a => /wuhCor1|GC[AF]_009858895/.test(a)))) {
        const asm = v.assemblyNames[0]
        const rs = await jb.visibleRegions(v.id)
        const r = rs[0]
        let spike
        for (const t of v.tracks.filter(t => t.type === 'FeatureTrack')) {
          const fs = await jb.getFeatures({ trackId: t.configuration.trackId, viewId: v.id, loc: r.refName + ':21000-25500', byteLimit: 80e6 }).catch(() => [])
          spike ??= fs.find(f => /^(S|spike|surface glycoprotein)$/i.test(String(f.get('name') ?? f.get('gene') ?? f.get('geneName'))) && f.get('start') < 21600)
        }
        const from = spike ? spike.get('start') + 680 * 3 : NaN
        const seqId = jb.session.assemblyManager.get(asm).configuration.sequence.trackId
        const codons = spike ? (await jb.getFeatures({ trackId: seqId, viewId: v.id, loc: r.refName + ':' + (from + 1) + '-' + (from + 15) }))[0]?.get('seq').toUpperCase() : ''
        const seq = v.tracks.find(t => t.configuration.trackId === seqId)?.activeDisplay
        const covers = rs.some(x => x.start <= from && x.end >= from + 15 && x.end - x.start <= 300)
        out.push({ asm, rs: rs.map(x => x.refName + ':' + x.start + '-' + x.end), from, codons, covers, translation: seq?.showTranslation, forward: seq?.showForward })
      }
      const furin = c => /^CC[TCAG][CA]G[TCAG][CA]G[TCAG]GC[TCAG][CA]G[TCAG]$/.test(c)
      return { pass: out.some(o => furin(o.codons) && o.covers && o.translation === true && o.forward !== false), detail: out }`,
  },
)

// Open-world outside tasks: find public data by accession, transform it with
// command-line tools, and show the result. Probe truths came from my own
// shell pipelines over the same public files.
const windowMean = `
  const windowMean = async (t, v, p) => {
    let sum = 0
    for (const f of await jb.getFeatures({ trackId: t.configuration.trackId, viewId: v.id, loc: p.loc, byteLimit: 80e6 })) {
      const from = Math.max(f.get('start'), p.start)
      const to = Math.min(f.get('end'), p.end)
      if (to > from) { sum += (to - from) * f.get('score') }
    }
    return Math.round((sum / (p.end - p.start)) * 100) / 100
  }
  const near = (m, e, rel, abs) => Math.abs(m - e) <= rel * Math.abs(e) + abs`
// Per-base means over GSE115749's 786-M1A H3K27ac bigWigs (GSM3188593 empty
// vector, GSM3188594 HA-VHL), and log2((VHL + 1) / (EV + 1)) averaged per base
const VHL_PROBES = [
  {
    loc: 'chr6:43,668,001-43,670,000',
    start: 43668000,
    end: 43670000,
    ratio: -1.11,
    ev: 2.46,
    vhl: 0.51,
  },
  {
    loc: 'chr6:43,768,001-43,770,000',
    start: 43768000,
    end: 43770000,
    ratio: -0.94,
    ev: 1.98,
    vhl: 0.58,
  },
  {
    loc: 'chr6:43,804,001-43,806,000',
    start: 43804000,
    end: 43806000,
    ratio: 0.16,
    ev: 0.4,
    vhl: 0.58,
  },
]
// wgEncodeBroadHistoneK562H3k27acStdSig lifted hg19 to hg38 with UCSC's
// hg19ToHg38 chain; read unlifted on hg38 these windows hold 3.34, 0, 7.41, 51.99
const LIFT_PROBES = [
  {
    loc: 'chr11:5,225,001-5,227,000',
    start: 5225000,
    end: 5227000,
    expect: 12.45,
  },
  {
    loc: 'chr11:5,240,001-5,242,000',
    start: 5240000,
    end: 5242000,
    expect: 9.7,
  },
  {
    loc: 'chr11:5,280,001-5,282,000',
    start: 5280000,
    end: 5282000,
    expect: 49.4,
  },
  {
    loc: 'chr11:5,300,001-5,302,000',
    start: 5300000,
    end: 5302000,
    expect: 4.61,
  },
]
// minimap2 -ax splice puts SRR5660151_97 on BCR to the end of its MANE exon
// 14 (chr22:23,290,413) and on ABL1 from the start of exon 2 (chr9:130,854,064)
const BCR_EXON14_END = 23290413

TASKS.push(
  {
    name: 'fx-geo-vhl-ratio',
    outside: true,
    prompt:
      'GEO series GSE115749 has hg38 H3K27ac ChIP-seq bigWigs for 786-M1A renal cancer cells carrying an empty vector and with VHL restored. Make a bigWig of log2((VHL + 1) / (empty vector + 1)) across VEGFA and 150 kb either side, save it as WORK/vhl_vs_ev.bw, and show it on hg38 at VEGFA beside the two source signals.',
    grade: `${windowMean}
      const probes = ${JSON.stringify(VHL_PROBES)}
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))) {
        const rs = await jb.visibleRegions(v.id)
        const atVegfa = rs.some(r => r.refName.replace(/^chr/, '') === '6' && r.start < 43786487 && r.end > 43770207 && r.end - r.start < 1000000)
        const tracks = []
        for (const t of v.tracks.filter(t => t.type === 'QuantitativeTrack')) {
          const means = []
          for (const p of probes) { means.push(await windowMean(t, v, p).catch(() => NaN)) }
          tracks.push({ id: t.configuration.trackId, ratioFile: JSON.stringify(jb.mst.getSnapshot(t.configuration)).includes('vhl_vs_ev.bw'), means })
        }
        const ratio = tracks.some(t => t.ratioFile && t.means.every((m, i) => near(m, probes[i].ratio, 0, 0.3)))
        const ev = tracks.some(t => t.means.every((m, i) => near(m, probes[i].ev, 0.25, 0.1)))
        const vhl = tracks.some(t => t.means.every((m, i) => near(m, probes[i].vhl, 0.25, 0.1)))
        out.push({ atVegfa, ratio, ev, vhl, tracks })
      }
      return { pass: out.some(o => o.atVegfa && o.ratio && o.ev && o.vhl), detail: out }`,
  },
  {
    name: 'fx-hg19-lift-k562',
    outside: true,
    prompt:
      "UCSC's ENCODE Broad Histone K562 H3K27ac signal track (wgEncodeBroadHistoneK562H3k27acStdSig) exists only on hg19. Show it on hg38 across the beta-globin locus, chr11:5,200,000-5,320,000, at its correct hg38 positions: save the converted signal as WORK/k562_h3k27ac_hg38.bw and display it there.",
    grade: `${windowMean}
      const probes = ${JSON.stringify(LIFT_PROBES)}
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))) {
        const rs = await jb.visibleRegions(v.id)
        const atLocus = rs.some(r => r.refName.replace(/^chr/, '') === '11' && r.start < 5320000 && r.end > 5200000 && r.end - r.start < 2000000)
        for (const t of v.tracks.filter(t => JSON.stringify(jb.mst.getSnapshot(t.configuration)).includes('k562_h3k27ac_hg38'))) {
          const means = []
          for (const p of probes) { means.push(await windowMean(t, v, p).catch(() => NaN)) }
          out.push({ atLocus, id: t.configuration.trackId, means, ok: atLocus && means.every((m, i) => near(m, probes[i].expect, 0.15, 0.5)) })
        }
      }
      return { pass: out.some(o => o.ok), detail: out }`,
  },
  {
    name: 'fx-logan-bcr-abl1',
    outside: true,
    prompt:
      'Logan (indextheplanet.com) has assembled contigs for every SRA run. Fetch the Logan contigs for the K562 RNA-seq run SRR5660151, find the contig that spells the BCR-ABL1 fusion transcript, and show it aligned on hg38 at the BCR side of the junction. Reply with the contig name and which BCR exon joins which ABL1 exon.',
    grade: `
      const out = []
      for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))) {
        const rs = await jb.visibleRegions(v.id)
        const atJunction = rs.some(r => r.refName.replace(/^chr/, '') === '22' && r.start < ${BCR_EXON14_END} && r.end >= ${BCR_EXON14_END} && r.end - r.start < 500000)
        for (const t of v.tracks) {
          const names = (await jb.getFeatures({ trackId: t.configuration.trackId, viewId: v.id, loc: 'chr22:${BCR_EXON14_END - 100}-${BCR_EXON14_END}', byteLimit: 80e6 }).catch(() => [])).map(f => f.get('name') ?? f.get('id'))
          if (names.includes('SRR5660151_97')) { out.push({ atJunction, id: t.configuration.trackId }) }
        }
      }
      ${FINAL}
      const named = /SRR5660151_97\\b/.test(final)
      const junction = /e14a2|b3a2|(\\be14|\\bb3|exon\\s*14)\\b[^.]{0,120}(\\ba2|exon\\s*2)\\b|(\\ba2|exon\\s*2)\\b[^.]{0,120}(\\be14|\\bb3|exon\\s*14)\\b/i.test(final)
      return { pass: named && junction && out.some(o => o.atJunction), detail: { named, junction, out, final: final.slice(-300) } }`,
  },
)

// The tutorial tasks name their tutorial and spell out the figure, and the
// docs list each tutorial's files, so they measure following a recipe. These
// ask the question a researcher would, with the same graders: the agent has to
// work out which data and which view answer it.
const UNNAMED: Record<string, string> = {
  'tut-methylation-haplotypes':
    "Is SNRPN's promoter methylated on only one parental copy in HG002? Show me the per-read nanopore evidence in hg38 that would convince me.",
  'tut-synteny-tnnt3':
    'How does the TNNT3 region of hg38 line up against the T2T-CHM13 genome? Show me the alignment between the two assemblies there, so I can tell inverted pieces from same-strand ones.',
  'tut-multiway-grape-peach-cacao':
    'Peach chromosome G7 has a gene block near 18.6 Mb. Show me where it is conserved in grape and cacao, with all three genomes stacked peach, grape, cacao, colored so I can see how many genomes share each block.',
  'tut-multiway-hg38-tp53':
    'Show me how TP53 in hg38 aligns to chimp, gorilla, orangutan, macaque, marmoset, mouse, dog and cow, one lane per species, ordered by how closely related each is to human.',
  'tut-hic-bcr-abl1':
    'Is there 3D-contact evidence for the BCR-ABL1 fusion in K562 cells? Show me ABL1 and BCR side by side in one hg38 view with K562 Hi-C, against a normal cell line as a control, without normalization hiding the signal.',
  'tut-cancer-sv-der3-chain':
    "COLO829's derivative chromosome 3 is stitched together from pieces of chr3, chr10 and chr12. Show me each junction side by side with the tumor reads that cross it, including the parts of reads that don't align.",
}
for (const [name, prompt] of Object.entries(UNNAMED)) {
  const task = TASKS.find(t => t.name === name)!
  TASKS.push({ ...task, name: name.replace(/^tut-/, 'un-'), prompt })
}

// Novel tasks: questions no tutorial or doc covers, on hosted hg38 data no
// tutorial points at. Each grader computes its truth live from the hub.
// Uncalibrated: proven only by hostedCheck, never yet run with an agent.
const HG002_CPG = 'hg38-fiberSeqCompendium_PM00002_cpgHap'
const MEG3_DMR = ['14', 100824000, 100828000] as const
const PEG3_DMR = ['19', 56837000, 56841000] as const
// `hapMeans(chrom, from, to)` is HG002's mean CpG methylation per haplotype
const HAP_MEANS = `
  const hapMeans = async (chrom, from, to) => {
    const f = await jb.getFeatures({ trackId: '${HG002_CPG}', loc: 'chr' + chrom + ':' + (from + 1) + '-' + to, byteLimit: 80e6 })
    return [1, 2].map(h => { const xs = f.filter(x => String(x.get('source')).endsWith('Hap' + h)).map(x => x.get('score')); return xs.reduce((a, b) => a + b, 0) / xs.length })
  }`
// `views(chrom, from, to, maxSpan, cover)`: the hg38 views showing that
// window, each with its track ids; `cover` asks for the whole window
const NV_VIEWS = `
  const views = async (chrom, from, to, maxSpan, cover) => {
    const out = []
    for (const v of session.views.filter(v => v.type === 'LinearGenomeView' && v.assemblyNames?.includes('hg38'))) {
      const rs = await jb.visibleRegions(v.id)
      if (rs.some(r => r.refName.replace(/^chr/, '') === chrom && (cover ? r.start <= from && r.end >= to : r.start < to && r.end > from) && r.end - r.start < maxSpan)) {
        out.push({ id: v.id, ids: v.tracks.map(t => t.configuration.trackId) })
      }
    }
    return out
  }
  const GENES = /^hg38-(ncbiRefSeq\\w*|knownGene\\w*|ensGene|mane|wgEncodeGencode\\w*)$/`
// The haplotype numbers a reply calls methylated, and the ones it calls
// paternal (a haplotype called maternal counts as the other one)
const HAP_CLAIMS = `${FINAL}
  const HAP = '(?:hap(?:lotype)?|HP)\\\\s*[=:#]?\\\\s*([12])\\\\b'
  const GAP = '((?:(?!hap|HP\\\\s*[=:#]?\\\\s*[12])[^.;\\\\n]){0,80}?)'
  const claimed = (forward, reverse, flip) => {
    const out = new Set()
    for (const m of final.matchAll(new RegExp(HAP + GAP + forward, 'gi'))) {
      if (!/\\b(less|lower|low|not|no|barely|hypo\\w*|un\\w*)\\b/i.test(m[2])) out.add(flip(m[0]) ? 3 - Number(m[1]) : Number(m[1]))
    }
    for (const m of final.matchAll(new RegExp(reverse + '\\\\s+(?:haplotype|copy|allele|chromosome|homolog|one)?\\\\s*(?:is|=|:|corresponds to|maps to|is on|on)?\\\\s*(?:the\\\\s+)?' + HAP, 'gi'))) {
      out.add(flip(m[0]) ? 3 - Number(m[1]) : Number(m[1]))
    }
    return [...out]
  }
  const methylated = claimed('\\\\b(?:(?:hyper)?methylated|(?:carries|has|holds|bears) (?:the |most )?methylation)', '\\\\b(?:hyper)?methylated', () => false)
  const paternal = claimed('\\\\b(paternal|maternal|father|mother)', '\\\\b(?:paternal|maternal)', s => /maternal|mother/i.test(s))`

TASKS.push(
  {
    name: 'nv-meg3-imprint-haplotype',
    tutorial: true,
    draws: 'cpgHap|cpgDiff',
    config: HG38_HUB,
    prompt:
      'Is the MEG3 promoter imprinted in HG002, methylated on only one of its two haplotypes? Show me haplotype-resolved methylation there in hg38 and tell me which haplotype carries the methylation.',
    solution: `${HAP_MEANS}
      await jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr14:100,818,000-100,834,000', tracks: ['hg38-mane', '${HG002_CPG}'] }] }, 90000)
      const [h1, h2] = await hapMeans(${MEG3_DMR.map(x => JSON.stringify(x)).join(', ')})
      return 'Yes. Haplotype ' + (h1 > h2 ? 1 : 2) + ' is methylated across the MEG3 promoter DMR, and haplotype ' + (h1 > h2 ? 2 : 1) + ' is largely unmethylated.'`,
    grade: `${HAP_MEANS}
      ${NV_VIEWS}
      ${HAP_CLAIMS}
      const [h1, h2] = await hapMeans(${MEG3_DMR.map(x => JSON.stringify(x)).join(', ')})
      const truth = h1 > h2 ? 1 : 2
      const shown = (await views(${MEG3_DMR.map(x => JSON.stringify(x)).join(', ')}, 500000)).filter(v => v.ids.some(i => /^hg38-fiberSeqCompendium_PM00002_cpg(Hap|Diff)$/.test(i)))
      return { pass: Math.abs(h1 - h2) >= 20 && shown.length > 0 && methylated.length === 1 && methylated[0] === truth, detail: { h1, h2, truth, methylated, shown, final: final.slice(-300) } }`,
  },
  {
    name: 'nv-hg002-paternal-haplotype',
    tutorial: true,
    draws: 'cpgHap|cpgDiff',
    config: HG38_HUB,
    prompt:
      "HG002's long-read methylation tracks number its haplotypes 1 and 2 rather than by parent. Use the imprinted DMRs at PEG3 and MEG3 to work out which haplotype is the paternal one, and show me both DMRs side by side in hg38.",
    solution: `${HAP_MEANS}
      await jb.loadSessionSpec({ views: [
        { type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr19:56,834,000-56,844,000', tracks: ['hg38-mane', '${HG002_CPG}'] },
        { type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr14:100,818,000-100,834,000', tracks: ['hg38-mane', '${HG002_CPG}'] } ] }, 90000)
      const [m1, m2] = await hapMeans(${MEG3_DMR.map(x => JSON.stringify(x)).join(', ')})
      const pat = m1 > m2 ? 1 : 2
      return 'MEG3 is methylated on the paternal copy and PEG3 on the maternal one; haplotype ' + pat + ' carries the MEG3 methylation, so haplotype ' + pat + ' is paternal.'`,
    grade: `${HAP_MEANS}
      ${NV_VIEWS}
      ${HAP_CLAIMS}
      const [m1, m2] = await hapMeans(${MEG3_DMR.map(x => JSON.stringify(x)).join(', ')})
      const [p1, p2] = await hapMeans(${PEG3_DMR.map(x => JSON.stringify(x)).join(', ')})
      const truth = m1 > m2 ? 1 : 2
      const agree = (m1 > m2) === (p2 > p1) && Math.abs(m1 - m2) >= 20 && Math.abs(p1 - p2) >= 20
      const meth = v => v.ids.some(i => /^hg38-fiberSeqCompendium_PM00002_cpg(Hap|Diff)$/.test(i))
      const meg3 = (await views(${MEG3_DMR.map(x => JSON.stringify(x)).join(', ')}, 500000)).filter(meth)
      const peg3 = (await views(${PEG3_DMR.map(x => JSON.stringify(x)).join(', ')}, 500000)).filter(meth)
      return { pass: agree && meg3.length > 0 && peg3.length > 0 && paternal.length === 1 && paternal[0] === truth, detail: { meg3Means: [m1, m2], peg3Means: [p1, p2], truth, paternal, meg3, peg3, final: final.slice(-300) } }`,
  },
)

// ε4 is rs429358 C on a haplotype with rs7412 C; `loose` counts rs429358 C
// alone, which differs only on a rare ε1 haplotype
const APOE_E4 = `
  const recs = await jb.getFeatures({ trackId: 'hg38-hprc-v2.0-pangenome-vcf', loc: 'chr19:44,908,600-44,908,900', byteLimit: 80e6 })
  const site = (pos, ref, alt) => recs.find(f => f.get('POS') === pos && f.get('REF') === ref && f.get('ALT')?.[0] === alt)
  const rs429358 = site(44908684, 'T', 'C')
  const rs7412 = site(44908822, 'C', 'T')
  const haps = (f, s) => String(f?.get('samples')?.[s]?.GT ?? '').split(/[|/]/)
  let e4 = 0
  let loose = 0
  let homs = 0
  let looseHoms = 0
  for (const s of Object.keys(rs429358?.get('samples') ?? {})) {
    const a = haps(rs429358, s)
    const b = haps(rs7412, s)
    const strict = [0, 1].filter(i => a[i] === '1' && b[i] !== '1').length
    const any = [0, 1].filter(i => a[i] === '1').length
    e4 += strict
    loose += any
    homs += strict === 2 ? 1 : 0
    looseHoms += any === 2 ? 1 : 0
  }`
const MYC_TSS = 127736231
// Mean phyloP 100-way over each distal enhancer-like cCRE wholly inside the
// 500 kb upstream of MYC's TSS
const MYC_ELS = `
  const ccres = (await jb.getFeatures({ trackId: 'hg38-cCREregistry', loc: 'chr8:${MYC_TSS - 500000}-${MYC_TSS}', byteLimit: 80e6 }))
    .filter(f => f.get('cCRE_class') === 'Distal enhancer' && f.get('start') >= ${MYC_TSS - 500001} && f.get('end') <= ${MYC_TSS})
  const means = Object.fromEntries(await Promise.all(ccres.map(async f => {
    let sum = 0
    for (const x of await jb.getFeatures({ trackId: 'hg38-phyloP100way', loc: 'chr8:' + (f.get('start') + 1) + '-' + f.get('end'), byteLimit: 80e6 })) {
      const from = Math.max(x.get('start'), f.get('start'))
      const to = Math.min(x.get('end'), f.get('end'))
      if (to > from) { sum += (to - from) * x.get('score') }
    }
    return [f.get('name'), sum / (f.get('end') - f.get('start'))]
  })))
  const ranked = Object.entries(means).sort((a, b) => b[1] - a[1])
  const top = ranked[0]?.[1]`
const RS12740374 = `
  const snp = (await jb.getFeatures({ trackId: 'hg38-dbSnp155Common', loc: 'chr1:109,274,900-109,275,000', byteLimit: 80e6 })).find(f => f.get('name') === 'rs12740374')
  const pos = snp?.get('end')
  const host = (await jb.getFeatures({ trackId: 'hg38-mane', loc: 'chr1:' + pos + '-' + pos, byteLimit: 80e6 })).filter(g => g.get('start') < pos && g.get('end') >= pos).map(g => g.get('name'))
  const lof = (await jb.getFeatures({ trackId: 'hg38-pliByGene', loc: 'chr1:' + pos + '-' + pos, byteLimit: 80e6 })).find(g => host.includes(g.get('geneName')))
  const pli = Number(lof?.get('_pli'))
  const loeuf = Number(lof?.get('_loeuf'))`
const MAPT_INV = `
  const inv = (await jb.getFeatures({ trackId: 'hg38-hprcArrInvBedV1', loc: 'chr17:45,894,554-46,028,334', byteLimit: 80e6 }))
    .sort((a, b) => (b.get('end') - b.get('start')) - (a.get('end') - a.get('start')))[0]
  const invLen = inv ? inv.get('end') - inv.get('start') : NaN
  const carriers = Number(inv?.get('score'))`

TASKS.push(
  {
    name: 'nv-apoe-e4-hprc',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      'In hg38, how many of the HPRC pangenome haplotypes carry the APOE ε4 allele, and how many HPRC samples are ε4/ε4 homozygotes?',
    solution: `${APOE_E4}
      return e4 + ' haplotypes carry APOE ε4, and ' + homs + ' samples are ε4/ε4.'`,
    grade: `${APOE_E4}
      ${said}
      return { pass: e4 > 0 && (said.includes(e4) || said.includes(loose)) && (said.includes(homs) || said.includes(looseHoms)), detail: { e4, loose, homs, looseHoms, said, final: final.slice(-300) } }`,
  },
  {
    name: 'nv-myc-desert-enhancer',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      "In hg38, the 500 kb upstream of MYC's transcription start is a gene desert full of enhancers. Which ENCODE candidate enhancer there, of the distal enhancer-like class, is the most conserved by mean phyloP 100-way score? Reply with its cCRE accession.",
    solution: `${MYC_ELS}
      return ranked[0][0] + ' is the most conserved, with mean phyloP ' + top.toFixed(2) + '.'`,
    grade: `${MYC_ELS}
      ${FINAL}
      const ids = [...final.matchAll(/EH38E\\d+/g)].map(m => m[0])
      const claim = final.split(/(?<=[.!?\\n])\\s*/).find(t => /EH38E\\d+/.test(t) && /most|highest|top|best|answer/i.test(t))?.match(/EH38E\\d+/)?.[0] ?? ids[0]
      return { pass: ranked.length > 50 && claim in means && means[claim] >= 0.98 * top, detail: { top: ranked.slice(0, 3), claim, claimed: means[claim], n: ranked.length } }`,
  },
  {
    name: 'nv-sort1-snp-host',
    tutorial: true,
    config: HG38_HUB,
    prompt:
      "rs12740374 is the LDL-cholesterol SNP credited to SORT1. In hg38, which gene's body does it actually lie in, and how constrained is that gene against loss of function in gnomAD (its pLI and LOEUF)? Show me the SNP with genes and the gnomAD constraint track.",
    solution: `${RS12740374}
      await jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr1:109,230,000-109,400,000', tracks: ['hg38-mane', 'hg38-dbSnp155Common', 'hg38-pliByGene'] }] }, 90000)
      return 'rs12740374 lies in ' + host[0] + ', not SORT1. ' + host[0] + ' has pLI ' + pli + ' and LOEUF ' + loeuf + '.'`,
    grade: `${RS12740374}
      ${NV_VIEWS}
      ${FINAL}
      const nums = (final.match(/\\d*\\.?\\d+/g) ?? []).map(Number)
      const named = host.some(h => new RegExp('\\\\b' + h + '\\\\b').test(final))
      const values = [pli, loeuf].every(x => nums.some(n => Math.abs(n - x) < 0.006))
      const shown = (await views('1', pos - 1, pos, 2000000)).filter(v => v.ids.some(i => /^hg38-pliBy/.test(i)) && v.ids.some(i => GENES.test(i)))
      return { pass: host.length > 0 && !host.includes('SORT1') && named && values && shown.length > 0, detail: { pos, host, pli, loeuf, named, values, shown, final: final.slice(-300) } }`,
  },
  {
    name: 'nv-mapt-inversion',
    tutorial: true,
    draws: 'hprcArrInv|genomicSuperDups',
    config: HG38_HUB,
    prompt:
      'In hg38, how long is the 17q21.31 inversion over MAPT that the HPRC assemblies show, and how many of those assemblies carry it? Show me the whole inversion with MAPT and the segmental duplications flanking it, every track actually drawn.',
    solution: `${MAPT_INV}
      await jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr17:' + (inv.get('start') - 200000) + '-' + (inv.get('end') + 200000), tracks: ['hg38-mane', 'hg38-hprcArrInvBedV1', 'hg38-genomicSuperDups'] }] }, 90000)
      await jb.trackModel('hg38-genomicSuperDups').applyDisplaySettings({ forceLoad: true })
      await jb.waitReady(120000)
      return 'The inversion spans ' + invLen.toLocaleString('en-US') + ' bp, carried by ' + carriers + ' HPRC assemblies.'`,
    grade: `${MAPT_INV}
      ${NV_VIEWS}
      ${said}
      const UNIT = { bp: 1, kb: 1e3, mb: 1e6 }
      const lengths = [...final.matchAll(/(\\d[\\d,]*(?:\\.\\d+)?)\\s*(bp|kb|mb)\\b/gi)].map(m => Number(m[1].replaceAll(',', '')) * UNIT[m[2].toLowerCase()])
      const length = lengths.some(l => Math.abs(l - invLen) <= 0.02 * invLen)
      const shown = (await views('17', inv?.get('start'), inv?.get('end'), 3 * invLen, true)).filter(v => v.ids.includes('hg38-hprcArrInvBedV1') && v.ids.includes('hg38-genomicSuperDups') && v.ids.some(i => GENES.test(i)))
      return { pass: invLen > 500000 && length && said.includes(carriers) && shown.length > 0, detail: { invLen, carriers, lengths, shown, final: final.slice(-300) } }`,
  },
)
