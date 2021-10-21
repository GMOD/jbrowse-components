const cdf = require('binomial-cdf')
const matrix = require('matrix-js')
const BitSet = require('bitset')
const fs = require('fs')
const commonFunc = require('./common_func.js')

async function makeQueryFragsMinimizers(querySeq, fragmentSize=2500){
    /* Inputs:
     *  querySeq -- query sequence string
     *  fragmentSize -- minimum size of fragments of query
     *
     * Outputs:
     *  queryFragmentsMinimizers -- an array of minimizer arrays for each fragment in the query
     *
     */

    const querySize = querySeq.length

    const queryFragmentsMinimizers = []

    if (querySize <= 300000 && querySize >= 5000){

        for (let n=0; n < Math.floor(querySize/fragmentSize); n++){
            const start = n*fragmentSize
            const end = Math.min(start + fragmentSize, querySize)
            const queryFragmentSeq = querySeq.slice(start, end)
            const queryFragmentMinimizers = commonFunc.extractMinimizers(queryFragmentSeq)
            queryFragmentsMinimizers.push(queryFragmentMinimizers)
        }
    } else { console.error("Inappropriate query size") }

    return queryFragmentsMinimizers
}

function makeQueryFragsBloomFilters(queryFragmentsMinimizers){
    /* Inputs:
     *  queryFragmentsMinimizers -- an array of minimizer arrays for each fragment 
     *      in query
     *
     * Outputs:
     *  queryFragmentsBloomFilters -- an array of Bloom filters with fragment 
     *  minimizers inserted
     *
     */

    const queryFragmentsBloomFilters = []
    for (let j=0; j < queryFragmentsMinimizers.length; j++){
        const queryFragmentMinimizers = queryFragmentsMinimizers[j]

        const queryBloomFilter = commonFunc.makeMinimizersBloomFilter(queryFragmentMinimizers)
        queryFragmentsBloomFilters.push(queryBloomFilter)
    }

    return queryFragmentsBloomFilters
}

function getQueryBloomFilterOnesIndices(queryBloomFilter){
    return queryBloomFilter.reduce((indices, number, index) => {
        if (number != 0) indices.push(index)
        return indices
    }, [])

}

function initBigsiHits(seqSize, seqName, numBuckets=10, overhang=300000){
    /* Inputs:
     *  seqSize -- size of the sequence
     *  seqName -- name of sequence
     *  numBuckets -- number of buckets for reference
     *  overhang -- bucket overhangs (equal to upper bound of query sequence length)
     *
     * Outputs:
     *  bigsiHits -- object containing information for each bucket
     *      e.g { 0: {refName: "1", start: 0, end: 1, hits: 0 } }
     *
     */
    const bucketSize = Math.round(seqSize/(numBuckets-1))

    const bigsiHits = {} 
    for (let bucketNum=0; bucketNum < numBuckets; bucketNum++){
        bigsiHits[bucketNum] = {}

        if (bucketNum == 0){
            bigsiHits[bucketNum] = Object.assign(
                {
                    refName: seqName,
                    start: 0,
                    end: bucketSize,
                    hits: 0,
                    score: 0,
                }, 
                bigsiHits[bucketNum])
        } else {
            const intervalStart = (bucketNum*(bucketSize-overhang))+1
            let intervalEnd = intervalStart + bucketSize

            if (bucketNum == numBuckets - 1){
                intervalEnd = seqSize
            }

            bigsiHits[bucketNum] = Object.assign(
                {
                    refName: seqName,
                    start: intervalStart,
                    end: intervalEnd,
                    hits: 0,
                    score: 0,
                }, 
                bigsiHits[bucketNum]
            )
        }
    }

    return bigsiHits
}

/**
 * @param { IndexedFasta} genome - IndexedFasta seq object of genome
 *
 * @returns { array of objects } genomeBigsiHits - array of empty objects for storing query hits
 */
async function initGenomeBigsiHits(genome){
    const filteredSeqNames = await commonFunc.getFilteredGenomeSeqs(genome)
    const genomeBigsiHits = []
    for (let i=0; i < filteredSeqNames.length; i++){
        const seqName = filteredSeqNames[i]
        const seqSize = await genome.getSequenceSize(seqName)
        const seqBigsiHits = initBigsiHits(seqSize, parseInt(i+1))

        genomeBigsiHits.push(seqBigsiHits)
    }

    return genomeBigsiHits
}

/**
 * @param { string } root - parent directory where bigsi is stored
 * @param { array of numbers } rowFilter - array of row numbers for query rows
 *
 * @returns { array of strings } submatrix - array of bitsets of query rows 
 * submatrix
 */
async function getBitBigsiSubmatrix(root, rowFilter){
    const submatrix = []

    for (let i = 0; i < rowFilter.length; i++){
        const rowPath = commonFunc.makeBigsiRowPath(rowFilter[i], root)
        submatrix.push(rowPath)
    }
        //console.log(rowPath)

    return Promise.all(
        submatrix.map( rowPath => 
            fetch(rowPath)
                .then( async (response) => { 
                    const bigsiArrBuf = await response.arrayBuffer()
                    const array = new Uint8Array(bigsiArrBuf);
                    const bs = new BitSet(array)
        //            //console.log('arrayBuf', bigsiArrBuf)
        //            //console.log('array', array)
        //            //console.log('bitset', bs)
                    return bs
                })
        )
    )
}


/** Converts a buffer to a u16 typed array
 */
function toArrayBuffer(buffer) {
    const buf = new ArrayBuffer(buffer.length);
    const view = new Uint16Array(buf);
    for (let i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return buf;
}

/**
 * @param { Uint16Array } bigsi - flattened bigsi 
 * @param { array of numbers } rowFilter - array of row numbers for query rows
 * @param { number } numCols - number of columns in bigsi
 *
 * @returns { array of strings } submatrix - array of bitsets of query rows 
 * submatrix
 */
async function getBinaryDumpBigsiSubmatrix(bigsi, rowFilter, numCols){
    const submatrix = []

    try {
        const numSeqs = numCols/16

        for (const rowNum of rowFilter){

            const offsetStart = rowNum*numSeqs
            const offsetEnd = offsetStart + numSeqs
            //console.log('offsets: ', offsetStart, offsetEnd)
            //console.log('ints: ', bigsi.slice(offsetStart, offsetEnd))

            const rowBitString = Array.from(bigsi.slice(offsetStart, offsetEnd))
                .map((num) => {return num.toString(2)})
                .join('')
            //console.log('bitstring: ', rowBitString)
            const bs = new BitSet(rowBitString)
            submatrix.push(bs);
        }
    } catch(err) {
        console.log(err)
    }


    return submatrix
}

/**
 * @param { array of strings } submatrix - array of bitsets for query rows 
 * of bigsi
 * @param { bigsiHits } bigsiHits - empty object for storing returned hits 
 *
 * @returns - bigsiHits with updated hits attributes 
 */
function computeBitSubmatrixHits(submatrix, bigsiHits){
    let bucketHits = (new BitSet).flip() // init bitset to all 1s for bitwise AND
    for (let i = 0; i < submatrix.length; i++){
        bucketHits = bucketHits.and(submatrix[i])
    }

    const hitsBucketNums = bucketHits.toArray().map( value => 31 - value )

    for (let i = 0; i < hitsBucketNums.length; i++){
        const bucketNum = hitsBucketNums[i]
        if (bucketNum in bigsiHits){
            bigsiHits[bucketNum]['hits'] += 1
        } else {
            bigsiHits[bucketNum] = {'hits': 1}
        }

    }
}

/** 
 * @param { string } filename - name of binary dump bigsi file
 * @param { array of bloom filters } queryFragmentsBloomFilters - an array of Bloom filters with fragment 
 * minimizers inserted
 * @param { string } numCols - number of columns in bigsi
 *
 * @return { object } filteredBigsiHits - object containing fragment hits in the bigsi buckets
 */
async function queryBinaryDumpBigsi(filename, queryFragmentsBloomFilters, numCols){

    const bigsiHits = {}

    const numFragments = queryFragmentsBloomFilters.length
    console.log('number of query BFs: ', queryFragmentsBloomFilters.length)

    const response = await fetch(filename)
    const bigsiRowBuf = await response.arrayBuffer()
    console.log('num bytes in the bigsirowbuf:', bigsiRowBuf.byteLength)

    const array = new Uint16Array(bigsiRowBuf);
    console.log('array size: ', array.length)

    for (let m = 0; m < queryFragmentsBloomFilters.length; m++){
        const queryBFOnesIndices = getQueryBloomFilterOnesIndices(queryFragmentsBloomFilters[m]._filter)
        
        const querySubmatrix = await getBinaryDumpBigsiSubmatrix(array, queryBFOnesIndices, numCols)
        computeBitSubmatrixHits(querySubmatrix, bigsiHits)
    }

    for (let bucketId in bigsiHits) {
        bigsiHits[bucketId]['score'] = `${bigsiHits[bucketId]['hits']}/${numFragments}`;
    }

    return bigsiHits
}

/** 
 * @param { string } root - parent directory where bigsi rows are stored
 * @param { array of bloom filters } queryFragmentsBloomFilters - an array of Bloom filters with fragment 
 * minimizers inserted
 * @param { object } bigsiHits - empty object for storing query hits
 *
 * @return { object } filteredBigsiHits - object containing fragment hits in the bigsi buckets
 */
async function queryBitBigsi(root, queryFragmentsBloomFilters){

    const bigsiHits = {}

    const numFragments = queryFragmentsBloomFilters.length
    console.log('number of query BFs: ', queryFragmentsBloomFilters.length)

    for (let m = 0; m < numFragments; m++){
        const queryBFOnesIndices = getQueryBloomFilterOnesIndices(queryFragmentsBloomFilters[m]._filter)
        const querySubmatrix = await getBitBigsiSubmatrix(root, queryBFOnesIndices)
        computeBitSubmatrixHits(querySubmatrix, bigsiHits)
    }

    for (let bucketId in bigsiHits) {
        bigsiHits[bucketId]['score'] = `${bigsiHits[bucketId]['hits']}/${numFragments}`;
    }

    return bigsiHits
}

async function runBinaryBigsiQuery(querySeq) {
    const queryFragmentsMinimizers = await makeQueryFragsMinimizers(querySeq)
    const queryBloomFilter = await makeQueryFragsBloomFilters(queryFragmentsMinimizers)

    const path = 'http://localhost:3001/public/hg38_16int_bdump.bin'
    const numCols = 32
    const filteredBigsiHits = await queryBinaryDumpBigsi(path, queryBloomFilter, numCols)

    return filteredBigsiHits
}

module.exports = {
    makeQueryFragsMinimizers: makeQueryFragsMinimizers,
    makeQueryFragsBloomFilters: makeQueryFragsBloomFilters,
    getQueryBloomFilterOnesIndices: getQueryBloomFilterOnesIndices,
    initBigsiHits: initBigsiHits,
    initGenomeBigsiHits: initGenomeBigsiHits,
    getBinaryDumpBigsiSubmatrix: getBinaryDumpBigsiSubmatrix,
    getBitBigsiSubmatrix: getBitBigsiSubmatrix,
    computeBitSubmatrixHits: computeBitSubmatrixHits,
    queryBinaryDumpBigsi: queryBinaryDumpBigsi,
    queryBitBigsi: queryBitBigsi,
    runBinaryBigsiQuery: runBinaryBigsiQuery,
}
