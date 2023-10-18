import express from 'express';
const router = express.Router();

import debug from 'debug';
const debugBug = debug('app:BugRouter');

import Joi from 'joi';

import { nanoid } from 'nanoid';
import { getBugs, connect, getBugById, newBug, findUserByFullName, updateBug, classifyBug, assignBugToUser, getUserById, newId, closeBug, calculateDateFromDaysAgo } from '../../database.js';
import { validBody } from '../../middleware/validBody.js';
import { validId } from '../../middleware/validId.js';

router.use(express.urlencoded({extended:false}));

const newBugSchema = Joi.object({
    title: Joi.string().min(1).max(50).required(),
    description: Joi.string().min(10).required(),
    stepsToReproduce: Joi.string().min(10).required(),
    fullName: Joi.string().min(2).required(),
});

const updateBugSchema = Joi.object({
    title: Joi.string().min(1).max(50),
    description: Joi.string().min(10),
    stepsToReproduce: Joi.string().min(10),
});

const classifyBugSchema = Joi.object({
    classification: Joi.string().valid('approved', 'unapproved', 'duplicate').required()
});

const assignBugSchema = Joi.object({
    assignedToUserId: Joi.string().required(),
});

const closeBugSchema = Joi.object({
    closed: Joi.string().valid('true', 'false').required()
})
// const bugsArray = [{"title":"Button doesn't work","description":"Clicking the link doesnt take me anywhere. Even after refreshing.","stepsToReproduce":"I log into my account and try to click on the link. And it just doesnt work.","_id": 1},
// {"title":"Sent to wrong site","description":"When I click on the about link, it takes me back to the homepage.","stepsToReproduce":"I log into my account and browse the home page for a bit. Then I click on the about link but it refreshes to the main page.", "_id":2},
// {"title":"Keeps crashing","description":"I can explore the site for 10 minutes but then the page just crashes","stepsToReproduce":"Login to account and browse for a few minutes. MAybe have other tabs open","_id":3},
// {"title":"Error code 404","description":"Whenever I try to log in, an error 404 message opens saying that it cant find my account","stepsToReproduce":"Login to this persons account, see what is going on","_id":4}]

router.get('/list', async (req,res) => {
    debugBug(`Getting all bugs, the query string is ${JSON.stringify(req.query)}`);

    let {
      keywords,
      classification,
      minAge,
      maxAge,
      closed,
      sortBy,
      pageSize = 5,
      pageNumber = 1,
    } = req.query;
  
    const match = {}; // The match stage of the aggregation pipeline is used for filtering bugs.
    let sort = { creationDate: -1 }; // Default to sorting by newest.
  
    // Build the filter and sorting based on query parameters.
    if (keywords) {
      match.$text = { $search: keywords };
    }
  
    if (classification) {
      match.classification = classification;
    }
  
    if (minAge && maxAge) {
      match.creationDate = {
        $gte: calculateDateFromDaysAgo(maxAge),
        $lt: calculateDateFromDaysAgo(minAge),
      };
    } else if (minAge) {
      match.creationDate = { $lt: calculateDateFromDaysAgo(minAge) };
    } else if (maxAge) {
      match.creationDate = { $gte: calculateDateFromDaysAgo(maxAge) };
    }
  
    if (closed !== undefined) {
      match.closed = closed === 'true';
    }
  
    // Handle sorting options.
    switch (sortBy) {
      case 'oldest':
        sort = { creationDate: 1 };
        break;
      case 'title':
        sort = { title: 1, creationDate: -1 };
        break;
      case 'classification':
        sort = { classification: 1, creationDate: -1 };
        break;
      case 'assignedTo':
        sort = { assignedTo: 1, creationDate: -1 };
        break;
      case 'createdBy':
        const authorFullName = req.query.authorFullName; // Get authorFullName from query parameters
        match['author.fullName'] = authorFullName; // Add filter for authorFullName
        sort = { 'author.fullName': 1, creationDate: -1 };
        break;
    }
  
    try {
      const db = await connect();
      const pipeline = [
        { $match: match },
        { $sort: sort },
        { $skip: (pageNumber - 1) * pageSize },
        { $limit: parseInt(pageSize) },
      ];
  
      const cursor = await db.collection('Bug').aggregate(pipeline);
      const bugs = await cursor.toArray();
      res.status(200).json(bugs);
    } catch (err) {
      res.status(500).json({ error: err.stack });
    }
    // debugBug('Getting all the bugs');
    // try{
    //     const db = await connect();
    //     const bugs = await getBugs();
    //     res.status(200).json(bugs);
    // } catch(err) {
    //     res.status(500).json({error: err});
    // }
});

router.get("/:bugId", validId('bugId'), async (req,res) => {
    //Reads the bugId from the URL and stores in a variable
    const bugId = req.bugId;
    debugBug(bugId);
    
    try{
        const bug = await getBugById(bugId);
        debugBug(`The bug is: ${bug.title}`)
        res.status(200).json(bug);
    } catch(err) {
        res.status(500).json({error: err});
    }
});

router.post('/new', validBody(newBugSchema), async (req, res) => {
    const { title, description, stepsToReproduce, fullName} = req.body;

try {
  // Check if the fullName is provided in the request body
  if (!fullName) {
    res.status(400).json({ error: "fullName is required in the request body." });
    return;
  }

  // Find the user by fullName in the User collection
  const user = await findUserByFullName(fullName);

  if (!user) {
    res.status(400).json({ error: "User not found with the provided fullName." });
    return;
  }

  const bug = {
    title,
    description,
    stepsToReproduce,
    creationDate: new Date().toLocaleString('en-US'),
    author: {
      fullName: fullName,
      userId: user.userId,
    },
  };

  debugBug(bug);
  const dbResult = await newBug(bug);
  res.status(200).json({ message: "New bug reported!", bugId: dbResult.insertedId });
} catch (err) {
  // Handle database errors and promise rejections
  res.status(500).json({ error: err.message });
}
});


router.put('/:bugId', validId('bugId'), validBody(updateBugSchema), async (req, res) => {
    //FIXME:  update existing user and send response as JSON
    const bugId = req.bugId;
    const updatedBug = req.body;

    try {
        updatedBug.lastUpdated = new Date().toLocaleString('en-US');
        const updateResult = await updateBug(bugId, updatedBug);

        if (updateResult.modifiedCount === 1) {
            res.status(200).json({ message: `Bug ${bugId} updated`, bugId });
            debugBug(bugId);
        } else {
            res.status(400).json({ message: `Bug ${bugId} not updated` });
        }
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// Define the route for classifying a bug
router.put('/:bugId/classify', validId('bugId'), validBody(classifyBugSchema), async (req, res) => {
    const bugId = req.bugId;
    const classifiedBug = req.body;

    try {
        if (!classifiedBug.classification) {
            res.status(400).json({ error: "Classification is missing" });
            return;
        }

        classifiedBug.classifiedOn = new Date().toLocaleString('en-US');
        classifiedBug.lastUpdated = new Date().toLocaleString('en-US');
        debugBug(bugId, classifiedBug.classification)
        const updateResult = await classifyBug(bugId, classifiedBug);

        if (updateResult.modifiedCount === 1) {
            res.status(200).json({ message: `Bug ${bugId} classified!`, bugId });
        } else {
            res.status(400).json({ message: `Bug ${bugId} not classified` });
        }
    } catch (err) {
        if (err.message === `Bug ${bugId} not found.`) {
            res.status(404).json({ error: `Bug ${bugId} not found.` });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});


router.put('/:bugId/assign',validId('bugId'), validBody(assignBugSchema), async (req, res) => {
    const bugId = req.bugId;
    const { assignedToUserId } = req.body; // Extract assignedToUserId from the request body

    try {
        // Check if assignedToUserId is missing or invalid
        if (!assignedToUserId) {
            res.status(400).json({ error: "Missing User Id" });
            return;
        }

        // Call getUserById to get user information
        const userInfo = await getUserById(assignedToUserId);

        if (!userInfo) {
            res.status(404).json({ error: `User ${assignedToUserId} not found.` });
            return;
        }

        const db = await connect();

        // Use collection.findOne() to search for the bug by ID
        const existingBug = await db.collection("Bug").findOne({ _id: newId(bugId) });

        if (!existingBug) {
            res.status(404).json({ error: `Bug ${bugId} not found.` });
            return;
        }

        // Create the assignedBug object with assignedToUserId and other properties
        const assignedBug = {
            assignedToUserId,
            assignedToUserName: userInfo.fullName, // Use userInfo.userName from the database
            assignedOn: new Date().toLocaleString('en-US'), // Set assignedOn to the current date and time
            lastUpdated: new Date().toLocaleString('en-US'), // Set lastUpdated to the current date and time
        };

        // Use the assignBugToUser function to update the bug's fields
        const result = await assignBugToUser(bugId, assignedBug);
        debugBug(`Assigned to ${userInfo.fullName}`);
        if (result.modifiedCount === 1) {
            res.status(200).json({ message: `Bug ${bugId} assigned!`, bugId });
        } else {
            res.status(400).json({ message: `Bug ${bugId} not assigned` });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:bugId/close',validId('bugId'), async (req, res) => {
    const bugId = req.params.bugId;
    const closed = req.body.closed;
    debugBug(closed);
    try {
        // Check if 'closed' is missing or invalid
        if (closed === undefined || (closed !== "true" && closed !== "false")) {
            res.status(400).json({ error: "Invalid or missing 'closed' data." });
            return;
        }

        // Convert the 'closed' string to a boolean
        const isClosed = closed === "true";

        const db = await connect();

        const result = await closeBug(bugId, isClosed);

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export {router as BugRouter};