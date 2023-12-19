import express from 'express';
const router = express.Router();

import debug from 'debug';
const debugBug = debug('app:BugRouter');

import Joi from 'joi';

import { nanoid } from 'nanoid';
import { getBugs, connect, getBugById, newBug, findUserByFullName, updateBug, classifyBug, assignBugToUser, getUserById, newId, closeBug, calculateDateFromDaysAgo, saveEdit } from '../../database.js';
import { validBody } from '../../middleware/validBody.js';
import { validId } from '../../middleware/validId.js';
import jwt from 'jsonwebtoken';
import {isLoggedIn,hasPermission} from '@merlin4/express-auth';

router.use(express.urlencoded({extended:false}));

const newBugSchema = Joi.object({
    title: Joi.string().min(1).max(50).required(),
    description: Joi.string().min(10).required(),
    stepsToReproduce: Joi.string().min(10).required(),
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

router.get('/list', isLoggedIn(), hasPermission('canViewData'), async (req,res) => {
    debugBug(`Getting all bugs, the query string is ${JSON.stringify(req.query)}`);
    let {
      keywords,
      classification,
      minAge,
      maxAge,
      closed,
      sortBy,
      pageSize = 6,
      pageNumber = 1,
    } = req.query;
  
    const match = {}; // The match stage of the aggregation pipeline is used for filtering bugs.
    let sort = { creationDate: -1 }; // Default to sorting by newest.
  
    try {
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
      case 'newest':
        sort = { creationDate: -1 };
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
  
      const db = await connect();
      const pipeline = [
        { $match: match },
        { $sort: sort },
        { $skip: (pageNumber - 1) * pageSize },
        { $limit: parseInt(pageSize) },
      ];
  
      const cursor = await db.collection('Bug').aggregate(pipeline);
      const bugs = await cursor.toArray();
      const totalCount = await db.collection("Bug").countDocuments(match);
      res.status(200).json({ bugs, totalCount });
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

router.get("/:bugId", isLoggedIn(), hasPermission('canViewData'), validId('bugId'), async (req,res) => {
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

router.post('/new', isLoggedIn(), hasPermission('canCreateBug'), validBody(newBugSchema), async (req, res) => {
    const newBugParams = req.body;

try {
  // Check if the fullName is provided in the request body

  // Find the user by fullName in the User collection
  const user = await getUserById(newId(req.auth._id))

  if (!user) {
    res.status(400).json({ error: "User not found with the provided fullName." });
    return;
  }

  
  const dbResult = await newBug(newBugParams, user);
  debugBug(dbResult);
  if(dbResult.acknowledged == true){
    const edit = {
      timestamp: new Date().toLocaleString('en-US'),
      col: 'bug',
      op: 'insert',
      target: { bugId: dbResult.insertedId },
      update: {
        title: newBugParams.title,
        description: newBugParams.description,
        stepsToReproduce: newBugParams.stepsToReproduce,
        createdOn: new Date().toLocaleString('en-US'),
        author: {
          fullName: user.fullName,
          userId: user._id,
        },
    },
    auth: req.auth,
  }
  await saveEdit(edit);
  res.status(200).json({ message: "New bug reported!", bugId: dbResult.insertedId });
}
} catch (err) {
  // Handle database errors and promise rejections
  res.status(500).json({ error: err.message });
}
});

router.put('/:bugId', isLoggedIn(), hasPermission('canEditAnyBug', 'canEditIfAssignedTo', 'canEditMyBug'), validId('bugId'), validBody(updateBugSchema), async (req, res) => {
    //FIXME:  update existing user and send response as JSON
    const bugId = req.bugId;
    const updatedBug = req.body;
  
    try {
        const user = await getUserById(newId(req.auth._id))
        const bug = await getBugById(bugId);

        if (bug) {
            const changes = {};

            if(updatedBug.title) {
              changes.title = updatedBug.title;
              bug.title = updatedBug.title;
            }

            if(updatedBug.description) {
              changes.description = updatedBug.description;
              bug.description = updatedBug.description;
            }

            if(updatedBug.stepsToReproduce) {
              changes.stepsToReproduce = updatedBug.stepsToReproduce;
              bug.stepsToReproduce = updatedBug.stepsToReproduce;
            }

            bug.lastUpdatedOn = new Date().toLocaleString('en-US');
            bug.lastUpdatedBy = {
              fullName: user.fullName,
              userId: user._id
            };

            const updateResult = await updateBug(bugId, bug, req);
            debugBug(updateResult);
            if (updateResult.modifiedCount === 1) {
              const edit = {
                timestamp: new Date().toLocaleString('en-US'),
                col: 'bug',
                op: 'update',
                target: { bugId },
                update: changes, // Include the changes object
                auth: {_id:req.auth._id, fullName:user.fullName, title: bug.title},
              };
              await saveEdit(edit);
              debugBug(bugId, bug);
              res.status(200).json({ message: `Bug ${bugId} updated` });
            } else {
              res.status(400).json({ message: `Bug ${bugId} not updated` });
            }
        } else {
          res.status(400).json({ message: `User ${userId} not found` });
        }
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// Define the route for classifying a bug
router.put('/:bugId/classify',isLoggedIn(), hasPermission('canClassifyAnyBug'),validId('bugId'), validBody(classifyBugSchema), async (req, res) => {
    const bugId = req.bugId;
    const classifiedBug = req.body;

    try {
        const user = await getUserById(newId(req.auth._id))
        const bug = await getBugById(bugId);

        if(bug){
            const changes = {};
            if(classifiedBug.classification){
              changes.classification = classifiedBug.classification;
              bug.classification = classifiedBug.classification;
            }
            bug.classifiedOn = new Date().toLocaleString('en-US');
            bug.classifiedBy = {
              fullName: user.fullName,
              userId: user._id
            };
            console.log(req.body);
            const updateResult = await classifyBug(bugId, bug, req);
            if (updateResult.modifiedCount === 1) {
              const edit = {
                timestamp: new Date().toLocaleString('en-US'),
                col: 'bug',
                op: 'update',
                target: { bugId },
                update: changes, // Include the changes object
                auth: {_id:req.auth._id, fullName:user.fullName, classification: bug.classification},
              };
              await saveEdit(edit);
              debugBug(bugId, bug);
              res.status(200).json({ message: `Bug ${bugId} classified` });
            } else {
              res.status(400).json({ message: `Bug ${bugId} not classified` });
            }
        } else {
          res.status(400).json({ message: `User ${user} not found` });
        }
    } catch (err) {
          res.status(500).json({ error: err.message });
    }
});


router.put('/:bugId/assign', isLoggedIn(), hasPermission('canReassignAnyBug'), validId('bugId'), validBody(assignBugSchema), async (req, res) => {
    const bugId = req.bugId;
    const assignedBug = req.body; // Extract assignedToUserId from the request body
    try {
      const user = await getUserById(newId(req.auth._id))
      const bug = await getBugById(bugId);

      if(bug){
          const changes = {};
          if(assignedBug.assignedToUserId){
            changes.assignedToUserId = assignedBug.assignedToUserId;
            bug.assignedToUserId = assignedBug.assignedToUserId;
          }
          bug.assignedOn = new Date().toLocaleString('en-US');
          bug.assignedBy = {
            fullName: user.fullName,
            userId: user._id
          };
          const updateResult = await assignBugToUser(bugId, bug, req);
          if (updateResult.modifiedCount === 1) {
            const edit = {
              timestamp: new Date().toLocaleString('en-US'),
              col: 'bug',
              op: 'update',
              target: { bugId },
              update: changes, // Include the changes object
              auth: {_id:req.auth._id, fullName:user.fullName},
            };
            await saveEdit(edit);
            debugBug(bugId, bug);
            res.status(200).json({ message: `Bug ${bugId} assigned` });
          } else {
            res.status(400).json({ message: `Bug ${bugId} not assigned` });
          }
      } else {
        res.status(400).json({ message: `User ${user} not found` });
      }
  } catch (err) {
        res.status(500).json({ error: err.message });
  }

});

router.put('/:bugId/close', isLoggedIn(), hasPermission('canCloseAnyBug') ,validId('bugId'), validBody(closeBugSchema), async (req, res) => {
  const bugId = req.bugId;
  const closedBug = req.body.closed; // Declare 'closedBug' and assign it the value of req.closed
  try {
      // Check if 'closedBug' is missing or invalid
      if ((closedBug != "true" && closedBug != "false")) {
          res.status(400).json({ error: "Invalid or missing 'closed' data." });
          return;
      }

      // Convert the 'closedBug' string to a boolean
      const isClosed = closedBug === "true";

      const user = await getUserById(newId(req.auth._id));
      const bug = await getBugById(bugId);

      if (bug) {
          const changes = {};
          if (isClosed !== bug.closed) {
              changes.closed = isClosed;
              bug.closed = isClosed;
              if (!isClosed) {
                  // Bug is being re-opened
                  bug.closedOn = null;
                  bug.closedBy = null;
              }
          }

          // Update the bug's lastUpdated field
          bug.lastUpdated = new Date().toLocaleString('en-US');

          const updateResult = await closeBug(bugId, bug,user);

          if (updateResult.modifiedCount === 1) {
              const edit = {
                  timestamp: new Date().toLocaleString('en-US'),
                  col: 'bug',
                  op: 'update',
                  target: { bugId },
                  update: changes, // Include the changes object
                  auth: { _id: req.auth._id, fullName: user.fullName },
              };
              await saveEdit(edit);
              debugBug(bugId, bug);

              const statusMessage = isClosed ? `Bug ${bugId} closed!` : `Bug ${bugId} re-opened!`;
              res.status(200).json({ message: statusMessage });
          } else {
              res.status(400).json({ message: `Bug ${bugId} not updated` });
          }
      } else {
          res.status(400).json({ message: `Bug ${bugId} not found` });
      }
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});


export {router as BugRouter};