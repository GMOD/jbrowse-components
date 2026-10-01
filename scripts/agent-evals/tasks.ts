// The tasks an agent is measured on, each against the volvox baseline the
// recipes page describes: one linear view at ctgA:1-30,000 showing the gene
// track and the VCF. Mined from the turns of the filmed takes, at volvox scale
// so a run is offline and minutes long.
//
// `grade` is a run_javascript body. It runs after the agent's session ends,
// with `answer` bound to the agent's final message, and returns
// `{ pass, detail? }`. A grader reads STATE, never the transcript: what is on
// screen, what the data says, what the settings are.

export interface EvalTask {
  name: string
  prompt: string
  // run_javascript body that stages state after the baseline, before the agent
  setup?: string
  grade: string
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
}

export type TaskSet = 'dev' | 'heldout' | 'tutorials' | 'all'
export type Surface = 'desktop' | 'web'

export function selectTasks(set: TaskSet, filter = '', surface: Surface) {
  return TASKS.filter(
    t =>
      (set === 'all' ||
        set === (t.tutorial ? 'tutorials' : t.heldOut ? 'heldout' : 'dev')) &&
      (surface === 'desktop' || t.desktopOnly !== true) &&
      t.name.includes(filter),
  )
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

// A negative task passes on an answer that declines. The cue is loose on
// purpose: an agent that did the impossible reports success, and success has
// none of these words, while a correct decline has many spellings.
const DECLINES =
  "/\\b(no|not|cannot|unable|unknown|isn't|doesn't|can't|couldn't|didn't|nothing)\\b/i"

const shownTrack = (trackId: string) =>
  `jb.view().tracks.find(t => t.configuration.trackId === '${trackId}')`

export const TASKS: EvalTask[] = [
  {
    name: 'arcs',
    prompt: 'Show the volvox_alignments track as read arcs.',
    solution: `return jb.addTrack({ trackId: 'volvox_alignments', settings: { readConnections: 'arc' } })`,
    grade: `
      const t = ${shownTrack('volvox_alignments')}
      const readConnections = t && jb.readConfObject(t.activeDisplay.configuration, 'readConnections')
      return { pass: readConnections === 'arc', detail: { shown: !!t, readConnections } }`,
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
      const sideBySide = jb.mst.getSnapshot(session).useWorkspaces === true
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
    solution: `return jb.trackModel('gff3tabix_genes').applyDisplaySettings({ showLabels: 'none' })`,
    // showLabels, not a guess: jb.describeSlots on the gene display lists it
    // with "none" among its modes, beside maxLabelFeatureDensity and
    // subfeatureLabels, which are the two neighbours a guess lands on
    grade: `
      const t = ${shownTrack('gff3tabix_genes')}
      const conf = t?.activeDisplay.configuration
      const read = slot => conf && jb.readConfObject(conf, slot)
      return {
        pass: read('showLabels') === 'none',
        detail: {
          showLabels: read('showLabels'),
          subfeatureLabels: read('subfeatureLabels'),
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
    solution: `return jb.trackModel('gff3tabix_genes').applyDisplaySettings({ color: { field: 'strand' } })`,
    grade: `
      const t = ${shownTrack('gff3tabix_genes')}
      const color = t && jb.readConfObject(t.activeDisplay.configuration, 'color')
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
    // a filter is display state with no config slot, so the grader reads the model
    grade: `
      const filter = ${shownTrack('gff3tabix_genes')}?.activeDisplay.filterSetting ?? []
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
      const marks = d?.markPlot?.marks ?? []
      return { pass: d?.type === 'LinearMarkDisplay' && marks.some(m => m.mark === 'point'), detail: { type: d?.type, marks } }`,
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
      return String(tracks.filter(t => t.type === 'VariantTrack' && t.assemblyNames.includes('volvox')).length)`,
    grade: `
      const { tracks } = jb.listTracks('', 1000)
      const truth = tracks.filter(t => t.type === 'VariantTrack' && t.assemblyNames.includes('volvox')).length
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
      const atSnrpn = regions.some(r => r.refName.replace(/^chr/, '') === '15' && r.start < 24962000 && r.end > 24948000)
      const track = view.tracks.find(t => JSON.stringify(jb.mst.getSnapshot(t.configuration)).includes('HG002_SNRPN_5mC_haplotagged.bam'))
      const conf = track?.activeDisplay.configuration
      const baseColor = conf && jb.readConfObject(conf, ['baseColor', 'field'])
      const facet = conf && jb.readConfObject(conf, 'facet')
      const facetField = typeof facet === 'string' ? facet : facet?.field
      return {
        pass: atSnrpn && baseColor === 'modifications' && /\\bHP$/.test(facetField ?? ''),
        detail: { regions, track: track?.configuration.trackId, baseColor, facet },
      }`,
  },
  {
    name: 'tut-synteny-tnnt3',
    tutorial: true,
    prompt:
      'As in the genomes synteny tutorial, compare hg38 with T2T-CHM13 (hs1) at TNNT3 in a synteny view, ribbons colored by strand.',
    grade: `
      const view = session.views.find(v => v.type === 'LinearSyntenyView')
      if (!view) {
        return { pass: false, detail: session.views.map(v => v.type) }
      }
      const rows = view.views.map(v => ({ assembly: v.assemblyNames[0], regions: v.displayedRegions.map(r => r.refName + ':' + r.start + '-' + r.end) }))
      const hg38 = view.views.find(v => v.assemblyNames.includes('hg38'))
      const hs1 = view.views.find(v => v.assemblyNames.includes('hs1'))
      const hg38Regions = hg38 ? await jb.visibleRegions(hg38.id) : []
      const atTnnt3 = hg38Regions.some(r => r.refName.replace(/^chr/, '') === '11' && r.start < 1938706 && r.end > 1919568)
      const synteny = view.syntenyTracks().length > 0
      const field = typeof view.color === 'string' ? view.color : view.color?.field
      return {
        pass: Boolean(hs1) && atTnnt3 && synteny && field === 'strand',
        detail: { rows, hg38Regions, tracks: view.syntenyTracks().map(t => t.configuration.trackId), color: view.color },
      }`,
  },
]
