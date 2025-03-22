describe('JBrowse embedded circular view', () => {
  it('track loads', () => {
    cy.visit('/')

    cy.findByTestId('chord--351172516-vcf-62853', { timeout: 30000 })
  })
})
