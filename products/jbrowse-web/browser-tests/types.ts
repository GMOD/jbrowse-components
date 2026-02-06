import type { Browser, Page } from 'puppeteer'

export interface TestCase {
  name: string
  fn: (page: Page, browser?: Browser) => Promise<void>
}

export interface TestSuite {
  name: string
  tests: TestCase[]
  requiresAuth?: boolean
}
