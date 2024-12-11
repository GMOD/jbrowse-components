describe('JBrowse embedded circular view', () => {
  it('track loads', () => {
    cy.visit('/')

    cy.findByTestId('chord--470870972-vcf-62853', { timeout: 30000 })
  })
})
