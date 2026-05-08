import { renderHook, waitFor } from '@testing-library/react'

import { useFeatureSequence } from './useFeatureSequence.ts'

jest.mock('./fetchSeq.ts', () => ({
  fetchSeq: jest.fn(),
}))

import { fetchSeq } from './fetchSeq.ts'

const mockFetchSeq = jest.mocked(fetchSeq)

const mockSession = {} as Parameters<typeof useFeatureSequence>[0]['session']

const baseArgs = {
  session: mockSession,
  assemblyName: 'hg38',
  refName: 'chr1',
  start: 100,
  end: 200,
  upDownBp: 0,
  forceLoad: false,
}

beforeEach(() => {
  jest.resetAllMocks()
  mockFetchSeq.mockResolvedValue('ACGT')
})

test('returns nothing when session is absent', () => {
  const { result } = renderHook(() =>
    useFeatureSequence({ ...baseArgs, session: undefined }),
  )
  expect(result.current.sequence).toBeUndefined()
  expect(result.current.loading).toBe(false)
  expect(result.current.error).toBeUndefined()
})

test('returns nothing when assemblyName is absent', () => {
  const { result } = renderHook(() =>
    useFeatureSequence({ ...baseArgs, assemblyName: undefined }),
  )
  expect(result.current.sequence).toBeUndefined()
  expect(result.current.loading).toBe(false)
  expect(result.current.error).toBeUndefined()
})

test('returns nothing when shouldFetch is false', () => {
  const { result } = renderHook(() =>
    useFeatureSequence({ ...baseArgs, shouldFetch: false }),
  )
  expect(result.current.sequence).toBeUndefined()
  expect(result.current.loading).toBe(false)
  expect(result.current.error).toBeUndefined()
})

test('fetches and returns seq/upstream/downstream', async () => {
  mockFetchSeq
    .mockResolvedValueOnce('ACGT')
    .mockResolvedValueOnce('UP')
    .mockResolvedValueOnce('DOWN')

  const { result } = renderHook(() => useFeatureSequence(baseArgs))

  await waitFor(() => expect(result.current.sequence).toBeDefined())

  expect(result.current.sequence).toEqual({
    seq: 'ACGT',
    upstream: 'UP',
    downstream: 'DOWN',
  })
  expect(result.current.error).toBeUndefined()
})

test('returns error object (not thrown) when region exceeds BPLIMIT without forceLoad', async () => {
  const { result } = renderHook(() =>
    useFeatureSequence({ ...baseArgs, start: 0, end: 21_000_000 }),
  )

  await waitFor(() => expect(result.current.sequence).toBeDefined())

  expect(result.current.sequence).toMatchObject({
    error: expect.stringContaining('force load'),
  })
  expect(mockFetchSeq).not.toHaveBeenCalled()
})

test('fetches when region exceeds BPLIMIT but forceLoad is true', async () => {
  mockFetchSeq
    .mockResolvedValueOnce('SEQ')
    .mockResolvedValueOnce('')
    .mockResolvedValueOnce('')

  const { result } = renderHook(() =>
    useFeatureSequence({ ...baseArgs, start: 0, end: 21_000_000, forceLoad: true }),
  )

  await waitFor(() => expect(result.current.sequence).toBeDefined())

  expect(result.current.sequence).toEqual({ seq: 'SEQ', upstream: '', downstream: '' })
  expect(mockFetchSeq).toHaveBeenCalledTimes(3)
})

test('upDownBp expands upstream/downstream fetch regions', async () => {
  mockFetchSeq
    .mockResolvedValueOnce('SEQ')
    .mockResolvedValueOnce('UP')
    .mockResolvedValueOnce('DOWN')

  const { result } = renderHook(() =>
    useFeatureSequence({ ...baseArgs, start: 100, end: 200, upDownBp: 50 }),
  )

  await waitFor(() => expect(result.current.sequence).toBeDefined())

  expect(mockFetchSeq).toHaveBeenCalledWith(
    expect.objectContaining({ start: 100, end: 200 }),
  )
  expect(mockFetchSeq).toHaveBeenCalledWith(
    expect.objectContaining({ start: 50, end: 100 }),
  )
  expect(mockFetchSeq).toHaveBeenCalledWith(
    expect.objectContaining({ start: 200, end: 250 }),
  )
  expect(result.current.sequence).toEqual({ seq: 'SEQ', upstream: 'UP', downstream: 'DOWN' })
})

test('upstream start is clamped to 0', async () => {
  const { result } = renderHook(() =>
    useFeatureSequence({ ...baseArgs, start: 10, end: 20, upDownBp: 50 }),
  )

  await waitFor(() => expect(result.current.sequence).toBeDefined())

  expect(mockFetchSeq).toHaveBeenCalledWith(
    expect.objectContaining({ start: 0, end: 10 }),
  )
})
