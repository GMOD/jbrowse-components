/* eslint curly:error*/
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { contrastingTextColor } from '@jbrowse/core/util/color'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { Region } from '@jbrowse/core/util/types'
import { useTheme } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React from 'react'
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

function rev(seq: string): string {
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

function Translation(props: {
  codonTable: any
  seq: string
  frame: number
  bpPerPx: number
  region: Region
  reverse?: boolean
}) {
  const { codonTable, seq, frame, bpPerPx, region, reverse } = props
  const scale = bpPerPx
  const tilt = 3 - (region.start % 3)
  const eframe = (frame + tilt) % 3
  const seqSliced = seq.slice(eframe)

  const translated: { letter: string; codon: string }[] = []
  for (let i = 0; i < seqSliced.length; i += 3) {
    const codon = seqSliced.slice(i, i + 3)
    const normalizedCodon = reverse ? revcom(codon) : codon
    const aminoAcid = codonTable[normalizedCodon] || ''
    translated.push({ letter: aminoAcid, codon: normalizedCodon.toUpperCase() })
  }

  const w = (1 / scale) * 3
  const drop = region.start === 0 ? 0 : w
  const render = 1 / bpPerPx >= 12

  const map = ['#d8d8d8', '#adadad', '#8f8f8f'].reverse()
  return (
    <>
      {translated.map((element, index) => {
        const x = w * index + eframe / scale - drop
        const y = reverse ? 100 - frame * 20 : 40 - frame * 20
        const { letter, codon } = element
        return (
          <React.Fragment key={`${index}-${letter}`}>
            <rect
              x={x}
              y={y}
              width={w}
              height={20}
              stroke="#555"
              fill={
                defaultStarts.includes(codon)
                  ? '#0f0'
                  : defaultStops.includes(codon)
                  ? '#f00'
                  : map[Math.abs(frame)]
              }
            />
            {render ? (
              <text x={x + w / 2 - 4} y={y + 15}>
                {letter}
              </text>
            ) : null}
          </React.Fragment>
        )
      })}
    </>
  )
}

function Sequence(props: MyProps) {
  const { features, regions, bpPerPx } = props
  const [region] = regions
  const width = (region.end - region.start) / bpPerPx
  const totalHeight = 200
  const codonTable = generateCodonTable(defaultCodonTable)
  const height = 20

  const [feature] = [...features.values()]
  const fseq: string = feature.get('seq')
  const seq = region.reversed ? rev(fseq) : fseq

  const [leftPx, rightPx] = bpSpanPx(
    feature.get('start'),
    feature.get('end'),
    region,
    bpPerPx,
  )

  const w = Math.max((rightPx - leftPx) / seq.length, 0.8)
  const render = 1 / bpPerPx >= 12
  return (
    <svg
      width={width}
      height={totalHeight}
      style={{ width, height: totalHeight }}
    >
      {[0, 1, 2].map(index => (
        <Translation
          key={`translation-${index}`}
          seq={seq}
          codonTable={codonTable}
          frame={index}
          bpPerPx={bpPerPx}
          region={region}
        />
      ))}
      {[0, -1, -2].map(index => (
        <Translation
          key={`translation-${index}`}
          seq={seq}
          codonTable={codonTable}
          frame={index}
          bpPerPx={bpPerPx}
          region={region}
          reverse
        />
      ))}

      {seq.split('').map((letter, index) => {
        let fill
        switch (letter.toLowerCase()) {
          case 'a':
            fill = '#00bf00'
            break
          case 'g':
            fill = '#ffa500'
            break
          case 'c':
            fill = '#4747ff'
            break
          case 't':
            fill = '#f00'
            break
        }
        return (
          <React.Fragment key={index}>
            <rect
              x={leftPx + index * w}
              y={60}
              width={w}
              height={height}
              fill={fill}
              stroke={render ? '#555' : 'none'}
            />
            {render ? (
              <text x={leftPx + index * w + w / 2 - 4} y={75}>
                {letter}
              </text>
            ) : null}
          </React.Fragment>
        )
      })}
      {complement(seq)
        .split('')
        .map((letter, index) => {
          let fill
          switch (letter.toLowerCase()) {
            case 'a':
              fill = '#00bf00'
              break
            case 'g':
              fill = '#ffa500'
              break
            case 'c':
              fill = '#4747ff'
              break
            case 't':
              fill = '#f00'
              break
          }
          return (
            <React.Fragment key={index}>
              <rect
                x={leftPx + index * w}
                y={80}
                width={w}
                height={height}
                fill={fill}
                stroke={render ? '#555' : 'none'}
              />
              {render ? (
                <text x={leftPx + index * w + w / 2 - 4} y={95}>
                  {letter}
                </text>
              ) : null}
            </React.Fragment>
          )
        })}
    </svg>
  )
}

export default observer(Sequence)
