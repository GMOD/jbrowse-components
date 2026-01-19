export interface BlatResult {
  matches: number
  misMatches: number
  repMatches: number
  nCount: number
  qNumInsert: number
  qBaseInsert: number
  tNumInsert: number
  tBaseInsert: number
  strand: string
  qName: string
  qSize: number
  qStart: number
  qEnd: number
  tName: string
  tSize: number
  tStart: number
  tEnd: number
  blockCount: number
  blockSizes: number[]
  qStarts: number[]
  tStarts: number[]
}

function parseIntList(s: string | number): number[] {
  if (typeof s === 'number') {
    return [s]
  }
  return s
    .split(',')
    .filter(Boolean)
    .map(v => Number(v))
}

function parseBlatJsonResponse(rows: (string | number)[][]): BlatResult[] {
  return rows.map(row => ({
    matches: Number(row[0]),
    misMatches: Number(row[1]),
    repMatches: Number(row[2]),
    nCount: Number(row[3]),
    qNumInsert: Number(row[4]),
    qBaseInsert: Number(row[5]),
    tNumInsert: Number(row[6]),
    tBaseInsert: Number(row[7]),
    strand: String(row[8]),
    qName: String(row[9]),
    qSize: Number(row[10]),
    qStart: Number(row[11]),
    qEnd: Number(row[12]),
    tName: String(row[13]),
    tSize: Number(row[14]),
    tStart: Number(row[15]),
    tEnd: Number(row[16]),
    blockCount: Number(row[17]),
    blockSizes: parseIntList(row[18]!),
    qStarts: parseIntList(row[19]!),
    tStarts: parseIntList(row[20]!),
  }))
}

export async function queryBlat({
  sequence,
  db,
  type = 'DNA',
}: {
  sequence: string
  db: string
  type?: 'DNA' | 'protein' | 'translated RNA' | 'translated DNA'
}): Promise<BlatResult[]> {
  const baseUrl = 'https://genome.ucsc.edu/cgi-bin/hgBlat'

  const params = {
    userSeq: sequence,
    type,
    db,
    output: 'json',
  }

  let response: Response
  if (sequence.length >= 8000) {
    response = await fetch(baseUrl, {
      method: 'POST',
      body: new URLSearchParams(params),
    })
  } else {
    response = await fetch(`${baseUrl}?${new URLSearchParams(params)}`)
  }

  const contentType = response.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    const text = await response.text()
    if (text.includes('Too many requests')) {
      throw new Error(
        'UCSC rate limit exceeded. Please wait 15 seconds between queries.',
      )
    }
    if (text.includes('CAPTCHA')) {
      throw new Error(
        'UCSC CAPTCHA protection triggered. Please try again later or visit genome.ucsc.edu directly.',
      )
    }
    throw new Error(`BLAT server returned HTML instead of JSON: ${text.slice(0, 200)}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`BLAT error: ${data.error}`)
  }

  return parseBlatJsonResponse(data.blat || [])
}

export function calculateScore(result: BlatResult) {
  return result.matches - result.misMatches - result.qNumInsert - result.tNumInsert
}

export function calculateIdentity(result: BlatResult) {
  const aligned = result.matches + result.misMatches + result.repMatches
  if (aligned === 0) {
    return 0
  }
  return ((result.matches + result.repMatches) / aligned) * 100
}

export function calculateQueryCoverage(result: BlatResult) {
  const alignedBases = result.qEnd - result.qStart
  if (result.qSize === 0) {
    return 0
  }
  return (alignedBases / result.qSize) * 100
}

export interface IsPcrResult {
  chrom: string
  chromStart: number
  chromEnd: number
  strand: string
  productSize: number
  forwardPrimer: string
  reversePrimer: string
  sequence?: string
}

function parseIsPcrTextResponse(text: string): IsPcrResult[] {
  const results: IsPcrResult[] = []
  const lines = text.trim().split('\n')

  let currentResult: Partial<IsPcrResult> | undefined
  let collectingSequence = false
  let sequenceLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('>')) {
      if (currentResult && currentResult.chrom) {
        if (sequenceLines.length > 0) {
          currentResult.sequence = sequenceLines.join('')
        }
        results.push(currentResult as IsPcrResult)
      }

      const headerMatch = line.match(
        />(\S+):(\d+)([+-])(\d+)\s+(\d+)bp\s+(\S+)\s+(\S+)/,
      )
      if (headerMatch) {
        const [, chrom, start, strand, end, size, fwdPrimer, revPrimer] =
          headerMatch
        currentResult = {
          chrom,
          chromStart: Number(start),
          chromEnd: Number(end),
          strand,
          productSize: Number(size),
          forwardPrimer: fwdPrimer,
          reversePrimer: revPrimer,
        }
        collectingSequence = true
        sequenceLines = []
      } else {
        const simpleMatch = line.match(/>(\S+):(\d+)([+-])(\d+)/)
        if (simpleMatch) {
          const [, chrom, start, strand, end] = simpleMatch
          currentResult = {
            chrom,
            chromStart: Number(start),
            chromEnd: Number(end),
            strand,
            productSize: Math.abs(Number(end) - Number(start)),
            forwardPrimer: '',
            reversePrimer: '',
          }
          collectingSequence = true
          sequenceLines = []
        }
      }
    } else if (collectingSequence && line.trim() && !line.startsWith('<')) {
      sequenceLines.push(line.trim())
    }
  }

  if (currentResult && currentResult.chrom) {
    if (sequenceLines.length > 0) {
      currentResult.sequence = sequenceLines.join('')
    }
    results.push(currentResult as IsPcrResult)
  }

  return results
}

export async function queryIsPcr({
  forwardPrimer,
  reversePrimer,
  db,
  maxSize = 4000,
  minPerfect = 15,
  minGood = 15,
}: {
  forwardPrimer: string
  reversePrimer: string
  db: string
  maxSize?: number
  minPerfect?: number
  minGood?: number
}): Promise<IsPcrResult[]> {
  const baseUrl = 'https://genome.ucsc.edu/cgi-bin/hgPcr'

  const params = new URLSearchParams({
    db,
    wp_target: 'genome',
    wp_f: forwardPrimer,
    wp_r: reversePrimer,
    wp_size: String(maxSize),
    wp_perfect: String(minPerfect),
    wp_good: String(minGood),
    Submit: 'submit',
    'boolshad.wp_flipReverse': '0',
  })

  const response = await fetch(`${baseUrl}?${params}`)

  const text = await response.text()

  if (text.includes('Too many requests')) {
    throw new Error(
      'UCSC rate limit exceeded. Please wait 15 seconds between queries.',
    )
  }
  if (text.includes('CAPTCHA')) {
    throw new Error(
      'UCSC CAPTCHA protection triggered. Please try again later or visit genome.ucsc.edu directly.',
    )
  }

  if (text.includes('No matches')) {
    return []
  }

  const fastaMatch = text.match(/<PRE>([\s\S]*?)<\/PRE>/i)
  if (fastaMatch) {
    return parseIsPcrTextResponse(fastaMatch[1]!)
  }

  const preMatch = text.match(/<TT><PRE>([\s\S]*?)<\/PRE><\/TT>/i)
  if (preMatch) {
    return parseIsPcrTextResponse(preMatch[1]!)
  }

  if (text.includes('>') && text.includes('bp')) {
    return parseIsPcrTextResponse(text)
  }

  return []
}
