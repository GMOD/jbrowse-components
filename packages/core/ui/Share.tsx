// all notes for session sharing go here

// AWS side
// API Gateway
// -generated an API gateway using AWS Lamdba, has a single endpoint
// -https://r0q9f97jq2.execute-api.us-east-1.amazonaws.com/default/save-session-jbrowse
// -is the trigger for the lambda function and is a REST API
// -should be 2 POSTS, one to write a saved session and one to look up a saved session

// Lambda
// -Lambda function only has write, not read
// -need to link lambda to the specific dynamodb
// -need to make sure CORS policy is open

/** CODE BELOW **/
// const AWS = require("aws-sdk");
// const fsPromises = require("fs").promises;
// const util = require("util");

// const { AWS_REGION: region, sessionTable } = process.env;

// const dynamodb = new AWS.DynamoDB({ apiVersion: "2012-08-10", region });

// async function uploadSession(id, sessionId) {
//   const params = {
//     Item: {
//       sessionId: {
//         S: sessionId,
//       },
//     },
//     TableName: sessionTable,
//   };
//   return dynamodb.putItem(params).promise();
// }

// exports.handler = async (event, context) => {
//   const id = context.awsRequestId;
//   let sessionBase64;
//   try {
//     await uploadSession(id, sessionBase64);
//   } catch (e) {
//     const response = {
//       statusCode: 400,
//       body: JSON.stringify({ message: `${e}` }),
//     };
//     return response;
//   }

//   let buffer = new Buffer(sessionBase64, "base64");

//   const resultsUrl = `jbrowse.org/${buffer.toString("ascii")}`;
//   const response = {
//     statusCode: 200,
//     body: JSON.stringify({ resultsUrl }),
//   };
//   return response;
// };

// DynamoDB
// -table created, only has the primary key which should be the full session URL base64 encoded

// JB2 side
// -create a share UI button
// -onClick(), it POSTS to the api endpoint with the session URL encoded, which triggers the lambda to
// write to dynamoDB
// -when navigating to a URL and parsing the session, JB2 POSTS to the api endpoint with the session URL entered
// if it's found also in the database, load the current session into local storage

function Share() {}
export default Share
