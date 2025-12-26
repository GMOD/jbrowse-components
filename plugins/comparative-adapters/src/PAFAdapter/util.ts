export interface PAFRecord {
  qname: string
  qstart: number
  qend: number
  tname: string
  tstart: number
  tend: number
  strand: number
  extra: {
    cg?: string
    blockLen?: number
    mappingQual?: number
    numMatches?: number
    meanScore?: number
  }
}
// based on "weighted mean" method from https://github.com/tpoorten/dotPlotly
// License reproduced here
//
// MIT License

// Copyright (c) 2017 Tom Poorten

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Notes: in the weighted mean longer alignments factor in more heavily of all
// the fragments of a query vs the reference that it mapped to
//
// this uses a combined key query+'-'+ref to iteratively map all the alignments
// that match a particular ref from a particular query (so 1d array of what
// could be a 2d map)
//
// the result is a single number that says e.g. chr5 from human mapped to chr5
// on mouse with 0.8 quality, and that 0.8 is then attached to all the pieces
// of chr5 on human that mapped to chr5 on mouse. if chr5 on human also more
// weakly mapped to chr6 on mouse, then it would have another value e.g. 0.6.
// this can show strong and weak levels of synteny, especially in polyploidy
// situations

export function getWeightedMeans(ret: PAFRecord[]) {
  // First pass: compute weighted sums per query-target pair
  const scoreMap: Record<string, { valueSum: number; weightSum: number }> = {}
  for (const entry of ret) {
    const key = `${entry.qname}-${entry.tname}`
    const qual = entry.extra.mappingQual || 1
    const len = entry.extra.blockLen || 1
    const existing = scoreMap[key]
    if (existing) {
      existing.valueSum += qual * len
      existing.weightSum += len
    } else {
      scoreMap[key] = { valueSum: qual * len, weightSum: len }
    }
  }

  // Convert sums to means and find min/max in one pass
  const meanScoreMap: Record<string, number> = {}
  let min = Infinity
  let max = -Infinity
  for (const [key, { valueSum, weightSum }] of Object.entries(scoreMap)) {
    const mean = valueSum / weightSum
    meanScoreMap[key] = mean
    min = Math.min(mean, min)
    max = Math.max(mean, max)
  }

  // Second pass: attach normalized scores
  const range = max - min
  for (const entry of ret) {
    const key = `${entry.qname}-${entry.tname}`
    const score = meanScoreMap[key]!
    entry.extra.meanScore = range > 0 ? (score - min) / range : 1
  }

  return ret
}
