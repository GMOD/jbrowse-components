var express = require('express');
var router = express.Router();
var fs = require('fs')
const BitSet = require('bitset')

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* GET bigsi dump file*/
router.get('/public/hg38_16int_bdump.bin', function(req, res){
    const path = `/Users/shihabdider/Research/Flashmap/jbrowse_demo/jbrowse-components/plugins/linear-genome-view/src/LinearGenomeView/components/bigsi/binarybigsi/public/hg38_16int_bdump.bin`
    const bigsiRowBuf = fs.readFileSync(path)
    //const array = new Uint16Array(bigsiRowBuf);
    //const bs = new BitSet(array)
    res.send(bigsiRowBuf)
})

module.exports = router;
