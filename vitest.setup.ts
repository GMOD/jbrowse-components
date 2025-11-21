import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Mock scrollIntoView which is not implemented in jsdom
Element.prototype.scrollIntoView = vi.fn()

vi.mock('./packages/core/util/idMaker', () => ({
  default: () => 'test',
}))
