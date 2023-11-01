import * as dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import debug from 'debug';
const debugDb = debug('app:Database');

/* Generate/Parse an ObjectId */
const newId = (str) => new ObjectId(str);

/* Global variable storing the open connection, do nor use it directly */
let _db = null;

/** Connect to the database */
async function connect() {
    if(!_db) {
        const dbUrl = process.env.DB_URL;
        const dbName = process.env.DB_NAME;
        const client = await MongoClient.connect(dbUrl);
        _db = client.db(dbName);
        debugDb('Connected.');
    }
    return _db;
}

/** Connect to the database and verify the connection */
async function ping() {
    const db = await connect();
    await db.command({ ping: 1 });
    debugDb('Ping.');
}

// FIXME: add more functions here
async function getUsers(){
    const db = await connect();
    const users = await db.collection("User").find().toArray();
    return users;
}

async function getUserById(userId){
    const db = await connect();
    const user = await db.collection("User").findOne({_id:newId(userId)});
    return user;
}

async function registerUser(user){
    const db = await connect();
    const result = await db.collection("User").insertOne(user)
    return result;
}

async function checkEmailExists(email) {
    const db = await connect();
    const existingUser = await db.collection('User').findOne({ email });
    return !!existingUser; // Return true if email is found, false if not found
}

async function loginUser(user){
    const db = await connect();
    const resultUser = await db.collection("User").findOne({email: user.email});
    return resultUser;
}

async function updateUser(userId, updatedUser) {
    const db = await connect();
    const existingUser = await db.collection("User").findOne({ _id: newId(userId) });
    if (!existingUser) {
        throw new Error(`User ${userId} not found`);
    }

    const result = await db.collection("User").updateOne({ _id: newId(userId) }, { $set: updatedUser });
    return result;
}

async function deleteUser(userId){
    const db = await connect();
    const existingUser = await db.collection("User").findOne({ _id: newId(userId) });
    if (!existingUser) {
        throw new Error(`User ${userId} not found`);
    }
    const result = await db.collection("User").deleteOne({_id: newId(userId)});
    return result;
}

async function getBugs(){
    const db = await connect();
    const bugs = await db.collection("Bug").find().toArray();
    return bugs;
}

async function getBugById(bugId){
    const db = await connect();
    const bug = await db.collection("Bug").findOne({_id:newId(bugId)});
    return bug;
}

async function newBug(newBugParams, user) {
    const db = await connect();
  
    // Organize the bug document with the author field
    const bug = {
        
        title: newBugParams.title,
        description: newBugParams.description,
        stepsToReproduce: newBugParams.stepsToReproduce,
        createdOn: new Date().toLocaleString('en-US'),
        author: {
            fullName: user.fullName,
            userId: user._id,
        },
        classification: 'unclassified',
        closed: false,
    };
  
    const result = await db.collection('Bug').insertOne(bug);
    return result;
  }
  

async function findUserByFullName(fullName) {
    try {
      const db = await connect(); // Connect to your MongoDB database
      const collection = db.collection('User'); // Replace 'User' with your actual collection name
  
      const user = await collection.findOne({ fullName });
  
      if (user) {
        // Extract the userId from the user object and return both user and userId
        const userId = user._id; // Assuming the user object has an _id field
  
        return { user, userId };
      } else {
        // If the user is not found, return null for both user and userId
        return { user: null, userId: null };
      }
    } catch (err) {
      throw err; // Handle or log the error as needed
    }
  }

async function updateBug(bugId, updatedBug, req) {
    const db = await connect();
    const existingBug = await db.collection("Bug").findOne({ _id: newId(bugId) });
    if (!existingBug) {
        throw new Error(`Bug ${bugId} not found`);
    }
    if (existingBug.author.userId != newId(req.auth._id) && !req.auth.role.includes('Business Analyst') &&
        existingBug.assignedToUserId != newId(req.auth._id)){
        debugDb("WORLD");
        return {
            message: `Only Business Analysts, those assigned, and the creator of this Bug may edit it`,
            status: 400
        }
    }
    const result = await db.collection("Bug").updateOne({ _id: newId(bugId) }, { $set: updatedBug });
    return result;
}


async function classifyBug(bugId, classifiedBug, req) {
    const db = await connect();
    const existingBug = await db.collection("Bug").findOne({ _id: newId(bugId) });

    if (existingBug.author.userId != newId(req.auth._id) && !req.auth.role.includes('Business Analyst') &&
    existingBug.assignedToUserId != newId(req.auth._id)){
        return {
            message: `Only Business Analysts, those assigned, and the creator of this Bug may classify it`,
            status: 400
        }
    }

    const result = await db.collection("Bug").updateOne({ _id: newId(bugId) },{$set: classifiedBug});

    if (!result.matchedCount) {
        throw new Error(`Bug ${bugId} not found.`);
    }

    return result;
}

async function assignBugToUser(bugId, assignedBug, req) {
    const db = await connect();

    try {
        // Use collection.findOne() to search for the bug by ID
        const existingBug = await db.collection("Bug").findOne({ _id: newId(bugId) });

        if (!existingBug) {
            throw new Error(`Bug ${bugId} not found.`);
        }
        // Query the database for the user's info based on assignedToUserId
        const userInfo = await getUserById(assignedBug.assignedToUserId);

        if (!userInfo) {
            throw new Error(`User ${assignedBug.assignedToUserId} not found.`);
        }

        if (existingBug.author.userId != newId(req.auth._id) && !(req.auth.role.includes('Business Analyst') || req.auth.role.includes('Technical Manager')) &&
        existingBug.assignedToUserId != newId(req.auth._id)){
        return {
            message: `Only Business Analysts, Technical Managers, those assigned, and the creator of this Bug may assign it`,
            status: 400
        }
    }
        const result = await db.collection("Bug").updateOne({ _id: newId(bugId) }, { $set: assignedBug });

        return result;
    } catch (err) {
        throw err; // Re-throw any errors to be handled in the calling code
    }
}

// Define an async function to close a bug and return a status message
async function closeBug(bugId, bugData, user) {
    const db = await connect();

    try {
        // Use collection.findOne() to search for the bug by ID
        const existingBug = await db.collection("Bug").findOne({ _id: newId(bugId) });
        if (!existingBug) throw new Error(`Bug ${bugId} not found.`);

        // Copy over the fields from bugData to update the bug document
        const updateFields = {
            lastUpdated: new Date().toLocaleString('en-US'),
            // Add other fields from bugData as needed
        };

        // Only update the 'closed' and 'closedBy' related fields if provided
        if (bugData.closed !== undefined) {
            const isClosed = bugData.closed === "true" || !!bugData.closed;
            updateFields.closed = isClosed;
            updateFields.closedOn = isClosed ? new Date().toLocaleString('en-US') : null;
            updateFields.closedBy = isClosed ? {
                fullName: user.fullName,
                userId: user._id
            } : null;
        }

        const result = await db.collection("Bug").updateOne({ _id: newId(bugId) }, { $set: updateFields });

        return result;
    } catch (err) {
        throw err;
    }
}


async function getComments(bugId) {
    const db = await connect();
    const bug = await db.collection("Bug").findOne({ _id: newId(bugId) });

    if (bug && bug.comments) {
        return bug.comments;
    }

    return [];
}

async function getCommentById(bugId, commentId) {
    const db = await connect();
    const bug = await db.collection("Bug").findOne({ _id: newId(bugId) });
    debugDb("searching for comment:", commentId);

    if (bug && bug.comments) {
        const comment = bug.comments.find((c) => c.commentId.equals(commentId)); // Use equals() for ObjectId comparison
        debugDb("found comment:", comment);
        return comment || null;
    }

    return null;
}

async function addComment(bugId, comment) {
    const db = await connect();
    const bugObjectId = newId(bugId);

    // Check if the 'comments' array exists. If not, create it.
    const existingBug = await db.collection("Bug").findOne({ _id: bugObjectId });

    if (!existingBug.comments) {
        existingBug.comments = [];
    }

    // Push the new comment into the 'comments' array
    existingBug.comments.push(comment);

    // Update the bug document
    const result = await db.collection("Bug").updateOne(
        { _id: bugObjectId },
        { $set: { comments: existingBug.comments } }
    );

    return result;
}

async function getTestCases(bugId) {
    const db = await connect();
    const bug = await db.collection("Bug").findOne({ _id: new ObjectId(bugId) });
  
    if (bug && bug.testCases) {
      return bug.testCases;
    }
  
    return [];
  }
  
async function getTestCaseById(bugId, testId) {
    const db = await connect();
    const bug = await db.collection("Bug").findOne({ _id: newId(bugId) });
  
    if (bug && bug.testCases) {
      const testCase = bug.testCases.find((tc) => tc.testId.equals(testId));
      return testCase || null;
    }
  
    return null;
}
  
async function addTestCase(bugId, testCase) {
    const db = await connect();
    const bugObjectId = new ObjectId(bugId);
   
    // Check if the 'testCases' array exists. If not, create it.
    const existingBug = await db.collection("Bug").findOne({ _id: bugObjectId });
    debugDb(`Existing Bug is ${JSON.stringify(existingBug)}`)
    if (!existingBug.testCases) {
      existingBug.testCases = [];
    }
  
    // Push the new test case into the 'testCases' array
    existingBug.testCases.push(testCase);
  
    // Update the bug document
 return await db.collection("Bug").updateOne(
      { _id: bugObjectId },
      { $set: { testCases: existingBug.testCases } }
    );
}
  
async function updateTestCase(bugId, testId, isPassed, user) {
    const db = await connect();
  
    // Search for the bug and its test cases
    const existingBug = await db.collection("Bug").findOne({ _id: newId(bugId) });
  
    if (!existingBug || !existingBug.testCases) {
      throw new Error(`Bug ${bugId} or test cases not found.`);
    }
  
    // Find the index of the test case to update
    const testCaseIndex = existingBug.testCases.findIndex((tc) => tc.testId.equals(testId));
  
    if (testCaseIndex === -1) {
      debugDb('Test case not found:', testId);
      throw new Error(`Test case ${testId} not found.`);
    }
  
    // Update the isPassed field of the specified test case
    existingBug.testCases[testCaseIndex].isPassed = isPassed;
    existingBug.testCases[testCaseIndex].lastUpdatedOn = new Date().toLocaleString('en-US');
    existingBug.testCases[testCaseIndex].lastUpdatedBy = user;
  
    // Update the bug document
    const result = await db.collection("Bug").updateOne(
        { _id: newId(bugId) },
        { $set: { testCases: existingBug.testCases } }
    );

    if (result.modifiedCount !== 1) {
        throw Error(`Failed to update test case ${testId} for bug ${bugId}`);
    }

    // Retrieve and return the updated bug
    const updatedBug = await db.collection("Bug").findOne({ _id: newId(bugId) });

    return updatedBug;
  }
  
async function deleteTestCase(bugId, testId) {
    const db = await connect();
    const bugObjectId = new ObjectId(bugId);
  
    // Pull the test case from the 'testCases' array
    const result = await db.collection("Bug").updateOne(
      { _id: bugObjectId },
      { $pull: { testCases: { testId } } }
    );
  
    return result;
}

function calculateDateFromDaysAgo(daysAgo) {
    const currentDate = new Date();
    const targetDate = new Date(currentDate);
    targetDate.setDate(currentDate.getDate() - daysAgo);
    targetDate.setHours(0, 0, 0, 0); // Remove time information (set to midnight)
    return targetDate;
  }

async function saveEdit(edit){
    const db = await connect();
    const result = await db.collection('Edit').insertOne(edit);
    return result;
}

async function findRoleByName(name){
    const db = await connect();
    const role = await db.collection("Role").findOne({name:name});
    return role;
}
// export functions
export {newId, connect, ping, getUsers, getUserById, registerUser, checkEmailExists, loginUser, updateUser, deleteUser,
     getBugs, getBugById, newBug, findUserByFullName, updateBug, classifyBug, assignBugToUser, closeBug,
    getComments, getCommentById, addComment,
    getTestCases, getTestCaseById, addTestCase, updateTestCase, deleteTestCase,
    calculateDateFromDaysAgo, saveEdit, findRoleByName};

// test the database connection
//ping();