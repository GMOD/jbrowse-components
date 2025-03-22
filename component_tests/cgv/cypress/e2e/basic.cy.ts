describe('JBrowse embedded circular view', () => {
  it('track loads', () => {
    cy.visit('/')

    cy.findByTestId('chord-adp--351172516-vcf-62999', { timeout: 30000 })
  })
})
