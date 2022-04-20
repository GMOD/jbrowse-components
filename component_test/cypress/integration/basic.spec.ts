describe('JBrowse embedded view', () => {
  it('page loads', () => {
    cy.visit('/')
    cy.contains('JBrowse 2 React Linear Genome View Demo')
  })
  it('track loads', () => {
    cy.visit('/')
    // eslint-disable-next-line testing-library/await-async-query,testing-library/prefer-screen-queries
    cy.findByTestId('Blockset-pileup').findByTestId(
      'prerendered_canvas_{GRCh38}10:29,838,733..29,838,818-0',
      { timeout: 10000 },
    )
  })
})
