import type { AnnotationAnchor } from './annotationOverlay.ts'
import type { ViewportRect } from './graphAnchor.ts'
import type { Page } from 'puppeteer'

// A residue of a protein view's Mol* structure, in viewport CSS px: where the
// camera draws it at capture time. The structure is one WebGL canvas, so the
// only thing that knows where a residue landed is the camera, and a callout
// measured off a previous capture would drift the moment the camera, the
// canvas size or the structure moved. This is the `graphAnchor.ts` treatment:
// project the residue's atoms through the live camera.
//
// `residue` is `<auth_asym_id>:<auth_seq_id>`, the chain and number a paper
// cites (`B:6` for HbS's Val6 on 2HBS's first β chain), so a figure names the
// residue the way the structure file does.

interface ResidueId {
  chain: string
  seq: number
}

export function parseResidue(residue: string): ResidueId {
  const match = /^([^:]+):(-?\d+)$/.exec(residue.trim())
  if (!match) {
    throw new Error(`residue anchor "${residue}" is not <chain>:<number>`)
  }
  return { chain: match[1]!, seq: Number(match[2]) }
}

// Page context: serialized whole, so it closes over nothing out here. The
// interfaces are the structural slice of Mol* it reads, declared here because
// `window.JBrowseSession` is untyped from a harness script.
export function residueRectInPage(
  viewPath: number[] | null,
  id: ResidueId,
  wantBounds: boolean,
) {
  interface Column<T> {
    value: (i: number) => T
  }
  interface Unit {
    kind: number
    elements: ArrayLike<number>
    conformation: {
      position: (element: number, out: number[]) => number[]
    }
    model: {
      atomicHierarchy: {
        chainAtomSegments: { index: ArrayLike<number> }
        residueAtomSegments: { index: ArrayLike<number> }
        chains: { auth_asym_id: Column<string> }
        residues: { auth_seq_id: Column<number> }
        atoms: { label_atom_id: Column<string> }
      }
    }
  }
  interface Plugin {
    canvas3d?: {
      camera: { project: (out: number[], point: number[]) => number[] }
      webgl: { gl: { canvas: HTMLCanvasElement } }
    }
    managers: {
      structure: {
        hierarchy: {
          current: {
            structures: {
              cell: {
                state?: { isHidden?: boolean }
                obj?: { data: { units: Unit[] } }
              }
            }[]
          }
        }
      }
    }
  }
  interface View {
    views?: View[]
    molstarPluginContext?: Plugin
  }
  const session = (window as unknown as { JBrowseSession?: View })
    .JBrowseSession
  let view: View | undefined
  if (viewPath) {
    view = session
    for (const i of viewPath) {
      view = view?.views?.[i]
    }
  } else {
    view = session?.views?.find(v => v.molstarPluginContext)
  }
  const plugin = view?.molstarPluginContext
  const canvas3d = plugin?.canvas3d
  if (!plugin || !canvas3d) {
    return undefined
  }
  const canvas = canvas3d.webgl.gl.canvas
  const r = canvas.getBoundingClientRect()
  const scale = r.width / canvas.width
  // the side chain, which a highlight draws as sticks off the cartoon; the
  // backbone's atoms sit on the cartoon itself
  const backbone = new Set(['N', 'CA', 'C', 'O', 'OXT'])
  const xs: number[] = []
  const ys: number[] = []
  const sideXs: number[] = []
  const sideYs: number[] = []
  const point = [0, 0, 0]
  const projected = [0, 0, 0, 0]
  for (const { cell } of plugin.managers.structure.hierarchy.current
    .structures) {
    if (cell.state?.isHidden || !cell.obj) {
      continue
    }
    for (const unit of cell.obj.data.units) {
      // atomic units only; a coarse unit has no residues to name
      if (unit.kind !== 0) {
        continue
      }
      const h = unit.model.atomicHierarchy
      for (let i = 0; i < unit.elements.length; i++) {
        const e = unit.elements[i]!
        if (
          h.chains.auth_asym_id.value(h.chainAtomSegments.index[e]!) ===
            id.chain &&
          h.residues.auth_seq_id.value(h.residueAtomSegments.index[e]!) ===
            id.seq
        ) {
          unit.conformation.position(e, point)
          canvas3d.camera.project(projected, point)
          // the camera's window coordinates are drawing-buffer px from the
          // bottom-left
          const x = r.left + projected[0]! * scale
          const y = r.top + r.height - projected[1]! * scale
          xs.push(x)
          ys.push(y)
          if (!backbone.has(h.atoms.label_atom_id.value(e))) {
            sideXs.push(x)
            sideYs.push(y)
          }
        }
      }
    }
    if (xs.length > 0) {
      break
    }
  }
  if (xs.length === 0) {
    return undefined
  }
  if (wantBounds) {
    const left = Math.min(...xs)
    const top = Math.min(...ys)
    return {
      left,
      top,
      width: Math.max(...xs) - left,
      height: Math.max(...ys) - top,
    }
  }
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
  return sideXs.length > 0
    ? { left: mean(sideXs), top: mean(sideYs), width: 0, height: 0 }
    : { left: mean(xs), top: mean(ys), width: 0, height: 0 }
}

/**
 * Where the protein view's camera drew `anchor.residue`: its atoms' bounds for
 * a box, else the centroid of its side chain (of every atom for a glycine). Undefined when no protein view, canvas or
 * residue is there, so the caller fails the spec by name.
 */
export function residueRect(
  page: Page,
  anchor: AnnotationAnchor,
  wantBounds: boolean,
): Promise<ViewportRect | undefined> {
  const path =
    anchor.view === undefined
      ? null
      : Array.isArray(anchor.view)
        ? anchor.view
        : [anchor.view]
  return page.evaluate(
    residueRectInPage,
    path,
    parseResidue(anchor.residue!),
    wantBounds,
  )
}
