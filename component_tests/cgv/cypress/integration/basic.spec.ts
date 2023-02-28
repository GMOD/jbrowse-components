describe('JBrowse embedded circular view', () => {
  it('track loads', () => {
    cy.visit('/')

    // eslint-disable-next-line testing-library/await-async-query,testing-library/prefer-screen-queries
    cy.findByTestId('chord-1148282975-vcf-63101', { timeout: 30000 })
  })
})
