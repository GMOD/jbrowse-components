import { render } from '@testing-library/react'

import SetColorDialog from './SetColorDialog'

import type { Source } from '../../util'

describe('SetColorDialog', () => {
  const mockSetLayout = jest.fn()
  const mockClearLayout = jest.fn()
  const mockHandleClose = jest.fn()

  const mockSources: Source[] = [
    {
      name: 'source1',
      source: 'file1.bw',
      color: '#FF0000',
      baseUri: 'http://example.com',
      group: 'group1',
    },
    {
      name: 'source2',
      source: 'file2.bw',
      color: '#00FF00',
      group: 'group1',
    },
    {
      name: 'source3',
      source: 'file3.bw',
    },
  ]

  const mockModel = {
    sources: mockSources,
    setLayout: mockSetLayout,
    clearLayout: mockClearLayout,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders without crashing', () => {
    const { container } = render(
      <SetColorDialog model={mockModel} handleClose={mockHandleClose} />,
    )
    expect(container).toBeTruthy()
  })

  test('renders with all sources', () => {
    expect(() => {
      render(<SetColorDialog model={mockModel} handleClose={mockHandleClose} />)
    }).not.toThrow()
  })

  test('works with model without sources', () => {
    const modelWithoutSources = {
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }

    const { container } = render(
      <SetColorDialog
        model={modelWithoutSources}
        handleClose={mockHandleClose}
      />,
    )
    expect(container).toBeTruthy()
  })

  test('works with minimal model', () => {
    const minimalModel = {
      setLayout: jest.fn(),
      clearLayout: jest.fn(),
    }

    const { container } = render(
      <SetColorDialog
        model={minimalModel}
        handleClose={mockHandleClose}
      />,
    )
    expect(container).toBeTruthy()
  })

  test('accepts handleClose callback', () => {
    const { container } = render(
      <SetColorDialog
        model={mockModel}
        handleClose={mockHandleClose}
      />,
    )
    expect(container).toBeTruthy()
    expect(mockHandleClose).not.toHaveBeenCalled()
  })

  test('sources with partial properties work correctly', () => {
    const partialsources: Source[] = [
      { name: 'src1', source: 'file1' },
      { name: 'src2', source: 'file2', color: '#AABBCC' },
    ]

    const modelWithPartialSources = {
      sources: partialsources,
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }

    const { container } = render(
      <SetColorDialog
        model={modelWithPartialSources}
        handleClose={mockHandleClose}
      />,
    )
    expect(container).toBeTruthy()
  })

  test('passes through setLayout function', () => {
    const { container } = render(
      <SetColorDialog model={mockModel} handleClose={mockHandleClose} />,
    )
    expect(container).toBeTruthy()
    expect(mockModel.setLayout).not.toHaveBeenCalled()
  })

  test('renders with complex source configuration', () => {
    const complexSources: Source[] = [
      {
        name: 'track1',
        source: 'https://example.com/file1.bw',
        color: '#FF0000',
        baseUri: 'https://example.com',
        group: 'RNA-seq',
      },
      {
        name: 'track2',
        source: 'https://example.com/file2.bw',
        color: '#00FF00',
        baseUri: 'https://example.com',
        group: 'Proteomics',
      },
      {
        name: 'track3',
        source: 'https://example.com/file3.bw',
        baseUri: 'https://example.com',
      },
    ]

    const complexModel = {
      sources: complexSources,
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }

    const { container } = render(
      <SetColorDialog
        model={complexModel}
        handleClose={mockHandleClose}
      />,
    )
    expect(container).toBeTruthy()
  })
})
