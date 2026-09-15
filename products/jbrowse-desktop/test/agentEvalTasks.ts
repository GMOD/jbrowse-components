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
    grade: `
      const overflow = document.documentElement.scrollHeight - window.innerHeight
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
      'Add the bigWig file at REPO/test_data/volvox/volvox.bw as a track named "Coverage" and show it in the view.',
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
]
