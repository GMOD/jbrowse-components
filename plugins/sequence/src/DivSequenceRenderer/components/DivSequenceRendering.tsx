/* eslint curly:error*/
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { contrastingTextColor } from '@jbrowse/core/util/color'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { Region } from '@jbrowse/core/util/types'
import { useTheme } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { useRef, useEffect } from 'react'
import { bpSpanPx } from '@jbrowse/core/util'

interface MyProps {
  features: Map<string, Feature>
  regions: Region[]
  bpPerPx: number
  config: AnyConfigurationModel
  highResolutionScaling: number
}

function revcom(seqString: string) {
  return complement(seqString).split('').reverse().join('')
}

const complement = (() => {
  const complementRegex = /[ACGT]/gi

  // from bioperl: tr/acgtrymkswhbvdnxACGTRYMKSWHBVDNX/tgcayrkmswdvbhnxTGCAYRKMSWDVBHNX/
  // generated with:
  // perl -MJSON -E '@l = split "","acgtrymkswhbvdnxACGTRYMKSWHBVDNX"; print to_json({ map { my $in = $_; tr/acgtrymkswhbvdnxACGTRYMKSWHBVDNX/tgcayrkmswdvbhnxTGCAYRKMSWDVBHNX/; $in => $_ } @l})'
  const complementTable = {
    S: 'S',
    w: 'w',
    T: 'A',
    r: 'y',
    a: 't',
    N: 'N',
    K: 'M',
    x: 'x',
    d: 'h',
    Y: 'R',
    V: 'B',
    y: 'r',
    M: 'K',
    h: 'd',
    k: 'm',
    C: 'G',
    g: 'c',
    t: 'a',
    A: 'T',
    n: 'n',
    W: 'W',
    X: 'X',
    m: 'k',
    v: 'b',
    B: 'V',
    s: 's',
    H: 'D',
    c: 'g',
    D: 'H',
    b: 'v',
    R: 'Y',
    G: 'C',
  } as { [key: string]: string }

  return (seqString: string) => {
    return seqString.replace(complementRegex, m => complementTable[m] || '')
  }
})()

const defaultStarts = ['ATG']
const defaultStops = ['TAA', 'TAG', 'TGA']
const defaultCodonTable = {
  TCA: 'S',
  TCC: 'S',
  TCG: 'S',
  TCT: 'S',
  TTC: 'F',
  TTT: 'F',
  TTA: 'L',
  TTG: 'L',
  TAC: 'Y',
  TAT: 'Y',
  TAA: '*',
  TAG: '*',
  TGC: 'C',
  TGT: 'C',
  TGA: '*',
  TGG: 'W',
  CTA: 'L',
  CTC: 'L',
  CTG: 'L',
  CTT: 'L',
  CCA: 'P',
  CCC: 'P',
  CCG: 'P',
  CCT: 'P',
  CAC: 'H',
  CAT: 'H',
  CAA: 'Q',
  CAG: 'Q',
  CGA: 'R',
  CGC: 'R',
  CGG: 'R',
  CGT: 'R',
  ATA: 'I',
  ATC: 'I',
  ATT: 'I',
  ATG: 'M',
  ACA: 'T',
  ACC: 'T',
  ACG: 'T',
  ACT: 'T',
  AAC: 'N',
  AAT: 'N',
  AAA: 'K',
  AAG: 'K',
  AGC: 'S',
  AGT: 'S',
  AGA: 'R',
  AGG: 'R',
  GTA: 'V',
  GTC: 'V',
  GTG: 'V',
  GTT: 'V',
  GCA: 'A',
  GCC: 'A',
  GCG: 'A',
  GCT: 'A',
  GAC: 'D',
  GAT: 'D',
  GAA: 'E',
  GAG: 'E',
  GGA: 'G',
  GGC: 'G',
  GGG: 'G',
  GGT: 'G',
}

function rev(seq: string) {
  return seq.split('').reverse().join('')
}

function generateCodonTable(table: any) {
  /**
   *  take CodonTable above and generate larger codon table that includes
   *  all permutations of upper and lower case nucleotides
   */
  const tempCodonTable: { [key: string]: string } = {}
  Object.keys(table).forEach(codon => {
    const aa = table[codon]
    // console.log("Codon: ", codon, ", aa: ", aa);
    const nucs: string[][] = []
    for (let i = 0; i < 3; i++) {
      const nuc = codon.charAt(i)
      nucs[i] = []
      nucs[i][0] = nuc.toUpperCase()
      nucs[i][1] = nuc.toLowerCase()
    }
    for (let i = 0; i < 2; i++) {
      const n0 = nucs[0][i]
      for (let j = 0; j < 2; j++) {
        const n1 = nucs[1][j]
        for (let k = 0; k < 2; k++) {
          const n2 = nucs[2][k]
          const triplet = n0 + n1 + n2
          tempCodonTable[triplet] = aa
        }
      }
    }
  })
  return tempCodonTable
}

function renderTranslation(
  ctx: CanvasRenderingContext2D,
  codonTable: any,
  seq: string,
  offset: number,
  scale: number,
  reverse: boolean,
) {
  // const seq = reverse ? revcom(seq) : seq

  const extraBases = (seq.length - offset) % 3
  const seqSliced = seq.slice(offset, seq.length - extraBases)
  // seq.slice(0, seq.length + extraBases)

  // console.log({ sequence })
  // console.log({ extraBases })

  let translated = ''
  for (let i = 0; i < seqSliced.length; i += 3) {
    const nextCodon = seqSliced.slice(i, i + 3)
    const aminoAcid = codonTable[nextCodon] || ''
    translated += aminoAcid
  }

  translated = reverse ? translated.split('').reverse().join('') : translated
  ctx.fillStyle = 'grey'
  for (let i = 0; i < translated.length; i++) {
    ctx.fillRect(
      (1 / scale) * 3 * i + offset / scale,
      offset * 20,
      (1 / scale) * 3,
      20,
    )
    ctx.strokeRect(
      (1 / scale) * 3 * i + offset / scale,
      offset * 20,
      (1 / scale) * 3,
      20,
    )
  }
  ctx.fillStyle = 'black'
  for (let i = 0; i < translated.length; i++) {
    // const aminoAcidSpan = document.createElement('td')
    ctx.fillText(
      translated[i],
      i * (1 / scale) * 3 + (offset + 1) / scale,
      offset * 20 + 15,
    )
  }
}

function SequenceDivs(props: MyProps) {
  const { features, highResolutionScaling, regions, bpPerPx } = props
  const [region] = regions
  const width = (region.end - region.start) / bpPerPx
  const totalHeight = 100
  const codonTable = generateCodonTable(defaultCodonTable)
  const height = 20

  const ref = useRef<HTMLCanvasElement>(null)

  const [feature] = [...features.values()]
  const seq = region.reversed ? rev(feature.get('seq')) : feature.get('seq')
  console.log(seq.length, region.end - region.start)

  useEffect(() => {
    if (!ref.current) {
      return
    }
    const ctx = ref.current.getContext('2d')
    if (!ctx) {
      return
    }

    const [leftPx, rightPx] = bpSpanPx(
      feature.get('start'),
      feature.get('end'),
      region,
      bpPerPx,
    )
    ctx.font = '16px Courier New,monospace'
    const charSize = ctx.measureText('A')
    const w = Math.max((rightPx - leftPx) / seq.length, 0.8)
    ctx.strokeStyle = 'black'
    for (let i = 0; i < seq.length; i++) {
      const letter = seq[i]

      switch (letter.toLowerCase()) {
        case 'a':
          ctx.fillStyle = '#00bf00'
          break
        case 'g':
          ctx.fillStyle = '#ffa500'
          break
        case 'c':
          ctx.fillStyle = '#4747ff'
          break
        case 't':
          ctx.fillStyle = '#f00'
          break
      }
      ctx.fillRect(leftPx + i * w, 60, w, height)
      if (1 / bpPerPx >= charSize.width) {
        ctx.strokeRect(leftPx + i * w, 60, w, height)
      }
    }
    if (1 / bpPerPx >= charSize.width) {
      ctx.fillStyle = 'black'
      for (let i = 0; i < seq.length; i++) {
        const letter = seq[i]
        ctx.fillText(letter, leftPx + i * w + (w - charSize.width) / 2, 60 + 15)
      }
    }

    for (let i = 0; i < 3; i++) {
      for (let j = i; j < seq.length; j += 3) {
        const nextCodon = seq.slice(j, j + 3)
        const aminoAcid = codonTable[nextCodon] || ''
        const nw = w * 3

        ctx.fillStyle = 'grey'
        ctx.fillRect(leftPx + j * nw, 40 - 20 * i, nw, 20)
        ctx.fillStyle = 'black'
        ctx.fillText(
          aminoAcid,
          leftPx + j * nw + (nw - charSize.width) / 2,
          40 - 20 * i + 15,
        )
      }
      // const translatedDiv = renderTranslation(
      //   ctx,
      //   codonTable,
      //   seq.slice(i),
      //   i,
      //   bpPerPx,
      //   false,
      // )
      // frameDiv[frame] = translatedDiv
    }
  }, [])
  return (
    <canvas
      ref={ref}
      width={width}
      height={totalHeight}
      style={{ width, height: totalHeight }}
    />
  )
}

SequenceDivs.defaultProps = {
  features: new Map(),
}

function DivSequenceRendering(props: MyProps) {
  const { config } = props
  const height = readConfObject(config, 'height')
  return (
    <div
      // className="DivSequenceRendering"
      style={{ height: `${height}px`, fontSize: `${height * 0.8}px` }}
    >
      <SequenceDivs {...props} />
    </div>
  )
}

export default observer(DivSequenceRendering)
