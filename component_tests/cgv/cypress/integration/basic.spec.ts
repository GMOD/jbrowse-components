describe('JBrowse embedded circular view', () => {
  it('track loads', () => {
    cy.visit('/')

    // eslint-disable-next-line testing-library/await-async-query,testing-library/prefer-screen-queries
    cy.findByTestId('chord-1240051623-vcf-6924368', { timeout: 10000 })
  })
})
