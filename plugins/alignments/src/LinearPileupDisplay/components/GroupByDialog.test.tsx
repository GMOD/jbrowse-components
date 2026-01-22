import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import * as coreUtil from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Import the actual functions we'll spy on
import GroupByDialog from './GroupByDialog.tsx'
import * as getUniqueTagsModule from '../../shared/getUniqueTags.ts'

describe('GroupByDialog', () => {
  let mockModel: any
  let mockTrack: any
  let mockView: any
  let mockSession: any
  let handleClose: jest.Mock
  let getSessionSpy: jest.SpyInstance
  let getContainingTrackSpy: jest.SpyInstance
  let getContainingViewSpy: jest.SpyInstance
  let useDeBounceSpy: jest.SpyInstance
  let getUniqueTagsSpy: jest.SpyInstance

  beforeEach(() => {
    mockSession = {
      addTrackConf: jest.fn(),
    }

    mockView = {
      staticBlocks: {
        contentBlocks: [{ refName: 'chr1', start: 0, end: 1000 }],
      },
      showTrack: jest.fn(),
    }

    mockTrack = {
      configuration: {
        trackId: 'test-track',
        name: 'Test Track',
      },
    }

    mockModel = {
      adapterConfig: {},
      configuration: {},
    }

    handleClose = jest.fn()

    // Setup spies
    getSessionSpy = jest
      .spyOn(coreUtil, 'getSession')
      .mockReturnValue(mockSession)
    getContainingTrackSpy = jest
      .spyOn(coreUtil, 'getContainingTrack')
      .mockReturnValue(mockTrack)
    getContainingViewSpy = jest
      .spyOn(coreUtil, 'getContainingView')
      .mockReturnValue(mockView)
    useDeBounceSpy = jest
      .spyOn(coreUtil, 'useDebounce')
      .mockImplementation((value: unknown) => value)
    // Default mock for getUniqueTags - individual tests can override
    getUniqueTagsSpy = jest
      .spyOn(getUniqueTagsModule, 'getUniqueTags')
      .mockResolvedValue([])
  })

  afterEach(() => {
    getSessionSpy.mockRestore()
    getContainingTrackSpy.mockRestore()
    getContainingViewSpy.mockRestore()
    useDeBounceSpy.mockRestore()
    getUniqueTagsSpy.mockRestore()
  })

  function renderDialog() {
    return render(
      <ThemeProvider theme={createJBrowseTheme()}>
        <GroupByDialog model={mockModel} handleClose={handleClose} />
      </ThemeProvider>,
    )
  }

  test('renders dialog with initial state', () => {
    renderDialog()

    expect(screen.getByText('Group by')).toBeInTheDocument()
    expect(screen.getByLabelText('Group by...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })

  test('enables submit button when strand type is selected', async () => {
    const user = userEvent.setup()
    renderDialog()

    const groupBySelect = screen.getByLabelText('Group by...')
    await user.click(groupBySelect)

    const strandOption = screen.getByRole('option', { name: 'Strand' })
    await user.click(strandOption)

    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
  })

  test('shows tag input when tag type is selected', async () => {
    const user = userEvent.setup()
    renderDialog()

    const groupBySelect = screen.getByLabelText('Group by...')
    await user.click(groupBySelect)

    const tagOption = screen.getByRole('option', { name: 'Tag' })
    await user.click(tagOption)

    expect(screen.getByPlaceholderText('Enter tag name')).toBeInTheDocument()
    expect(
      screen.getByText('Examples: HP for haplotype, RG for read group, etc.'),
    ).toBeInTheDocument()
  })

  test('validates tag input', async () => {
    const user = userEvent.setup()
    renderDialog()

    const groupBySelect = screen.getByLabelText('Group by...')
    await user.click(groupBySelect)
    await user.click(screen.getByRole('option', { name: 'Tag' }))

    const tagInput = screen.getByPlaceholderText('Enter tag name')

    // Invalid tag: number first
    await user.type(tagInput, '1A')
    expect(screen.getByText('Not a valid tag')).toBeInTheDocument()

    // Clear and enter valid tag
    await user.clear(tagInput)
    await user.type(tagInput, 'HP')
    expect(screen.queryByText('Not a valid tag')).not.toBeInTheDocument()
  })

  test('fetches unique tags when valid tag is entered', async () => {
    const user = userEvent.setup()
    getUniqueTagsSpy.mockResolvedValue(['1', '2', 'untagged'])

    renderDialog()

    const groupBySelect = screen.getByLabelText('Group by...')
    await user.click(groupBySelect)
    await user.click(screen.getByRole('option', { name: 'Tag' }))

    const tagInput = screen.getByPlaceholderText('Enter tag name')
    await user.type(tagInput, 'HP')

    await waitFor(() => {
      expect(getUniqueTagsSpy).toHaveBeenCalledWith({
        self: mockModel,
        tag: 'HP',
        blocks: mockView.staticBlocks,
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Found unique HP values:')).toBeInTheDocument()
      expect(screen.getByText('1, 2, untagged')).toBeInTheDocument()
    })
  })

  test('button is disabled while loading tags', async () => {
    const user = userEvent.setup()
    let resolvePromise: (value: string[]) => void
    getUniqueTagsSpy.mockReturnValue(
      new Promise(resolve => {
        resolvePromise = resolve
      }),
    )

    renderDialog()

    const groupBySelect = screen.getByLabelText('Group by...')
    await user.click(groupBySelect)
    await user.click(screen.getByRole('option', { name: 'Tag' }))

    const tagInput = screen.getByPlaceholderText('Enter tag name')
    await user.type(tagInput, 'HP')

    // Button should be disabled while loading
    await waitFor(() => {
      expect(
        screen.getByText('Loading unique tags', { exact: false }),
      ).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()

    // Resolve the promise
    resolvePromise!(['1', '2'])

    // Button should be enabled after loading
    await waitFor(() => {
      expect(
        screen.queryByText('Loading unique tags', { exact: false }),
      ).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
    })
  })

  test('button remains disabled if tag fetch returns empty array', async () => {
    const user = userEvent.setup()
    getUniqueTagsSpy.mockResolvedValue([])

    renderDialog()

    const groupBySelect = screen.getByLabelText('Group by...')
    await user.click(groupBySelect)
    await user.click(screen.getByRole('option', { name: 'Tag' }))

    const tagInput = screen.getByPlaceholderText('Enter tag name')
    await user.type(tagInput, 'HP')

    await waitFor(() => {
      expect(getUniqueTagsSpy).toHaveBeenCalled()
    })

    // Should show message that no values were found
    await waitFor(() => {
      expect(screen.getByText(/No values found for tag HP/)).toBeInTheDocument()
    })

    // Button should remain disabled with empty tagSet
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })

  test('handles errors when fetching tags', async () => {
    const user = userEvent.setup()
    const consoleError = jest.spyOn(console, 'error').mockImplementation()
    getUniqueTagsSpy.mockRejectedValue(new Error('Network error'))

    renderDialog()

    const groupBySelect = screen.getByLabelText('Group by...')
    await user.click(groupBySelect)
    await user.click(screen.getByRole('option', { name: 'Tag' }))

    const tagInput = screen.getByPlaceholderText('Enter tag name')
    await user.type(tagInput, 'HP')

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })

    consoleError.mockRestore()
  })

  test('does not fetch tags when type is not tag', async () => {
    const user = userEvent.setup()
    renderDialog()

    const groupBySelect = screen.getByLabelText('Group by...')
    await user.click(groupBySelect)
    await user.click(screen.getByRole('option', { name: 'Strand' }))

    // Wait a bit to ensure no fetch happens
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(getUniqueTagsSpy).not.toHaveBeenCalled()
  })

  test('resets tagSet when switching from tag to strand', async () => {
    const user = userEvent.setup()
    getUniqueTagsSpy.mockResolvedValue(['1', '2'])

    renderDialog()

    const groupBySelect = screen.getByLabelText('Group by...')
    await user.click(groupBySelect)
    await user.click(screen.getByRole('option', { name: 'Tag' }))

    const tagInput = screen.getByPlaceholderText('Enter tag name')
    await user.type(tagInput, 'HP')

    await waitFor(() => {
      expect(screen.getByText('Found unique HP values:')).toBeInTheDocument()
    })

    // Switch to strand
    await user.click(groupBySelect)
    await user.click(screen.getByRole('option', { name: 'Strand' }))

    // Tag input and results should be gone
    expect(
      screen.queryByText('Found unique HP values:'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText('Enter tag name'),
    ).not.toBeInTheDocument()
  })

  test('submits with tag grouping and creates tracks', async () => {
    const user = userEvent.setup()
    getUniqueTagsSpy.mockResolvedValue(['1', '2'])

    renderDialog()

    const groupBySelect = screen.getByLabelText('Group by...')
    await user.click(groupBySelect)
    await user.click(screen.getByRole('option', { name: 'Tag' }))

    const tagInput = screen.getByPlaceholderText('Enter tag name')
    await user.type(tagInput, 'HP')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
    })

    const submitButton = screen.getByRole('button', { name: 'Submit' })
    await user.click(submitButton)

    // Should create 3 tracks: one for each value plus one for undefined
    expect(mockSession.addTrackConf).toHaveBeenCalledTimes(3)
    expect(mockView.showTrack).toHaveBeenCalledTimes(3)

    // Check that tracks were created with correct filter
    const calls = mockSession.addTrackConf.mock.calls
    expect(calls[0][0].name).toContain('HP:1')
    expect(calls[0][0].displays[0].pileupDisplay.filterBy.tagFilter).toEqual({
      tag: 'HP',
      value: '1',
    })
    expect(calls[1][0].name).toContain('HP:2')
    expect(calls[2][0].name).toContain('HP:undefined')

    expect(handleClose).toHaveBeenCalled()
  })

  test('submits with strand grouping and creates tracks', async () => {
    const user = userEvent.setup()

    renderDialog()

    const groupBySelect = screen.getByLabelText('Group by...')
    await user.click(groupBySelect)
    await user.click(screen.getByRole('option', { name: 'Strand' }))

    const submitButton = screen.getByRole('button', { name: 'Submit' })
    await user.click(submitButton)

    // Should create 2 tracks: one for + strand, one for - strand
    expect(mockSession.addTrackConf).toHaveBeenCalledTimes(2)
    expect(mockView.showTrack).toHaveBeenCalledTimes(2)

    // Check track names contain strand info
    const calls = mockSession.addTrackConf.mock.calls
    expect(calls[0][0].name).toContain('(-)')
    expect(calls[1][0].name).toContain('(+)')

    // Check trackIds use 'strand' not 'tag'
    expect(calls[0][0].trackId).toContain('strand:')
    expect(calls[1][0].trackId).toContain('strand:')

    expect(handleClose).toHaveBeenCalled()
  })

  test('cancel button closes dialog without creating tracks', async () => {
    const user = userEvent.setup()
    renderDialog()

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    await user.click(cancelButton)

    expect(mockSession.addTrackConf).not.toHaveBeenCalled()
    expect(mockView.showTrack).not.toHaveBeenCalled()
    expect(handleClose).toHaveBeenCalled()
  })

  test('does not fetch tags for invalid tag length', async () => {
    const user = userEvent.setup()
    renderDialog()

    const groupBySelect = screen.getByLabelText('Group by...')
    await user.click(groupBySelect)
    await user.click(screen.getByRole('option', { name: 'Tag' }))

    const tagInput = screen.getByPlaceholderText('Enter tag name')

    // Single character - should not fetch
    await user.type(tagInput, 'H')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(getUniqueTagsSpy).not.toHaveBeenCalled()

    // Clear and type valid 2-char tag
    await user.clear(tagInput)
    await user.type(tagInput, 'HP')

    getUniqueTagsSpy.mockResolvedValue(['1', '2'])
    await waitFor(() => {
      expect(getUniqueTagsSpy).toHaveBeenCalled()
    })
  })
})
