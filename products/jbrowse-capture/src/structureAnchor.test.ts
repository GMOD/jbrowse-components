/**
 * @jest-environment jsdom
 */
/// <reference types="jest" />
import { parseResidue, residueRectInPage } from './structureAnchor.ts'

// two chains of one residue each, two atoms per residue; atom i sits at
// (10 * i, 20 * i, 0)
const unit = {
  kind: 0,
  elements: [0, 1, 2, 3],
  conformation: {
    position: (e: number, out: number[]) => {
      out[0] = 10 * e
      out[1] = 20 * e
      out[2] = 0
      return out
    },
  },
  model: {
    atomicHierarchy: {
      chainAtomSegments: { index: [0, 0, 1, 1] },
      residueAtomSegments: { index: [0, 0, 1, 1] },
      chains: { auth_asym_id: { value: (i: number) => ['A', 'B'][i]! } },
      residues: { auth_seq_id: { value: (i: number) => [6, 6][i]! } },
      atoms: {
        label_atom_id: { value: (e: number) => ['CA', 'CB', 'CA', 'CB'][e]! },
      },
    },
  },
}

// a drawing buffer twice the CSS size, as at devicePixelRatio 2; the camera
// maps a point straight to buffer px from the bottom-left
function setSession() {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  canvas.getBoundingClientRect = () =>
    ({ left: 100, top: 50, width: 400, height: 300 }) as DOMRect
  const plugin = {
    canvas3d: {
      camera: {
        project: (out: number[], p: number[]) => {
          out[0] = p[0]!
          out[1] = p[1]!
          return out
        },
      },
      webgl: { gl: { canvas } },
    },
    managers: {
      structure: {
        hierarchy: {
          current: {
            structures: [{ cell: { obj: { data: { units: [unit] } } } }],
          },
        },
      },
    },
  }
  ;(window as unknown as { JBrowseSession: unknown }).JBrowseSession = {
    views: [{ type: 'LinearGenomeView' }, { molstarPluginContext: plugin }],
  }
}

beforeEach(setSession)

test("a residue resolves to its side chain's centroid, in CSS px from the top", () => {
  // chain B's CB is atom 3: buffer (30,60), so CSS (15,30) from the canvas's
  // bottom-left
  expect(residueRectInPage(null, { chain: 'B', seq: 6 }, false)).toEqual({
    left: 115,
    top: 320,
    width: 0,
    height: 0,
  })
})

test('a box wraps the projected atoms', () => {
  expect(residueRectInPage([1], { chain: 'B', seq: 6 }, true)).toEqual({
    left: 110,
    top: 320,
    width: 5,
    height: 10,
  })
})

test('a residue the structure lacks resolves to nothing', () => {
  expect(residueRectInPage(null, { chain: 'C', seq: 6 }, false)).toBeUndefined()
  expect(residueRectInPage(null, { chain: 'B', seq: 7 }, false)).toBeUndefined()
})

test('a residue is spelled chain:number', () => {
  expect(parseResidue('B:6')).toEqual({ chain: 'B', seq: 6 })
  expect(() => parseResidue('B6')).toThrow('is not <chain>:<number>')
})
