import { execSync, spawn } from 'child_process'
import type { ChildProcess } from 'child_process'

import { getReadline } from '../make-pif/file-utils.ts'

interface PathStep {
  segOrd: number
  orient: string
  segLen: number
}

interface PathInfo {
  name: string
  sample: string
  steps: PathStep[]
}

function spawnSortBgzip(outputFile: string, sortArgs: string) {
  const cmd = `sort ${sortArgs} | bgzip > "${outputFile}"`
  return spawn('sh', ['-c', cmd], {
    env: { ...process.env, LC_ALL: 'C' },
    stdio: ['pipe', process.stdout, process.stderr],
  })
}

function waitForClose(child: ChildProcess) {
  return new Promise<void>((resolve, reject) => {
    child.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Child process exited with code ${code}`))
      }
    })
  })
}

export async function gfaToTabix(
  gfaPath: string,
  outputPrefix: string,
  opts: {
    assemblies?: string[]
    chunkSize?: number
  } = {},
) {
  const { assemblies, chunkSize = 100 } = opts
  const rl = getReadline(gfaPath)

  const segmentLengths = new Map<string, number>()
  const segmentOrdinals = new Map<string, number>()
  let nextOrdinal = 0
  const allPaths: PathInfo[] = []

  for await (const line of rl) {
    if (line.startsWith('S\t')) {
      const parts = line.split('\t')
      const name = parts[1]!
      const seq = parts[2]!
      const lnTag = parts.slice(3).find(t => t.startsWith('LN:i:'))
      const length = lnTag ? +lnTag.slice(5) : seq === '*' ? 0 : seq.length

      segmentLengths.set(name, length)
      if (!segmentOrdinals.has(name)) {
        segmentOrdinals.set(name, nextOrdinal++)
      }
    } else if (line.startsWith('W\t')) {
      const parts = line.split('\t')
      const sample = parts[1]!
      const haplotype = parts[2]!
      const sequence = parts[3]!
      const walkStr = parts[6]!
      const pathName = `${sample}#${haplotype}#${sequence}`

      if (assemblies && !assemblies.includes(`${sample}#${haplotype}`)) {
        continue
      }

      const steps: PathStep[] = []
      const stepRegex = /([><])([^><]+)/g
      let match: RegExpExecArray | null = null
      while ((match = stepRegex.exec(walkStr)) !== null) {
        const segId = match[2]!
        const orient = match[1] === '>' ? '+' : '-'
        const segLen = segmentLengths.get(segId) ?? 0
        let ord = segmentOrdinals.get(segId)
        if (ord === undefined) {
          ord = nextOrdinal++
          segmentOrdinals.set(segId, ord)
        }
        steps.push({ segOrd: ord, orient, segLen })
      }
      allPaths.push({ name: pathName, sample: `${sample}#${haplotype}`, steps })
    } else if (line.startsWith('P\t')) {
      const parts = line.split('\t')
      const rawName = parts[1]!
      const hashIdx = rawName.lastIndexOf('#')
      const sample = hashIdx > 0 ? rawName.slice(0, hashIdx) : rawName
      const sequence = hashIdx > 0 ? rawName.slice(hashIdx + 1) : rawName
      const pathName = `${sample}#${sequence}`

      if (assemblies && !assemblies.includes(sample)) {
        continue
      }

      const steps: PathStep[] = parts[2]!.split(',').map(s => {
        const orient = s.endsWith('-') ? '-' : '+'
        const segId =
          s.endsWith('+') || s.endsWith('-') ? s.slice(0, -1) : s
        const segLen = segmentLengths.get(segId) ?? 0
        let ord = segmentOrdinals.get(segId)
        if (ord === undefined) {
          ord = nextOrdinal++
          segmentOrdinals.set(segId, ord)
        }
        return { segOrd: ord, orient, segLen }
      })
      allPaths.push({ name: pathName, sample, steps })
    }
  }

  const ordToSegId = new Map<number, string>()
  for (const [name, ord] of segmentOrdinals) {
    ordToSegId.set(ord, name)
  }

  // Write pos.bed.gz: pathName \t start \t end \t minSegOrd \t maxSegOrd
  const posFile = `${outputPrefix}.pos.bed.gz`
  const posProc = spawnSortBgzip(
    posFile,
    '-t"$(printf \'\\t\')" -k1,1 -k2,2n',
  )

  // Write segs.bed.gz: S \t ordinal \t ordinal+1 \t pathName \t offset \t segLen \t orient \t segId
  const segsFile = `${outputPrefix}.segs.bed.gz`
  const segsProc = spawnSortBgzip(
    segsFile,
    '-t"$(printf \'\\t\')" -k1,1 -k2,2n',
  )

  const posStdin = posProc.stdin!
  const segsStdin = segsProc.stdin!

  const genomes = [...new Set(allPaths.map(p => p.sample))]
  const headerLine = `#genomes=${genomes.join(',')}\n`
  posStdin.write(headerLine)
  segsStdin.write(headerLine)

  const pathSizes: string[] = []
  for (const p of allPaths) {
    let totalLen = 0
    for (const step of p.steps) {
      totalLen += step.segLen
    }
    pathSizes.push(`${p.name}:${totalLen}`)
  }
  const sizesLine = `#sizes=${pathSizes.join(',')}\n`
  posStdin.write(sizesLine)
  segsStdin.write(sizesLine)

  for (const p of allPaths) {
    let offset = 0
    let chunkStart = 0
    let chunkMinOrd = Infinity
    let chunkMaxOrd = -Infinity
    let stepsInChunk = 0

    for (let i = 0; i < p.steps.length; i++) {
      const step = p.steps[i]!
      const segId = ordToSegId.get(step.segOrd) ?? `${step.segOrd}`
      segsStdin.write(
        `S\t${step.segOrd}\t${step.segOrd + 1}\t${p.name}\t${offset}\t${step.segLen}\t${step.orient}\t${segId}\n`,
      )

      chunkMinOrd = Math.min(chunkMinOrd, step.segOrd)
      chunkMaxOrd = Math.max(chunkMaxOrd, step.segOrd)
      offset += step.segLen
      stepsInChunk++

      if (stepsInChunk >= chunkSize || i === p.steps.length - 1) {
        posStdin.write(
          `${p.name}\t${chunkStart}\t${offset}\t${chunkMinOrd}\t${chunkMaxOrd}\n`,
        )
        chunkStart = offset
        chunkMinOrd = Infinity
        chunkMaxOrd = -Infinity
        stepsInChunk = 0
      }
    }
  }

  posStdin.end()
  segsStdin.end()
  await Promise.all([waitForClose(posProc), waitForClose(segsProc)])

  execSync(`tabix -c '#' -p bed "${posFile}"`, { stdio: 'inherit' })
  execSync(`tabix -c '#' -p bed "${segsFile}"`, { stdio: 'inherit' })

  return {
    posFile,
    segsFile,
    segmentCount: segmentLengths.size,
    pathCount: allPaths.length,
    genomes,
  }
}
