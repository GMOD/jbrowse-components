/* eslint-disable no-undef */
/// <reference types="cypress" />

describe('My First Test', () => {
  it('visits JBrowse', () => {
    cy.visit('/')

    // The splash screen succesfully loads
    cy.contains('Start a new session')
  })
})
