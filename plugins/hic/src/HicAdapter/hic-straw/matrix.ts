// Vendored and converted to TypeScript from hic-straw (igvteam, MIT license)
// https://github.com/igvteam/hic-straw

import BinaryParser from './binary.ts'
import MatrixZoomData from './matrixZoomData.ts'

import type { Chromosome } from './types.ts'

export default class Matrix {
  private bpZoomData: MatrixZoomData[] = []
  private fragZoomData: MatrixZoomData[] = []

  constructor(
    public chr1: number,
    public chr2: number,
    zoomDataList: MatrixZoomData[],
  ) {
    for (const zd of zoomDataList) {
      if (zd.zoom.unit === 'BP') {
        this.bpZoomData.push(zd)
      } else {
        this.fragZoomData.push(zd)
      }
    }
  }

  // Fetch zoom data by bin size. If no matching level exists return undefined.
  getZoomData(binSize: number, unit = 'BP') {
    const zdArray = unit === 'BP' ? this.bpZoomData : this.fragZoomData
    return zdArray.find(zd => binSize === zd.zoom.binSize)
  }

  static getKey(chrIdx1: number, chrIdx2: number) {
    const lo = Math.min(chrIdx1, chrIdx2)
    const hi = Math.max(chrIdx1, chrIdx2)
    return `${lo}_${hi}`
  }

  static parseMatrix(data: ArrayBuffer, chromosomes: Chromosome[]) {
    const dis = new BinaryParser(new DataView(data))
    const c1 = dis.getInt() // Should equal chrIdx1
    const c2 = dis.getInt() // Should equal chrIdx2

    const chr1 = chromosomes[c1]!
    const chr2 = chromosomes[c2]!

    // # of resolution levels (bp and frags)
    let nResolutions = dis.getInt()
    const zdList: MatrixZoomData[] = []
    while (nResolutions-- > 0) {
      zdList.push(MatrixZoomData.parseMatrixZoomData(chr1, chr2, dis))
    }
    return new Matrix(c1, c2, zdList)
  }
}
