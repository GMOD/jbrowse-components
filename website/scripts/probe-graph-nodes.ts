#!/usr/bin/env node
/**
 * probe-graph-nodes.ts — dump the nodes a graph spec actually draws.
 *
 *   node scripts/probe-graph-nodes.ts pangenome/hprc_mhc_layout_force [--view=0] [--track=<trackId>]
 *
 * A graph is one canvas, so a spec that clicks/hovers a node has to name it
 * (`anchor: { graphNode }`). Which ids the cut contains is a property of the
 * data plus the plugin's one-hop BFS, not of anything in the repo — this prints
 * them, with the sample and length that make one worth pointing at, so a spec
 * picks a node from the graph rather than from a pixel measured off a PNG. The
 * pane is found the way the anchor finds it: a graph track of the view, or the
 * view itself when it is a GraphGenomeView.
 */
import { parseArgs } from 'node:util'

import {
  resolveUrlSpec,
  specUrl,
  specViewport,
  withHarness,
} from './dev-harness.ts'
import { graphNodePoint, locateGraphPane } from './graphAnchor.ts'
import { GRAPH_DRAWN, GRAPH_VIEW_DRAWN } from './specs/graph-fixtures.ts'

const PORT = 3346

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    view: { type: 'string' },
    track: { type: 'string' },
    hover: { type: 'string' },
    timeout: { type: 'string' },
  },
})
const specName = positionals[0]
const target = { view: Number(values.view ?? 0), track: values.track }
const timeout = Number(values.timeout ?? 300000)

const spec = resolveUrlSpec(specName, `no url-mode spec named "${specName}"`)

const dump = await withHarness(
  { port: PORT, protocolTimeout: 1200000, viewport: specViewport(spec) },
  async ({ page }) => {
    await page.goto(specUrl(spec, PORT), {
      waitUntil: 'domcontentloaded',
      timeout,
    })
    await page.waitForSelector(`${GRAPH_DRAWN}, ${GRAPH_VIEW_DRAWN}`, {
      timeout,
    })
    // the auto-fit lands after the layout does, and the transform is what turns a
    // node position into the coordinate a click would use
    await new Promise(r => setTimeout(r, 8000))

    // --hover=<segment id> moves the mouse to where the anchor resolver says that
    // node is and reports what the pane thinks is under the cursor, which is the
    // only way to tell "the anchor is wrong" from "the hover handler didn't fire"
    const hoverId = values.hover
    if (hoverId) {
      const point = await graphNodePoint(page, {
        ...target,
        graphNode: hoverId,
      })
      console.error(`hover point for ${hoverId}:`, point)
      if (point) {
        await page.mouse.move(point.x, point.y)
        await new Promise(r => setTimeout(r, 1500))
        const located = await locateGraphPane(page, target)
        console.error(
          'hoveredNode:',
          await located.evaluate(found => {
            const pane = found?.pane as
              | { hoveredNode?: string | null; hoverHighlight?: unknown }
              | undefined
            return {
              hoveredNode: pane?.hoveredNode,
              highlight: pane?.hoverHighlight,
            }
          }),
        )
        await located.dispose()
      }
    }

    const located = await locateGraphPane(page, target)
    const nodes = await located.evaluate(found => {
      if (!found) {
        return undefined
      }
      const { pane, canvas } = found
      const r = canvas.getBoundingClientRect()
      const scaleX = pane.scaleX ?? pane.scale ?? 1
      const scaleY = pane.scaleY ?? pane.scale ?? 1
      const tx = pane.translateX ?? 0
      const ty = pane.translateY ?? 0
      return {
        canvas: { left: r.left, top: r.top, width: r.width, height: r.height },
        nodes: (pane.graph?.nodes ?? []).map(n => {
          const pts = pane.nodePositions?.[n.id] ?? []
          const xs = pts.map(p => p.x * scaleX + tx + r.left)
          const ys = pts.map(p => p.y * scaleY + ty + r.top)
          return {
            id: n.id,
            length: n.length,
            rank: n.stable?.rank,
            refName: n.stable?.refName,
            start: n.stable?.start,
            end: n.stable?.end,
            x: xs.length
              ? Math.round((Math.min(...xs) + Math.max(...xs)) / 2)
              : undefined,
            y: ys.length
              ? Math.round((Math.min(...ys) + Math.max(...ys)) / 2)
              : undefined,
          }
        }),
      }
    })
    await located.dispose()
    return nodes
  },
)

console.log(JSON.stringify(dump, null, 2))
