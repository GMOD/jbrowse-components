describe('JBrowse embedded view', () => {
  it('page loads', () => {
    cy.visit('/')
    cy.contains('JBrowse 2 React Linear Genome View Demo')
  })
  it('track loads', () => {
    cy.visit('/')

    // eslint-disable-next-line testing-library/await-async-query,testing-library/prefer-screen-queries
    cy.findByTestId('Blockset-pileup', { timeout: 30000 }).findByTestId(
      'prerendered_canvas_{volvox}ctgA:1..51-0_done',
      { timeout: 30000 },
    )
  })
})
