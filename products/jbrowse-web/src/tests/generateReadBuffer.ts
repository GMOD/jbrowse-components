import RangeParser from 'range-parser'

import type { GenericFilehandle } from 'generic-filehandle2'

// kind of arbitrary, part of the rangeParser
const maxRangeRequest = 10000000

export function generateReadBuffer(getFile: (s: string) => GenericFilehandle) {
  return (request: Request) => handleRequest(getFile(request.url), request)
}

export function handleRequest(file: GenericFilehandle, request?: RequestInit) {
  try {
    // @ts-expect-error
    const rangeHeader = request?.headers?.range
    return rangeHeader
      ? handleRangeRequest(file, rangeHeader)
      : handleFullRequest(file)
  } catch (e) {
    console.error(e)
    return new Response(undefined, {
      status: 404,
    })
  }
}

export async function handleRangeRequest(
  file: GenericFilehandle,
  rangeHeader: string,
) {
  const range = RangeParser(maxRangeRequest, rangeHeader)

  if (range === -2 || range === -1) {
    throw new Error(`Error parsing range "${rangeHeader}"`)
  } else {
    const { start, end } = range[0]!
    const length = end - start + 1
    const buffer = await file.read(length, start)
    const stats = await file.stat()

    return new Response(buffer, {
      status: 206,
      headers: [['content-range', `${start}-${end}/${stats.size}`]],
    })
  }
}

export async function handleFullRequest(file: GenericFilehandle) {
  const body = await file.readFile()
  return new Response(body, {
    status: 200,
  })
}
