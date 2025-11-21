import { vi } from 'vitest'
import { useRef } from 'react'

import '@testing-library/jest-dom/vitest'
import { LocalFile } from './packages/__mocks__/generic-filehandle2'
import { generateReadBuffer } from './products/jbrowse-web/src/tests/generateReadBuffer'

// Mock scrollIntoView which is not implemented in jsdom
Element.prototype.scrollIntoView = vi.fn()

// Mock requestAnimationFrame to execute immediately in tests
global.requestAnimationFrame = vi.fn(cb => {
  cb(0)
  return 0
})
global.cancelAnimationFrame = vi.fn()

// Mock fetch to read from local filesystem
const readBuffer = generateReadBuffer((url: string) => {
  // Handle both full URLs and relative paths
  let filePath = url
  if (url.startsWith('http://localhost:3000/test_data/volvox/')) {
    filePath = url.replace('http://localhost:3000/test_data/volvox/', '')
  }

  // Use require.resolve to get the absolute path to the test data file
  const resolved = require.resolve(
    `./products/jbrowse-web/test_data/volvox/${filePath}`,
  )
  return new LocalFile(resolved)
})

global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  let url: string
  let request: Request

  if (input instanceof Request) {
    url = input.url
    request = input
  } else if (input instanceof URL) {
    url = input.toString()
    request = new Request(url, init)
  } else {
    // It's a string - might be relative path
    url = input
    // If it's not a valid URL, prepend the base URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://localhost:3000/test_data/volvox/${url}`
    }
    request = new Request(url, init)
  }

  return readBuffer(request)
})

vi.mock('./packages/core/util/idMaker', () => ({
  default: () => 'test',
}))

vi.mock('@jbrowse/core/util/useMeasure', () => ({
  default: () => {
    const ref = useRef<HTMLDivElement>(null)
    return [ref, { width: 808 }] as const
  },
}))
