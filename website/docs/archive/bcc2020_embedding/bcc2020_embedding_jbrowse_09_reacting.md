---
id: bcc2020_embedding_jbrowse_09_reacting
title: Reacting to the view
---

:::danger Out of date

Please see the
[updated version of this tutorial](/docs/tutorials/embed_linear_genome_view/01_introduction).

:::

You can not only control the view, you can react to it as well. By providing an
onChange function, you can have other things on the page change when the view
changes.

## Set up a change listener

We are going to add a text box that adds each update as it happens. These
updates are "patches," and they describe how the session is modified with each
change.

Make the following changes to "index.html":

```html {18,24-26,45-52} title="index.html"
<html>
  <head>
    <script src="//s3.amazonaws.com/jbrowse.org/jb2_releases/jbrowse-linear-view/jbrowse-linear-view@v0.0.1-beta.0/umd/jbrowse-linear-view.js"></script>
  </head>

  <body>
    <h1>We're using JBrowse Linear View!</h1>
    <button data-type="gene_button" data-location="10:94762681..94855547">
      CYP2C19
    </button>
    <button data-type="gene_button" data-location="13:32315086..32400266">
      BRCA2
    </button>
    <div id="jbrowse_linear_view"></div>
    <script type="module">
      import assembly from './assembly.js'
      import tracks from './tracks.js'
      const updates = document.getElementById('update')
      const genomeView = new JBrowseLinearView({
        container: document.getElementById('jbrowse_linear_view'),
        assembly,
        tracks,
        location: '1:100,987,269..100,987,368',
        onChange: patch => {
          updates.innerHTML += JSON.stringify(patch) + '\n'
        },
      })

      function navTo(event) {
        genomeView.view.navToLocString(event.target.dataset.location)
      }
      const buttons = document.getElementsByTagName('button')
      for (const button of buttons) {
        if (button.dataset.type === 'gene_button') {
          button.addEventListener('click', navTo)
        }
      }
      const textArea = document.getElementById('viewstate')
      document.getElementById('showviewstate').addEventListener('click', () => {
        textArea.innerHTML = JSON.stringify(genomeView.view, undefined, 2)
      })
    </script>
    <button id="showviewstate">Show view state</button>
    <textarea id="viewstate" name="viewstate" rows="20" cols="80"></textarea>
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

Play around with the view and watch the patches that get generated. You can see
how the patches match up with the view state that we can show.
