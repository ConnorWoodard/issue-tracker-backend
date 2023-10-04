import express from 'express';
const router = express.Router();

import debug from 'debug';
const debugUser = debug('app:UserRouter');

import bcrypt from 'bcrypt';

import { nanoid } from 'nanoid';
import { getUsers, connect, getUserById, registerUser, checkEmailExists, loginUser, updateUser, deleteUser } from '../../database.js';

router.use(express.urlencoded({extended:false}));

//FIXME: use this array to store user data in for now
//we will replace this with a database in a later assignment
// const usersArray =[{"email":"tkettoe0@hc360.com","password":"gO4+K9#X","fullName":"Tawsha Kettoe","firstName":"Tawsha","lastName":"Kettoe","role":"Safety Technician II","_id":1},
// {"email":"gsyvret1@comcast.net","password":"mH2$oL","fullName":"Gwenni Syvret","firstName":"Gwenni","lastName":"Syvret","role":"Safety Technician II", "_id":2},
// {"email":"grapport2@angelfire.com","password":"vS7*6`","fullName":"Guy Rapport","firstName":"Guy","lastName":"Rapport","role":"Geological Engineer", "_id":3},
// {"email":"syeskin3@sina.com.cn","password":"jS8/o","fullName":"Siegfried Yeskin","firstName":"Siegfried","lastName":"Yeskin","role":"Senior Quality Engineer", "_id":4}];

router.get('/list', async (req,res) => {
    debugUser('Getting all the users');
    try{
        const db = await connect();
        const users = await getUsers();
        res.status(200).json(users);
    } catch(err) {
        res.status(500).json({error: err});
    }
});

router.get("/:userId", async (req,res) => {
    //Reads the userId from the URL and stores in a variable
    const userId = req.params.userId;
    debugUser(userId);
    //FIXME: Get the user from usersArray and send response as JSON
    try{
        const user = await getUserById(userId);
        debugUser(`The user is: ${user.fullName}`)
        if (user){
            res.status(200).json(user);
        } else {
            res.status(404).json({error: `User ${userId} not found`});
        }
    } catch(err) {
        res.status(500).json({error: err});
    }
});

router.post('/register', async (req,res) => {
    const user = req.body;

    // Check if the email is already registered
    const isEmailRegistered = await checkEmailExists(user.email);
    if (isEmailRegistered) {
        res.status(400).json({ error: 'Email already registered.' });
        return; // Exit the registration process
    }

    // Check if all required fields are present
    const requiredFields = ['email', 'password', 'fullName', 'givenName', 'familyName'];
    const missingFields = requiredFields.filter(field => !user[field]);

    if (missingFields.length > 0) {
        res.status(400).json({ error: `Required fields missing: ${missingFields.join(', ')}.` });
        return; // Exit the registration process
    }

    // Ensure "role" is an array of strings
    user.role = Array.isArray(user.role) ? user.role : [user.role];

    // Insert the new user into the database
    try {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        user.password = hashedPassword;
        user.createdAt = new Date().toLocaleString('en-US'); // Set the creation date
        const result = await registerUser(user);
        res.status(200).json({ message: 'New user registered!', userId: result.insertedId });
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
    debugUser(user);
});

router.post('/login',async (req,res) => {
    const user = req.body;

    if (!user.email || !user.password) {
        res.status(400).json({ error: 'Please enter your login credentials.' });
        return;
    }
    debugUser(user);
    try {
        const resultUser = await loginUser(user);
  
        if (resultUser && await bcrypt.compare(user.password, resultUser.password)) {
            res.status(200).json({ message: 'Welcome back!', userId: resultUser._id });
        } else {
            res.status(400).json({ error: 'Invalid login credentials provided. Please try again.' });
        }
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});

router.put('/:userId', async (req, res) => {
    //FIXME:  update existing user and send response as JSON
    const userId = req.params.userId;
    const updatedUser = req.body;

    try {
        if (updatedUser.password) {
            updatedUser.password = await bcrypt.hash(updatedUser.password, 10);
        }
        updatedUser.lastUpdated = new Date().toLocaleString('en-US');
        const updateResult = await updateUser(userId, updatedUser);

        if (updateResult.modifiedCount === 1) {
            res.status(200).json({ message: `User ${userId} updated`, userId });
            debugUser(userId);
        } else {
            res.status(400).json({ message: `User ${userId} not updated` });
        }
    } catch (err) {
        if (err.message === `User ${userId} not found`) {
            res.status(404).json({ error: `User ${userId} not found` });
        } else {
            res.status(404).json({ error: err.message });
        }
    }
});

router.delete('/:userId', async (req, res) => {
    const userId = req.params.userId;
    debugUser(userId);
    try {
        const dbResult = await deleteUser(userId);
        
        if (dbResult.deletedCount == 1) {
            res.status(200).json({ message: `User ${userId} deleted!`, userId });
        } else {
            // This block should handle the case where the user doesn't exist
            res.status(404).json({ error: `User ${userId} not deleted` });
        }
    } catch (err) {
        // Handle other errors, such as database connection errors
        res.status(404).json({ error: err.message });
    }
});


export {router as UserRouter};