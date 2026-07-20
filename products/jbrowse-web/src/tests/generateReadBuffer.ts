import { LocalFile } from 'generic-filehandle2'

import type { GenericFilehandle } from 'generic-filehandle2'

// clamps open-ended (`bytes=start-`) ranges; test files are far smaller
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
  } catch {
    return new Response(undefined, {
      status: 404,
    })
  }
}

export async function handleRangeRequest(
  file: GenericFilehandle,
  rangeHeader: string,
) {
  const { start, end } = parseByteRange(rangeHeader, maxRangeRequest)
  const length = end - start + 1
  const buffer = await file.read(length, start)
  const stats = await file.stat()

  return new Response(buffer, {
    status: 206,
    headers: [['content-range', `${start}-${end}/${stats.size}`]],
  })
}

// Minimal HTTP byte-range parser replacing the `range-parser` dep: handles the
// single-range `bytes=start-end`, `bytes=start-`, and `bytes=-suffix` forms the
// genomic adapters emit (not multipart ranges), clamping open-ended ranges to
// `size`. Throws on a malformed or unsatisfiable header.
function parseByteRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  const [, rawStart = '', rawEnd = ''] = match ?? []
  const suffix = rawStart === '' ? Number(rawEnd) : undefined
  const start =
    suffix === undefined ? Number(rawStart) : Math.max(size - suffix, 0)
  const end =
    suffix === undefined && rawEnd !== ''
      ? Math.min(Number(rawEnd), size - 1)
      : size - 1
  const valid =
    match !== null &&
    !(rawStart === '' && rawEnd === '') &&
    !Number.isNaN(start) &&
    start <= end &&
    start < size
  if (valid) {
    return { start, end }
  }
  throw new Error(`Error parsing range "${header}"`)
}

export async function handleFullRequest(file: GenericFilehandle) {
  const body = await file.readFile()
  return new Response(body, {
    status: 200,
  })
}

export function defaultGetFile(url: string): GenericFilehandle {
  return new LocalFile(
    require.resolve(`../../${url.replace(/http:\/\/localhost\//, '')}`),
  )
}

export function volvoxGetFile(url: string): GenericFilehandle {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/volvox/${cleanUrl}`
  return new LocalFile(require.resolve(`../../${filePath}`))
}

export function grapePeachGetFile(url: string): GenericFilehandle {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/grape_peach_synteny/${cleanUrl}`
  return new LocalFile(require.resolve(`../../${filePath}`))
}

export function utilizeFetchMockForTest(
  getFile: (url: string) => GenericFilehandle = defaultGetFile,
) {
  beforeEach(() => {
    const realFetch = global.fetch
    jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
      // data: URIs (e.g. bgzf-filehandle's inlined WASM module) must reach the
      // real fetch, not the file-serving mock
      if (`${url}`.startsWith('data:')) {
        return realFetch(url, args)
      }
      return `${url}`.includes('jb2=true')
        ? new Response('{}')
        : handleRequest(() => getFile(`${url}`), args)
    })
  })
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    jest.restoreAllMocks()
  })
}
