import express from 'express';
const router = express.Router();

import debug from 'debug';
const debugUser = debug('app:UserRouter');

import bcrypt from 'bcrypt';
import Joi from 'joi';

import { nanoid } from 'nanoid';
import { getUsers, newId, connect, getUserById, registerUser, checkEmailExists, loginUser, updateUser, deleteUser, calculateDateFromDaysAgo, saveEdit } from '../../database.js';
import { validBody } from '../../middleware/validBody.js';
import { validId } from '../../middleware/validId.js';
import jwt from 'jsonwebtoken';
import {isLoggedIn} from '@merlin4/express-auth';
router.use(express.urlencoded({extended:false}));

async function issueAuthToken(user){
  const payload = {_id: user._id, email: user.email, role: user.role};
  const secret = process.env.JWT_SECRET;
  const options = {expiresIn:'1h'};

  const authToken = jwt.sign(payload, secret, options);
  return authToken;
}

function issueAuthCookie(res, authToken){
  const cookieOptions = {httpOnly:true,maxAge:1000*60*60};
  res.cookie('authToken', authToken, cookieOptions);
}

const newUserSchema = Joi.object({
    email: Joi.string().trim().email({ allowFullyQualified: true, minDomainSegments: 2 }).required(),
    password: Joi.string().trim().min(8).max(50).required(),
    fullName: Joi.string().min(1).max(100).required(),
    givenName: Joi.string().min(1).max(50).required(),
    familyName: Joi.string().min(1).max(50).required(),
    role: Joi.alternatives().try(
      Joi.array().items(Joi.string().trim().valid('Developer', 'Quality Analyst', 'Business Analyst', 'Product Manager', 'Technical Manager')),
      Joi.string().trim().valid('Developer', 'Quality Analyst', 'Business Analyst', 'Product Manager', 'Technical Manager')
    ).default('Developer')
});

const loginUserSchema = Joi.object({
    email: Joi.string().trim().email({ allowFullyQualified: true, minDomainSegments: 2 }).required(),
    password: Joi.string().trim().min(8).max(50).required(),
})

const updateMeSchema = Joi.object({
  password: Joi.string().trim().min(8).max(50),
  fullName: Joi.string().min(1).max(100),
  givenName: Joi.string().min(1).max(50),
  familyName: Joi.string().min(1).max(50),
})

const updateUserSchema = Joi.object({
    password: Joi.string().trim().min(8).max(50),
    fullName: Joi.string().min(1).max(100),
    givenName: Joi.string().min(1).max(50),
    familyName: Joi.string().min(1).max(50),
    role: Joi.alternatives().try(
      Joi.array().items(Joi.string().trim().valid('Developer', 'Quality Analyst', 'Business Analyst', 'Product Manager', 'Technical Manager')),
      Joi.string().trim().valid('Developer', 'Quality Analyst', 'Business Analyst', 'Product Manager', 'Technical Manager')
    )
  });
//FIXME: use this array to store user data in for now
//we will replace this with a database in a later assignment
// const usersArray =[{"email":"tkettoe0@hc360.com","password":"gO4+K9#X","fullName":"Tawsha Kettoe","firstName":"Tawsha","lastName":"Kettoe","role":"Safety Technician II","_id":1},
// {"email":"gsyvret1@comcast.net","password":"mH2$oL","fullName":"Gwenni Syvret","firstName":"Gwenni","lastName":"Syvret","role":"Safety Technician II", "_id":2},
// {"email":"grapport2@angelfire.com","password":"vS7*6`","fullName":"Guy Rapport","firstName":"Guy","lastName":"Rapport","role":"Geological Engineer", "_id":3},
// {"email":"syeskin3@sina.com.cn","password":"jS8/o","fullName":"Siegfried Yeskin","firstName":"Siegfried","lastName":"Yeskin","role":"Senior Quality Engineer", "_id":4}];

router.get('/list', isLoggedIn(), async (req,res) => {
    debugUser('Getting all the users');
    const {
        keywords,
        role,
        minAge,
        maxAge,
        sortBy,
        pageSize = 5,
        pageNumber = 1,
      } = req.query;
    
      const match = {};
      let sort = { createdDate: -1 };
    
      // Build the filter and sorting based on query parameters.
    
      if (keywords) {
        match.$text = { $search: keywords };
      }
    
      if (role) {
        match.role = role;
      }
    
      if (minAge && maxAge) {
        match.createdDate = {
          $gte: calculateDateFromDaysAgo(maxAge),
          $lt: calculateDateFromDaysAgo(minAge),
        };
      } else if (minAge) {
        match.createdDate = { $lt: calculateDateFromDaysAgo(minAge) };
      } else if (maxAge) {
        match.createdDate = { $gte: calculateDateFromDaysAgo(maxAge) };
      }
    
      // Handle sorting options.
      switch (sortBy) {
        case 'oldest':
          sort = { createdDate: 1 };
          break;
        case 'givenName':
          sort = { givenName: 1, familyName: 1, createdDate: 1 };
          break;
        case 'familyName':
          sort = { familyName: 1, givenName: 1, createdDate: 1 };
          break;
        case 'role':
          sort = { role: 1, givenName: 1, familyName: 1, createdDate: 1 };
          break;
        case 'newest':
          sort = { createdDate: -1 };
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
    
        const cursor = await db.collection('User').aggregate(pipeline);
        const users = await cursor.toArray();
        res.status(200).json(users);
      } catch (err) {
        res.status(500).json({ error: err.stack });
      }
    // try{
    //     const db = await connect();
    //     const users = await getUsers();
    //     res.status(200).json(users);
    // } catch(err) {
    //     res.status(500).json({error: err});
    // }
});

router.get('/me', isLoggedIn(), async (req, res) => {
  const getLoggedInUser = await getUserById(newId(req.auth._id))


    if(getLoggedInUser){
      // Success Message
      res.status(200).json(getLoggedInUser);
      debugUser(`Success, Got "${getLoggedInUser.fullName}" Id: ${getLoggedInUser._id}\n`); // Message Appears in terminal
    }

});

router.get("/:userId", isLoggedIn(), validId('userId'), async (req,res) => {
    //Reads the userId from the URL and stores in a variable
    const userId = req.userId;
    debugUser(userId);
    //FIXME: Get the user from usersArray and send response as JSON
    try{
        const user = await getUserById(userId);
        debugUser(`The user is: ${user.fullName}`)
        res.status(200).json(user);
    } catch(err) {
        res.status(500).json({error: err});
    }
});

router.post('/register', validBody(newUserSchema), async (req,res) => {
    const user = req.body;

    // Check if the email is already registered
    const isEmailRegistered = await checkEmailExists(user.email);
    if (isEmailRegistered) {
        res.status(400).json({ error: 'Email already registered.' });
        return; // Exit the registration process
    }

    // Ensure "role" is an array of strings
    user.role = Array.isArray(user.role) ? user.role : [user.role];
    // Insert the new user into the database
    try {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        user.password = hashedPassword;
        user.createdAt = new Date().toLocaleString('en-US'); // Set the creation date
        user.role
        const result = await registerUser(user);
        if(result.acknowledged == true){
          const authToken = await issueAuthToken(user);
          issueAuthCookie(res, authToken);
          const edit = {
            timestamp: new Date().toLocaleString('en-US'),
            col: 'User',
            op: 'Insert',
            target: user._id,
            update: user
          }
          await saveEdit(edit);
          res.status(200).json({ message: 'New user registered!', userId: result.insertedId });
        }
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
    debugUser(user);
});

router.post('/login',validBody(loginUserSchema), async (req,res) => {
    const user = req.body;
    debugUser(user);
    try {
        const resultUser = await loginUser(user);
        if (resultUser && await bcrypt.compare(user.password, resultUser.password)) {
            const authToken = await issueAuthToken(resultUser);
            issueAuthCookie(res, authToken);
            res.status(200).json(`Welcome ${resultUser.fullName}. Your auth token is ${authToken}`);
        } else {
            res.status(400).json({ error: 'Invalid login credentials provided. Please try again.' });
        }
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});

router.put('/me', isLoggedIn(), validBody(updateMeSchema), async (req, res) => {
  debugUser(`Self Service Route Updating a user ${JSON.stringify(req.auth)}`);
  const updatedUser = req.body;

  try {
    const userId = newId(req.auth._id);

    const user = await getUserById(newId(req.auth._id));

    if (user) {
      const changes = {}; // Create an object to store the changed fields and their new values

      if (updatedUser.fullName && updatedUser.fullName !== user.fullName) {
        changes.fullName = updatedUser.fullName;
        user.fullName = updatedUser.fullName;
      }

      if (updatedUser.password) {
        changes.password = updatedUser.password;
        user.password = await bcrypt.hash(updatedUser.password, 10);
      }

      if (updatedUser.familyName && updatedUser.familyName !== user.familyName) {
        changes.familyName = updatedUser.familyName;
        user.familyName = updatedUser.familyName;
      }

      if (updatedUser.givenName && updatedUser.givenName !== user.givenName) {
        changes.givenName = updatedUser.givenName;
        user.givenName = updatedUser.givenName;
      }

      debugUser(JSON.stringify(req.auth));
      // Update the lastUpdatedOn and lastUpdatedBy fields
      user.lastUpdatedOn = new Date().toLocaleString('en-US');
      user.lastUpdatedBy = {
        _id: req.auth._id,
        fullName: updatedUser.fullName,
        email: req.auth.email,
        role: req.auth.role,
      };

      const dbResult = await updateUser(userId,user);

      if (dbResult.modifiedCount == 1) {
        const edit = {
          timestamp: new Date().toLocaleString('en-US'),
          col: 'User',
          op: 'update',
          target: { userId: req.auth._id },
          update: changes, // Include the changes object
          auth: {_id:req.auth._id, fullName:updatedUser.fullName, email: req.auth.email, role:req.auth.role},
        };

        await saveEdit(edit);

        res.status(200).json({ message: `User ${req.auth._id} updated` });
      } else {
        res.status(400).json({ message: `User ${req.auth._id} not updated` });
      }
    } else {
      res.status(400).json({ message: `User ${req.auth._id} not updated` });
    }
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

router.put('/:userId', validId('userId'), validBody(updateUserSchema), async (req, res) => {
  const userId = req.userId;
  const updatedUser = req.body;

  try {
    const user = await getUserById(userId);

    if (user) {
      const changes = {}; // Create an object to store the changed fields and their new values

      if (updatedUser.password) {
        updatedUser.password = await bcrypt.hash(updatedUser.password, 10);
        changes.password = updatedUser.password;
        user.password = updatedUser.password;
      }

      if (updatedUser.fullName && updatedUser.fullName !== user.fullName) {
        changes.fullName = updatedUser.fullName;
        user.fullName = updatedUser.fullName;
      }

      if (updatedUser.familyName && updatedUser.familyName !== user.familyName) {
        changes.familyName = updatedUser.familyName;
        user.familyName = updatedUser.familyName;
      }

      if (updatedUser.givenName && updatedUser.givenName !== user.givenName) {
        changes.givenName = updatedUser.givenName;
        user.givenName = updatedUser.givenName;
      }

      if (updatedUser.role && updatedUser.role !== user.role) {
        changes.role = updatedUser.role;
        user.role = updatedUser.role;
      }

      // Update the lastUpdatedOn and lastUpdatedBy fields
      user.lastUpdatedOn = new Date().toLocaleString('en-US');
      user.lastUpdatedBy = {
        _id: req.auth._id,
        fullName: updatedUser.fullName,
        email: req.auth.email,
        role: req.auth.role,
      };

      const updateResult = await updateUser(userId, user);

      if (updateResult.modifiedCount === 1) {
        const edit = {
          timestamp: new Date().toLocaleString('en-US'),
          col: 'User',
          op: 'update',
          target: { userId },
          update: changes, // Include the changes object
          auth: {_id:req.auth._id, fullName:updatedUser.fullName, email: req.auth.email, role:req.auth.role},
        };

        await saveEdit(edit);

        res.status(200).json({ message: `User ${userId} updated` });
      } else {
        res.status(400).json({ message: `User ${userId} not updated` });
      }
    } else {
      res.status(400).json({ message: `User ${userId} not found` });
    }
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

router.delete('/:userId', isLoggedIn(), validId('userId'), async (req, res) => {
  const userId = req.userId;
  const deletedUser = req.auth.fullName
  try {
    const user = await getUserById(userId);
    
    if (user) {
      // Add a record to the edits collection
      const edit = {
        timestamp: new Date().toLocaleString('en-US'),
        col: 'User',
        op: 'delete',
        target: { userId },
        auth: req.auth,
      };

      await saveEdit(edit); // Save the edit record to the "edits" collection

      const dbResult = await deleteUser(userId);

      if (dbResult.deletedCount === 1) {
        res.status(200).json({ message: `User ${userId} deleted!`, userId });
      } else {
        // Handle any other errors related to database operations
        res.status(404).json({ error: `User ${userId} not deleted` });
      }
    } else {
      res.status(400).json({ error: `User ${userId} not found` });
    }
  } catch (err) {
    // Handle other errors, such as database connection errors
    res.status(500).json({ error: err.stack });
  }
});

export {router as UserRouter};