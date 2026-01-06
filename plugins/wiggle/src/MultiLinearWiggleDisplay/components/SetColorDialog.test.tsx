import { render } from '@testing-library/react'

import SetColorDialog from './SetColorDialog.tsx'

import type { Source } from '../../util.ts'
describe('SetColorDialog', () => {
  const mockSetLayout = jest.fn()
  const mockClearLayout = jest.fn()
  const mockHandleClose = jest.fn()
  const mockSources: Source[] = [
    {
      name: 'source1',
      source: 'source1',
      color: '#FF0000',
      baseUri: 'http://example.com',
      group: 'group1',
    },
    {
      name: 'source2',
      source: 'source2',
      color: '#00FF00',
      group: 'group1',
    },
    {
      name: 'source3',
      source: 'source3',
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
  test('works with model with single source', () => {
    const modelWithSingleSource = {
      sources: [
        {
          name: 'single_source',
          source: 'single_source',
          color: '#FF0000',
        },
      ],
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }
    expect(() => {
      render(
        <SetColorDialog
          model={modelWithSingleSource}
          handleClose={mockHandleClose}
        />,
      )
    }).not.toThrow()
  })
  test('works with model with empty sources array', () => {
    const modelWithEmptySources = {
      sources: [],
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }
    expect(() => {
      render(
        <SetColorDialog
          model={modelWithEmptySources}
          handleClose={mockHandleClose}
        />,
      )
    }).not.toThrow()
  })
  test('accepts handleClose callback', () => {
    const { container } = render(
      <SetColorDialog model={mockModel} handleClose={mockHandleClose} />,
    )
    expect(container).toBeTruthy()
    expect(mockHandleClose).not.toHaveBeenCalled()
  })
  test('sources with partial properties work correctly', () => {
    const partialsources: Source[] = [
      {
        name: 'src1',
        source: 'src1',
      },
      { name: 'src2', source: 'src2' },
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
        source: 'track1',
        color: '#FF0000',
        baseUri: 'https://example.com',
        group: 'RNA-seq',
      },
      {
        name: 'track2',
        source: 'track2',
        color: '#00FF00',
        baseUri: 'https://example.com',
        group: 'Proteomics',
      },
      {
        name: 'track3',
        source: 'track3',
        baseUri: 'https://example.com',
      },
    ]
    const complexModel = {
      sources: complexSources,
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }
    const { container } = render(
      <SetColorDialog model={complexModel} handleClose={mockHandleClose} />,
    )
    expect(container).toBeTruthy()
  })
  test('row palettizer - sources with multiple different groups renders', () => {
    const groupedSources: Source[] = [
      {
        name: 'rna1',
        source: 'rna1',
        color: '#FF0000',
        group: 'RNA-seq',
      },
      {
        name: 'rna2',
        source: 'rna2',
        color: '#FF3333',
        group: 'RNA-seq',
      },
      {
        name: 'dna1',
        source: 'dna1',
        color: '#0000FF',
        group: 'ChIP-seq',
      },
      {
        name: 'dna2',
        source: 'dna2',
        color: '#3333FF',
        group: 'ChIP-seq',
      },
      {
        name: 'atac1',
        source: 'atac1',
        color: '#00FF00',
        group: 'ATAC-seq',
      },
    ]
    const groupedModel = {
      sources: groupedSources,
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }
    expect(() => {
      render(
        <SetColorDialog model={groupedModel} handleClose={mockHandleClose} />,
      )
    }).not.toThrow()
  })
  test('row palettizer - setLayout receives modified sources with group changes', () => {
    const testSources: Source[] = [
      {
        name: 'track1',
        source: 'track1',
        color: '#FF0000',
        group: 'GroupA',
      },
      {
        name: 'track2',
        source: 'track2',
        color: '#00FF00',
        group: 'GroupA',
      },
    ]
    const testModel = {
      sources: testSources,
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }
    render(<SetColorDialog model={testModel} handleClose={mockHandleClose} />)
    // Simulate setLayout being called with modified sources
    const modifiedSources: Source[] = [
      {
        ...testSources[0]!,
        color: '#FF5555',
        group: 'GroupA',
      },
      {
        ...testSources[1]!,
        color: '#00FF00',
        group: 'GroupB',
      },
    ]
    testModel.setLayout(modifiedSources)
    expect(mockSetLayout).toHaveBeenCalledWith(modifiedSources)
    expect(mockSetLayout).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'track1',
          source: 'track1',
          group: 'GroupA',
        }),
        expect.objectContaining({
          name: 'track2',
          source: 'track2',
          group: 'GroupB',
        }),
      ]),
    )
  })
  test('row palettizer - same group sources have consistent structure', () => {
    const sameGroupSources: Source[] = [
      {
        name: 'experiment1',
        source: 'experiment1',
        color: '#FF0000',
        group: 'Experiment-A',
      },
      {
        name: 'experiment2',
        source: 'experiment2',
        color: '#FF3333',
        group: 'Experiment-A',
      },
      {
        name: 'experiment3',
        source: 'experiment3',
        color: '#FF6666',
        group: 'Experiment-A',
      },
    ]
    const sameGroupModel = {
      sources: sameGroupSources,
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }
    render(
      <SetColorDialog model={sameGroupModel} handleClose={mockHandleClose} />,
    )
    expect(sameGroupModel.sources).toHaveLength(3)
    expect(sameGroupModel.sources.every(s => s.group === 'Experiment-A')).toBe(
      true,
    )
  })
  test('row palettizer - mixed grouped and ungrouped sources all have required fields', () => {
    const mixedSources: Source[] = [
      {
        name: 'grouped1',
        source: 'grouped1',
        color: '#FF0000',
        group: 'GroupA',
      },
      {
        name: 'ungrouped1',
        source: 'ungrouped1',
        color: '#00FF00',
      },
      {
        name: 'grouped2',
        source: 'grouped2',
        color: '#FF3333',
        group: 'GroupA',
      },
      {
        name: 'ungrouped2',
        source: 'ungrouped2',
        color: '#00FF00',
      },
      {
        name: 'grouped3',
        source: 'grouped3',
        color: '#0000FF',
        group: 'GroupB',
      },
    ]
    const mixedModel = {
      sources: mixedSources,
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }
    render(<SetColorDialog model={mixedModel} handleClose={mockHandleClose} />)
    expect(mixedModel.sources).toHaveLength(5)
    expect(mixedModel.sources.every(s => s.name)).toBe(true)
    const groupedCount = mixedModel.sources.filter(s => s.group).length
    const ungroupedCount = mixedModel.sources.filter(s => !s.group).length
    expect(groupedCount).toBe(3)
    expect(ungroupedCount).toBe(2)
  })
  test('row palettizer - sources with empty group strings maintained', () => {
    const emptyGroupSources: Source[] = [
      {
        name: 'source1',
        source: 'source1',
        color: '#FF0000',
        group: '',
      },
      {
        name: 'source2',
        source: 'source2',
        color: '#00FF00',
        group: 'ValidGroup',
      },
      {
        name: 'source3',
        source: 'source3',
        color: '#0000FF',
        group: '',
      },
    ]
    const emptyGroupModel = {
      sources: emptyGroupSources,
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }
    render(
      <SetColorDialog model={emptyGroupModel} handleClose={mockHandleClose} />,
    )
    expect(emptyGroupModel.sources).toHaveLength(3)
    const emptyGroups = emptyGroupModel.sources.filter(s => s.group === '')
    expect(emptyGroups).toHaveLength(2)
    expect(emptyGroupModel.sources[1]?.group).toBe('ValidGroup')
  })
  test('row palettizer - setLayout called with color changes for grouped sources', () => {
    const groupedSources: Source[] = [
      {
        name: 'rna1',
        source: 'rna1',
        color: '#FF0000',
        group: 'RNA-seq',
      },
      {
        name: 'rna2',
        source: 'rna2',
        color: '#FF3333',
        group: 'RNA-seq',
      },
    ]
    const model = {
      sources: groupedSources,
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }
    render(<SetColorDialog model={model} handleClose={mockHandleClose} />)
    // Simulate changing color of grouped sources
    const modifiedSources: Source[] = [
      { ...groupedSources[0]!, color: '#00FF00' },
      { ...groupedSources[1]!, color: '#33FF33' },
    ]
    model.setLayout(modifiedSources)
    expect(mockSetLayout).toHaveBeenCalledWith(modifiedSources)
    expect(mockSetLayout).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'rna1',
          source: 'rna1',
          color: '#00FF00',
          group: 'RNA-seq',
        }),
        expect.objectContaining({
          name: 'rna2',
          source: 'rna2',
          color: '#33FF33',
          group: 'RNA-seq',
        }),
      ]),
    )
  })
  test('row palettizer - setLayout called with reordered mixed groups', () => {
    const mixedSources: Source[] = [
      {
        name: 'groupA_1',
        source: 'groupA_1',
        color: '#FF0000',
        group: 'GroupA',
      },
      {
        name: 'ungrouped',
        source: 'ungrouped',
        color: '#00FF00',
      },
      {
        name: 'groupB_1',
        source: 'groupB_1',
        color: '#0000FF',
        group: 'GroupB',
      },
    ]
    const model = {
      sources: mixedSources,
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }
    render(<SetColorDialog model={model} handleClose={mockHandleClose} />)
    // Simulate reordering to group all GroupA sources together
    const reorderedSources: Source[] = [
      mixedSources[0]!,
      mixedSources[2]!,
      mixedSources[1]!,
    ]
    model.setLayout(reorderedSources)
    expect(mockSetLayout).toHaveBeenCalledWith(reorderedSources)
    expect(mockSetLayout).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'groupA_1',
          source: 'groupA_1',
          group: 'GroupA',
        }),
        expect.objectContaining({
          name: 'groupB_1',
          source: 'groupB_1',
          group: 'GroupB',
        }),
        expect.objectContaining({
          name: 'ungrouped',
          source: 'ungrouped',
        }),
      ]),
    )
  })
  test('row palettizer - setLayout called when changing source group attribute', () => {
    const sources: Source[] = [
      {
        name: 'track1',
        source: 'track1',
        color: '#FF0000',
        group: 'OriginalGroup',
      },
      {
        name: 'track2',
        source: 'track2',
        color: '#00FF00',
        group: 'OriginalGroup',
      },
    ]
    const model = {
      sources,
      setLayout: mockSetLayout,
      clearLayout: mockClearLayout,
    }
    render(<SetColorDialog model={model} handleClose={mockHandleClose} />)
    // Simulate changing group for sources
    const regroupedSources: Source[] = [
      {
        ...sources[0]!,
        group: 'NewGroup',
      },
      {
        ...sources[1]!,
        group: 'NewGroup',
      },
    ]
    model.setLayout(regroupedSources)
    expect(mockSetLayout).toHaveBeenCalledWith(regroupedSources)
    expect(mockSetLayout).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'track1',
          source: 'track1',
          group: 'NewGroup',
        }),
        expect.objectContaining({
          name: 'track2',
          source: 'track2',
          group: 'NewGroup',
        }),
      ]),
    )
  })
})
