import RangeParser from 'range-parser'

import type { GenericFilehandle } from 'generic-filehandle2'

// kind of arbitrary, part of the rangeParser
const maxRangeRequest = 20000000

export function generateReadBuffer(getFile: (s: string) => GenericFilehandle) {
  // Ensure the function always returns a Promise<Response>
  return async (request: Request): Promise<Response> =>
    handleRequest(() => getFile(request.url), request)
}

// the first argument is a callback so if e.g. a require.resolve fails, it
// returns 404
export async function handleRequest(
  cb: () => GenericFilehandle,
  request?: RequestInit,
): Promise<Response> {
  try {
    const rangeHeader =
      // @ts-expect-error
      request?.headers?.range || request?.headers?.get?.('range')
    return rangeHeader
      ? await handleRangeRequest(cb(), rangeHeader)
      : await handleFullRequest(cb())
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
