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

const shownTrack = (trackId: string) =>
  `jb.view().tracks.find(t => t.configuration.trackId === '${trackId}')`

export const TASKS: EvalTask[] = [
  {
    name: 'arcs',
    prompt: 'Show the volvox_alignments track as read arcs.',
    grade: `
      const t = ${shownTrack('volvox_alignments')}
      const readConnections = t && jb.readConfObject(t.activeDisplay.configuration, 'readConnections')
      return { pass: readConnections === 'arc', detail: { shown: !!t, readConnections } }`,
  },
  {
    name: 'compact',
    prompt: 'Show the gene track in compact mode.',
    grade: `
      const t = ${shownTrack('gff3tabix_genes')}
      const displayMode = t && jb.readConfObject(t.activeDisplay.configuration, 'displayMode')
      return { pass: displayMode === 'compact', detail: { displayMode } }`,
  },
  {
    name: 'side-by-side',
    prompt:
      'Open ctgB:1-10,000 in a second view beside this one, with the gene track, and arrange the two views side by side.',
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
    grade: `
      const feats = await jb.getFeatures({ trackId: 'volvox_test_vcf', loc: 'ctgA:1-30,000' })
      const said = (answer.match(/\\d[\\d,]*/g) ?? []).map(n => Number(n.replaceAll(',', '')))
      return { pass: said.includes(feats.length), detail: { truth: feats.length, said } }`,
  },
  {
    name: 'gene-most-variants',
    prompt:
      'Which gene in the visible region has the most variants? Reply with the gene name only.',
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
    prompt:
      'Add the bigWig file at DATA/test_data/volvox/volvox.bw as a track named "Coverage" and show it in the view.',
    grade: `
      const t = jb.view().tracks.find(t => jb.readConfObject(t.configuration, 'name') === 'Coverage')
      const phase = t?.activeDisplay?.displayPhase
      return { pass: !!t && (phase === undefined || phase === 'ready'), detail: { shown: !!t, phase } }`,
  },
  {
    name: 'reorder',
    prompt: 'Move the VCF track above the gene track.',
    grade: `
      const order = jb.view().tracks.map(t => t.configuration.trackId)
      return { pass: order.join() === 'volvox_test_vcf,gff3tabix_genes', detail: { order } }`,
  },
  {
    name: 'navigate-gene',
    prompt: 'Navigate to the gene EDEN.',
    grade: `
      const [r] = await jb.visibleRegions()
      const span = r.end - r.start
      const overlaps = r.refName === 'ctgA' && r.start < 9000 && r.end > 1050
      return { pass: overlaps && span < 50000, detail: r }`,
  },
  {
    name: 'hide-track',
    prompt: 'Close the variant track.',
    grade: `
      const order = jb.view().tracks.map(t => t.configuration.trackId)
      return { pass: order.join() === 'gff3tabix_genes', detail: { order } }`,
  },
  {
    name: 'hide-labels',
    prompt: 'Hide the feature labels on the gene track.',
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
    grade: `
      const t = jb.view().tracks.find(t => t.type === 'AlignmentsTrack')
      const phase = t?.activeDisplay?.displayPhase
      return {
        pass: !!t && (phase === undefined || phase === 'ready'),
        detail: { trackId: t?.configuration.trackId, phase },
      }`,
  },
]
