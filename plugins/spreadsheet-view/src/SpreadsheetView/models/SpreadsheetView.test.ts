import SpreadsheetView from './SpreadsheetView'

describe('Spreadsheet View mst model', () => {
  it('can instantiate with empty args', () => {
    const view = SpreadsheetView.create({ type: 'SpreadsheetView' })
    expect(view).toBeTruthy()
  })
})
