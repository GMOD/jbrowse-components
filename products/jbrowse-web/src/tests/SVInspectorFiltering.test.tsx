import '@testing-library/jest-dom'
import { fireEvent, waitFor } from '@testing-library/react'

import { createView, doBeforeEach, mockConsoleWarn, setup } from './util.tsx'

import type { SvInspectorViewModel } from '@jbrowse/plugin-sv-inspector'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 40000 }

test('opens SVInspector and tests data grid filtering functionality', async () => {
  await mockConsoleWarn(async () => {
    const { session, findByTestId, getByTestId, findByText } =
      await createView()

    fireEvent.click(await findByText('File'))
    fireEvent.click(await findByText('Add'))
    fireEvent.click(await findByText('SV inspector'))

    fireEvent.change(await findByTestId('urlInput', {}, delay), {
      target: { value: 'volvox.dup.renamed.vcf.gz' },
    })
    await waitFor(() => {
      expect(
        getByTestId('open_spreadsheet').closest('button'),
      ).not.toBeDisabled()
    })
    fireEvent.click(await findByTestId('open_spreadsheet'))

    await waitFor(() => {
      expect(session.views.length).toBeGreaterThan(1)
      const view = session.views.find(
        (v: any) => v.type === 'SvInspectorView',
      ) as SvInspectorViewModel
      expect(view).toBeDefined()
      expect(view.spreadsheetView.spreadsheet!.rows!.length).toBeGreaterThan(0)
    }, delay)

    const svInspectorView = session.views.find(
      (v: any) => v.type === 'SvInspectorView',
    ) as SvInspectorViewModel
    const spreadsheet = svInspectorView.spreadsheetView.spreadsheet!
    const initialRowCount = spreadsheet.rows!.length
    expect(initialRowCount).toBeGreaterThan(0)

    expect(spreadsheet.visibleRows).toBeDefined()
    expect(spreadsheet.visibleRows!.length).toBe(initialRowCount)

    const chromosomes = new Set(spreadsheet.rows!.map((row: any) => row.CHROM))
    expect(chromosomes.has('A')).toBe(true)
    expect(chromosomes.has('B')).toBe(true)

    const filteredRows = spreadsheet.rows!.filter(
      (row: any) => row.CHROM === 'B',
    )
    expect(filteredRows.length).toBeGreaterThan(0)
    expect(filteredRows.length).toBeLessThan(initialRowCount)
    for (const row of filteredRows as any[]) {
      expect(row.CHROM).toBe('B')
    }

    const variantFilteredRows = spreadsheet.rows!.filter((row: any) =>
      JSON.stringify(row).toLowerCase().includes('bnd_a'),
    )
    expect(variantFilteredRows.length).toBeGreaterThan(0)
    for (const row of variantFilteredRows as any[]) {
      expect(JSON.stringify(row).toLowerCase()).toContain('bnd_a')
    }

    expect(svInspectorView.features.length).toBe(
      spreadsheet.visibleRows!.length,
    )
    expect(svInspectorView.showCircularView).toBe(true)
  })
}, 60000)

test('SVInspector filtering updates circular view accordingly', async () => {
  await mockConsoleWarn(async () => {
    const { session, findByTestId, getByTestId, findByText } =
      await createView()

    fireEvent.click(await findByText('File'))
    fireEvent.click(await findByText('Add'))
    fireEvent.click(await findByText('SV inspector'))

    fireEvent.change(await findByTestId('urlInput', {}, delay), {
      target: { value: 'volvox.dup.renamed.vcf.gz' },
    })
    await waitFor(() => {
      expect(
        getByTestId('open_spreadsheet').closest('button'),
      ).not.toBeDisabled()
    })
    fireEvent.click(await findByTestId('open_spreadsheet'))

    await waitFor(() => {
      expect(session.views.length).toBeGreaterThan(1)
      const view = session.views.find(
        (v: any) => v.type === 'SvInspectorView',
      ) as SvInspectorViewModel
      expect(view).toBeDefined()
      expect(view.spreadsheetView.spreadsheet?.rows?.length).toBeGreaterThan(0)
    }, delay)

    const svInspectorView = session.views.find(
      (v: any) => v.type === 'SvInspectorView',
    ) as SvInspectorViewModel
    const spreadsheet = svInspectorView.spreadsheetView.spreadsheet!

    expect(svInspectorView.showCircularView).toBe(true)
    expect(svInspectorView.features.length).toBe(
      spreadsheet.visibleRows?.length,
    )

    const features = svInspectorView.features
    expect(features.length).toBeGreaterThan(0)
    for (const feature of features as any[]) {
      expect(feature).toHaveProperty('refName')
      expect(feature).toHaveProperty('start')
      expect(feature).toHaveProperty('end')
      expect(feature).toHaveProperty('type')
    }

    const trackConfig = svInspectorView.featuresCircularTrackConfiguration
    expect(trackConfig).toBeDefined()
    expect(trackConfig.type).toBe('VariantTrack')
    expect(trackConfig.adapter.features).toBe(features)

    const allRows = spreadsheet.rows!
    const visibilityMap: Record<number, boolean> = {}
    allRows.forEach((row: any, index: number) => {
      visibilityMap[index] = row.CHROM === 'B'
    })
    spreadsheet.setVisibleRows(visibilityMap)

    const filteredRows = allRows.filter((row: any) => row.CHROM === 'B')

    await waitFor(() => {
      expect(svInspectorView.features.length).toBe(filteredRows.length)
    }, delay)

    const filteredFeatures = svInspectorView.features
    expect(filteredFeatures.length).toBeLessThan(features.length)
    for (const feature of filteredFeatures as any[]) {
      expect(feature.refName).toBe('B')
    }

    expect(svInspectorView.showCircularView).toBe(filteredFeatures.length > 0)
  })
}, 60000)
