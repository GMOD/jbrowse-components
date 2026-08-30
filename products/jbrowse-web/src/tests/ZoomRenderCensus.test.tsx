import { act, waitFor } from '@testing-library/react'

import { censusRenders } from './renderCensus.ts'
import {
  createView,
  doBeforeEach,
  findDisplayPainted,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

const FRAMES = 20
const STEP = 1.15

beforeEach(() => {
  doBeforeEach()
})

async function census({
  trackIds,
  startBpPerPx,
  painted,
  label,
}: {
  trackIds: string[]
  startBpPerPx: number
  painted: string
  label: string
}) {
  const { view, container } = await createView(volvoxConfigWithTracks(trackIds))
  view.setNewView(startBpPerPx, 0)
  for (const trackId of trackIds) {
    view.showTrack(trackId)
  }
  await waitFor(
    () => {
      expect(view.tracks.length).toBe(trackIds.length)
    },
    { timeout: 30000 },
  )
  await findDisplayPainted(painted, { timeout: 30000 })

  const where = (n: Node | null): string => {
    let el = (n instanceof Element ? n : n?.parentElement) ?? null
    const trail: string[] = []
    while (el) {
      const id = el.dataset?.testid
      if (id) {
        return `${id} > ${trail.slice(0, 2).reverse().join('/')}`
      }
      const cls =
        typeof el.className === 'string' ? el.className.split(' ')[0] : ''
      if (cls) {
        trail.push(cls)
      }
      el = el.parentElement
    }
    return trail.slice(-3).reverse().join('/') || '<root>'
  }

  const mutations: string[] = []
  const mo = new MutationObserver(records => {
    for (const r of records) {
      const kind =
        r.type === 'attributes'
          ? `attr:${r.attributeName}`
          : `${r.type}:+${r.addedNodes.length}/-${r.removedNodes.length}`
      mutations.push(`${kind}  @  ${where(r.target)}`)
    }
  })
  mo.observe(container, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  })

  const c = censusRenders()
  try {
    c.reset()
    for (let i = 0; i < FRAMES; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        view.zoomTo(view.bpPerPx * STEP)
      })
    }
    const structural = mutations.filter(m => m.startsWith('childList')).length
    const tally = new Map<string, number>()
    for (const m of mutations) {
      tally.set(m, (tally.get(m) ?? 0) + 1)
    }
    const churn = [...tally]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([k, n]) => `${String(n).padStart(6)}  ${k}`)
      .join('\n')
    // eslint-disable-next-line no-console
    console.log(
      `\n=== ${label}: ${FRAMES} frames, ${view.tracks.length} tracks, ` +
        `${startBpPerPx} -> ${view.bpPerPx.toFixed(0)} bp/px ===\n` +
        `observer renders  ${c.total()} (${(c.total() / FRAMES).toFixed(1)}/frame)\n` +
        `DOM mutations     ${mutations.length} (${(mutations.length / FRAMES).toFixed(1)}/frame)\n` +
        `  structural      ${structural} (${(structural / FRAMES).toFixed(1)}/frame)\n\n` +
        c.report(25) +
        `\n\nwhere the DOM churn lands:\n${churn}`,
    )
  } finally {
    c.stop()
    mo.disconnect()
  }
}

// The regime the browser harness sweeps (0.5-4 bp/px), plus a track of each
// family so the count reflects the chrome each one mounts.
test('census: mixed tracks, base-ish zoom', async () => {
  await census({
    label: 'mixed',
    trackIds: [
      'volvox_microarray',
      'volvox_microarray_multi',
      'volvox_filtered_vcf',
      'volvox_gc',
    ],
    startBpPerPx: 5,
    painted: 'wiggle-display',
  })
}, 90000)

// The regime INTERACTION_PERF flags as unmeasured: where people read gene
// tracks, and where FloatingLabelsLayer rebuilds a label div per feature.
test('census: gene track, label zoom', async () => {
  await census({
    label: 'genes',
    trackIds: ['gff3tabix_genes'],
    startBpPerPx: 10,
    painted: 'feature-display',
  })
}, 90000)
