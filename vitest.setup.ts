import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

import '@testing-library/jest-dom/vitest'
import { LocalFile } from './packages/__mocks__/generic-filehandle2'
import { generateReadBuffer } from './products/jbrowse-web/src/tests/generateReadBuffer'

// Suppress React act() warnings - testing-library handles this internally
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('was not wrapped in act')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

// Ensure cleanup runs after each test
afterEach(() => {
  cleanup()
})

// Mock scrollIntoView which is not implemented in jsdom
Element.prototype.scrollIntoView = vi.fn()

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

vi.mock('@jbrowse/core/util/useMeasure', async () => {
  const React = await import('react')
  return {
    default: () => {
      const ref = React.useRef<HTMLDivElement>(null)
      return [ref, { width: 808 }] as const
    },
  }
})

// Mock CascadingMenu to flatten submenus for easier testing
vi.mock('@jbrowse/core/ui/CascadingMenu', async () => {
  const actual = (await vi.importActual('@jbrowse/core/ui/Menu')) as {
    default: React.ComponentType<any>
  }
  const React = await import('react')

  return {
    default: (props: any) => {
      return React.createElement(actual.default, props)
    },
  }
})

// Mock CascadingMenuButton to flatten submenus for easier testing
vi.mock('@jbrowse/core/ui/CascadingMenuButton', async () => {
  const actual = (await vi.importActual('@jbrowse/core/ui/MenuButton')) as {
    default: React.ComponentType<any>
  }
  const React = await import('react')

  return {
    default: (props: any) => {
      return React.createElement(actual.default, props)
    },
  }
})
