/* eslint-disable no-undef */
/// <reference types="cypress" />

describe('My First Test', () => {
  it('visits JBrowse', () => {
    // You can put JBrowse 2 into any session you want this way
    // at the beginning of your test!
    cy.exec('cp cypress/fixtures/hello_view.json .jbrowse')
    cy.visit('/?config=hello_view.json')

    // The plugin succesfully loads
    cy.contains('Hello plugin developers!')
  })
})
