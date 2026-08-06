#!/usr/bin/env node
/**
 * probe-graph-nodes.ts — dump the nodes a GraphGenomeView spec actually draws.
 *
 *   node scripts/probe-graph-nodes.ts pangenome/hprc_node_menu [--view=1]
 *
 * A graph is one canvas, so a spec that clicks/hovers a node has to name it
 * (`anchor: { graphNode }`). Which ids the cut contains is a property of the
 * data plus the plugin's one-hop BFS, not of anything in the repo — this prints
 * them, with the sample and length that make one worth pointing at, so a spec
 * picks a node from the graph rather than from a pixel measured off a PNG.
 */
import { parseArgs } from 'node:util'

import {
  resolveUrlSpec,
  specUrl,
  specViewport,
  withHarness,
} from './dev-harness.ts'
import { graphNodePoint } from './graphAnchor.ts'

const PORT = 3346

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    view: { type: 'string' },
    hover: { type: 'string' },
    timeout: { type: 'string' },
  },
})
const specName = positionals[0]
const viewIndex = Number(values.view ?? 1)
const timeout = Number(values.timeout ?? 300000)

const spec = resolveUrlSpec(
  specName,
  `no url-mode spec named "${specName}"`,
)

const dump = await withHarness(
  { port: PORT, protocolTimeout: 1200000, viewport: specViewport(spec) },
  async ({ page }) => {
    await page.goto(specUrl(spec, PORT), { waitUntil: 'domcontentloaded', timeout })
    await page.waitForSelector('[data-testid="graph-layout-select"]', { timeout })
    // the auto-fit lands after the layout does, and the transform is what turns a
    // node position into the coordinate a click would use
    await new Promise(r => setTimeout(r, 8000))

    // --hover=<segment id> moves the mouse to where the anchor resolver says that
    // node is and reports what the view thinks is under the cursor, which is the
    // only way to tell "the anchor is wrong" from "the hover handler didn't fire"
    const hoverId = values.hover
    if (hoverId) {
      const point = await graphNodePoint(page, {
        view: viewIndex,
        graphNode: hoverId,
      })
      console.error(`hover point for ${hoverId}:`, point)
      if (point) {
        await page.mouse.move(point.x, point.y)
        await new Promise(r => setTimeout(r, 1500))
        console.error(
          'hoveredNode:',
          await page.evaluate(index => {
            interface V {
              views?: V[]
              hoveredNode?: string | null
              hoverHighlight?: unknown
            }
            const v = (window as unknown as { JBrowseSession?: V }).JBrowseSession
              ?.views?.[index]
            return { hoveredNode: v?.hoveredNode, highlight: v?.hoverHighlight }
          }, viewIndex),
        )
      }
    }

    return page.evaluate(index => {
      interface Node {
        id: string
        length?: number
        stable?: {
          rank?: number
          refName?: string
          start?: number
          end?: number
        }
      }
      interface GraphView {
        id: string
        views?: GraphView[]
        scale?: number
        translateX?: number
        translateY?: number
        graph?: { nodes: Node[] }
        nodePositions?: Record<string, { x: number; y: number }[]>
      }
      const session = (window as unknown as { JBrowseSession?: GraphView })
        .JBrowseSession
      const view = session?.views?.[index]
      const canvas = view
        ? document.querySelector(
            `[data-testid="view-container-${CSS.escape(view.id)}"] [data-testid="graph-genome-canvas"]`,
          )
        : undefined
      const r = canvas?.getBoundingClientRect()
      const scale = view?.scale ?? 1
      const tx = view?.translateX ?? 0
      const ty = view?.translateY ?? 0
      return {
        viewType: (view as unknown as { type?: string } | undefined)?.type,
        canvas: r
          ? { left: r.left, top: r.top, width: r.width, height: r.height }
          : undefined,
        nodes: (view?.graph?.nodes ?? []).map(n => {
          const pts = view?.nodePositions?.[n.id] ?? []
          const xs = pts.map(p => p.x * scale + tx + (r?.left ?? 0))
          const ys = pts.map(p => p.y * scale + ty + (r?.top ?? 0))
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
    }, viewIndex)
  },
)

console.log(JSON.stringify(dump, null, 2))
