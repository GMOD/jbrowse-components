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

    const hitsBucketNums = bucketHits.toArray().map( value => bucketHits.toString().length - 1 - value )

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
 * @param { string } root - parent directory where bigsi rows are stored
 * @param { array of bloom filters } queryFragmentsBloomFilters - an array of Bloom filters with fragment 
 * minimizers inserted
 * @param { object } bigsiHits - empty object for storing query hits
 *
 * @return { object } filteredBigsiHits - object containing fragment hits in the bigsi buckets
 */
async function queryBitBigsi(root, queryFragmentsBloomFilters){

    let bigsiHits = {}

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

/**
 * @param { array of strings } hexBigsi - array of hexstrings for each row of 
 * bigsi
 *
 * @returns { array of strings } submatrix - array of hexstrings of query rows 
 * submatrix
 */
function getHexBigsiSubmatrix(hexBigsi, rowFilter){
    let submatrix = []

    rowFilter.forEach(i => submatrix.push(hexBigsi[i]));

    return submatrix

}

/**
 * @param { array of strings } submatrix - array of hexstrings for query rows 
 * of bigsi
 * @param { bigsiHits } bigsiHits - empty object for storing returned hits 
 */
function computeHexSubmatrixHits(submatrix, bigsiHits){
    let bucketHits = (new BitSet).flip() // init bitset to all 1s for bitwise AND
    for (let i = 0; i < submatrix.length; i++){
        const bs = BitSet.fromHexString(submatrix[i])
        bucketHits = bucketHits.and(bs)
    }

    const bucketIds = bucketHits.toArray()
    console.log(bucketIds)
    console.log(bigsiHits)
    bucketIds.forEach(bucket => bigsiHits[bucket]['hits'] += 1)

}
    
/** 
 * @param { array of strings } bigsi - bigsi matrix as array of hexstrings
 * @param { array of bloom filters } queryFragmentsBloomFilters - an array of Bloom filters with fragment 
 * minimizers inserted
 * @param { object } bigsiHits - empty object for storing query hits
 *
 * @return { object } filteredBigsiHits - object containing fragment hits in the bigsi buckets
 */
async function queryHexBigsi(bigsi, queryFragmentsBloomFilters, bigsiHits){

    const numFragments = queryFragmentsBloomFilters.length
    console.log('number of query BFs: ', queryFragmentsBloomFilters.length)

    for (let m = 0; m < queryFragmentsBloomFilters.length; m++){
        const queryBFOnesIndices = getQueryBloomFilterOnesIndices(queryFragmentsBloomFilters[m]._filter)
        
        const querySubmatrix = getHexBigsiSubmatrix(bigsi, queryBFOnesIndices)
        computeHexSubmatrixHits(querySubmatrix, bigsiHits)
    }

    for (let bucketId in bigsiHits) {
        if (bigsiHits.hasOwnProperty(bucketId)) {
            bigsiHits[bucketId]['score'] = bigsiHits[bucketId]['hits']/numFragments;
        }
    }

    const filteredBigsiHits = Object.fromEntries(
        Object.entries(bigsiHits).filter(([key, value]) => value.score > 0) 
    )

    return filteredBigsiHits
}

function getBigsiSubmatrix(bigsi, rowFilter){
    /* Inputs:
     *  bigsi -- bigsi matrix object
     *  rowFilter -- array of row indices to be extracted
     *
     * Outputs:
     *  submatrix -- resulting submatrix from extracting rows
     *
     */
    let submatrix = []
    for (i = 0; i < rowFilter.length; i++){
        const row = bigsi(rowFilter[i])
        submatrix.push(row)
    }

    submatrix = matrix(submatrix).trans()

    return submatrix

}

function computeSubmatrixHits(submatrix, bigsiHits, BFFalsePositiveProb=0.82, hitFalsePositiveProb=0.001){
    /* Inputs:
     *  submatrix -- bigsi array of arrays of hit rows
     *  bigsiHits -- object to store hits results for each bucket in bigsi
     *  BFFalsePositiveProb -- probability of a false positive for a Bloom Filter 
     *      query
     *  hitFalsePositiveProb -- set probability for the false positive of a hit
     *
     * Outputs:
     *  bigsiHits -- with updated hits property for each bucket
     *
     */
    const thresholdProbability = 1 - hitFalsePositiveProb

    for (let bucketNum = 0; bucketNum < submatrix.length; bucketNum++){
        rowsum = submatrix[bucketNum].reduce((a, b) => a + b, 0)
        const score = cdf(rowsum, submatrix[bucketNum].length, BFFalsePositiveProb)

        if (score >= thresholdProbability){
            bigsiHits[bucketNum]['hits'] += 1
        }
    }

}

async function queryBigsi(bigsi, queryFragmentsBloomFilters, bigsiHits){
    /* Inputs:
     *  bigsi -- bigsi matrix
     *  queryFragmentsBloomFilters -- an array of Bloom filters with fragment 
     *  minimizers inserted
     *
     * Outputs:
     *  filteredBigsiHits -- object containing fragment hits in the bigsi buckets
     *  
     */

    const numFragments = queryFragmentsBloomFilters.length
    console.log('number of query BFs: ', queryFragmentsBloomFilters.length)

    for (let m = 0; m < queryFragmentsBloomFilters.length; m++){
        const queryBFOnesIndices = getQueryBloomFilterOnesIndices(queryFragmentsBloomFilters[m]._filter)
        
        const querySubmatrix = getBigsiSubmatrix(bigsi, queryBFOnesIndices)
        computeSubmatrixHits(querySubmatrix, bigsiHits)
    }

    for (let bucketId in bigsiHits) {
        if (bigsiHits.hasOwnProperty(bucketId)) {
            bigsiHits[bucketId]['score'] = bigsiHits[bucketId]['hits']/numFragments;
        }
    }

    const filteredBigsiHits = Object.fromEntries(
        Object.entries(bigsiHits).filter(([key, value]) => value.score > 0) 
    )

    return filteredBigsiHits
}

/**
 * @param { function } genomeBigsi - matrix containing bigsi of entire genome
 * @param { array of objects } genomeBigsiHits - array of empty objects for 
 *  storing query hits
 * @param { number } numBuckets - number of buckets
 *
 * @returns { array of objects } filteredGenomeBigsiHits - array of filtered 
 *  objects containing query hits 
 */
async function queryGenomeBigsis(genomeBigsi, queryFragmentsBloomFilters, genomeBigsiHits, numBuckets=10){
    let filteredGenomeBigsiHits = []
    for (let i=0; i < genomeBigsiHits.length; i++){
        const bigsiStartColumn = i*numBuckets
        const bigsiEndColumn = (bigsiStartColumn + numBuckets - 1)
        const seqBigsi = matrix(genomeBigsi([],[bigsiStartColumn,bigsiEndColumn]))
        const seqBigsiHits = genomeBigsiHits[i]
        const filteredSeqHits = await queryBigsi(seqBigsi, queryFragmentsBloomFilters, seqBigsiHits, numBuckets)
        filteredGenomeBigsiHits.push(filteredSeqHits)
    }

    return filteredGenomeBigsiHits
}


async function main(bigsi, querySeq){
    /* Inputs:
     *  bigsi -- bigsi JSON string
     *  querySeq -- query sequence string
     *
     * Outputs: 
     *  filteredBigsiHits -- object containing buckets with score > 0
     *
     */

    const queryFragmentsMinimizers = await makeQueryFragsMinimizers(querySeq)
    const queryBloomFilter = await makeQueryFragsBloomFilters(queryFragmentsMinimizers)


    //const genomeBigsiHits = await queryBigsi.initGenomeBigsiHits(genomeSeq)

    const root = 'http://localhost:3001/binary_bigsi'
    const filteredBigsiHits = await queryBitBigsi(root, queryBloomFilter)

    return filteredBigsiHits
}

module.exports = {
    makeQueryFragsMinimizers: makeQueryFragsMinimizers,
    makeQueryFragsBloomFilters: makeQueryFragsBloomFilters,
    getQueryBloomFilterOnesIndices: getQueryBloomFilterOnesIndices,
    initBigsiHits: initBigsiHits,
    initGenomeBigsiHits: initGenomeBigsiHits,
    getBitBigsiSubmatrix: getBitBigsiSubmatrix,
    computeBitSubmatrixHits: computeBitSubmatrixHits,
    queryBitBigsi: queryBitBigsi,
    getHexBigsiSubmatrix: getHexBigsiSubmatrix,
    computeHexSubmatrixHits: computeHexSubmatrixHits,
    queryHexBigsi: queryHexBigsi,
    getBigsiSubmatrix: getBigsiSubmatrix,
    computeSubmatrixHits: computeSubmatrixHits,
    queryBigsi: queryBigsi,
    queryGenomeBigsis: queryGenomeBigsis,
    main: main,
}
