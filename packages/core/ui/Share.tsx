// all notes for session sharing go here
// shared sessionid is hash of session
// in url, there is a uuid sessionid, this is diff than the hash
// when user pastes a hashed sessionid url, it downloads the session into localstorage, then assigns a new sessionid

// AWS side
// API Gateway
// - APIgateway with two endpoints
// - should be 2 POSTS, one to write a saved session and one to look up a saved session
// DONE

// Lambda
// code in save-session and read-session
// DONE

// DynamoDB
// -table created, has sessionId which is a primary key, sha-256 hash of the session contents
// and session, a string provided by JBrowse

// JB2 side
// -create a share UI button
// -onClick(), it uses fetchPOSTS to the api endpoint with the session URL and the sessionId which is a hash of the url, which triggers the lambda to
// write to dynamoDB
// -when navigating to a URL and parsing the session, JB2 POSTS to the api endpoint with the session URL entered
// if it's found also in the database, load the current session into local storage

function Share() {}
export default Share
