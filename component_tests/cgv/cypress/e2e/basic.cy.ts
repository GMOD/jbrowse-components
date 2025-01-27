describe('JBrowse embedded circular view', () => {
  it('track loads', () => {
    cy.visit('/')

    cy.findByTestId('chord--351172516-vcf-63101', { timeout: 30000 })
  })
})
