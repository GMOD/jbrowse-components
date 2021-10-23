---
id: 08_reacting
title: Reacting to the view
---

This last section covers that basics of a bit less common of a use case, so if
it doesn't apply to you, you can feel free to skip it. In the previous section,
we explored how to control what was in the JBrowse Linear Genome View from other
elements on the page. What if, however, you want an element on the page to react
to what a user does inside the JBrowse Linear Genome View? For example, update a
list of genes when they switch to another chromosome, or they scroll to a
certain position.

This is possible with the JBrowse Linear Genome View by listening to the updates
it emits. This is done with an `onChange` function that is passed to
`createViewState`.

## Set up a change listener

We are going to add a text box that adds each update as it happens. Make the
following changes to "index.html":

```html {35,39-41,86-93} title="index.html"
<html>
  <head>
    <script
      src="//unpkg.com/react@16/umd/react.development.js"
      crossorigin
    ></script>
    <script
      src="//unpkg.com/react-dom@16/umd/react-dom.development.js"
      crossorigin
    ></script>
    <script
      src="//unpkg.com/@jbrowse/react-linear-genome-view/dist/react-linear-genome-view.umd.development.js"
      crossorigin
    ></script>
  </head>

  <body>
    <h1>We're using JBrowse Linear Genome View!</h1>
    <button data-type="gene_button" data-location="10:94762681..94855547">
      CYP2C19
    </button>
    <button data-type="gene_button" data-location="13:32315086..32400266">
      BRCA2
    </button>
    <div id="jbrowse_linear_genome_view"></div>
    <script type="module">
      import assembly from './assembly.js'
      import tracks from './tracks.js'
      const { createViewState, JBrowseLinearGenomeView } =
        JBrowseReactLinearGenomeView
      const { createElement } = React
      const { render } = ReactDOM
      const updates = document.getElementById('update')
      const state = new createViewState({
        assembly,
        tracks,
        onChange: patch => {
          updates.innerHTML += JSON.stringify(patch) + '\n'
        },
        location: '1:100,987,269..100,987,368',
        defaultSession: {
          name: 'my session',
          view: {
            id: 'linearGenomeView',
            type: 'LinearGenomeView',
            tracks: [
              {
                id: 'IpTYJKmsp',
                type: 'ReferenceSequenceTrack',
                configuration: 'GRCh38-ReferenceSequenceTrack',
                displays: [
                  {
                    id: 's877wHWtzD',
                    type: 'LinearReferenceSequenceDisplay',
                    configuration:
                      'GRCh38-ReferenceSequenceTrack-LinearReferenceSequenceDisplay',
                  },
                ],
              },
            ],
          },
        },
      })
      function navTo(event) {
        state.session.view.navToLocString(event.target.dataset.location)
      }
      const buttons = document.getElementsByTagName('button')
      for (const button of buttons) {
        if (button.dataset.type === 'gene_button') {
          button.addEventListener('click', navTo)
        }
      }
      const textArea = document.getElementById('session')
      document.getElementById('showsession').addEventListener('click', () => {
        textArea.innerHTML = JSON.stringify(state.session, undefined, 2)
      })
      render(
        createElement(JBrowseLinearGenomeView, { viewState: state }),
        document.getElementById('jbrowse_linear_genome_view'),
      )
    </script>
    <button id="showsession">Show current session</button>
    <textarea id="session" name="session" rows="20" cols="80"></textarea>
    <p>updates:</p>
    <textarea
      id="update"
      name="update"
      rows="5"
      cols="80"
      wrap="off"
    ></textarea>
  </body>
</html>
```

These updates are formatted as [JSON-patches](http://jsonpatch.com/), and they
describe how the session is modified with each change. Play around with the view
and watch the patches that get generated. You can see how the patches match up
with the view state that we can show. In your application, you would probably
have a callback that looks for changes on some "path" that you are interested
in, and reacts to which "op" happens on that path.
