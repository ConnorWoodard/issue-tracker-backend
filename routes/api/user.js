import express from 'express';

const router = express.Router();

import debug from 'debug';
const debugUser = debug('app:UserRouter');

import { nanoid } from 'nanoid';

router.use(express.urlencoded({extended:false}));

//FIXME: use this array to store user data in for now
//we will replace this with a database in a later assignment
const usersArray =[{"email":"tkettoe0@hc360.com","password":"gO4+K9#X","fullName":"Tawsha Kettoe","firstName":"Tawsha","lastName":"Kettoe","role":"Safety Technician II","_id":1},
{"email":"gsyvret1@comcast.net","password":"mH2$oL","fullName":"Gwenni Syvret","firstName":"Gwenni","lastName":"Syvret","role":"Safety Technician II", "_id":2},
{"email":"grapport2@angelfire.com","password":"vS7*6`","fullName":"Guy Rapport","firstName":"Guy","lastName":"Rapport","role":"Geological Engineer", "_id":3},
{"email":"syeskin3@sina.com.cn","password":"jS8/o","fullName":"Siegfried Yeskin","firstName":"Siegfried","lastName":"Yeskin","role":"Senior Quality Engineer", "_id":4}];

router.get('/list', (req,res) => {
    debugUser('Getting all the users');
    res.status(200).json(usersArray);
});

router.get("/:userId", (req,res) => {
    //Reads the userId from the URL and stores in a variable
    const userId = req.params.userId;
    //FIXME: Get the user from usersArray and send response as JSON
    const user = usersArray.find(user => user._id == userId);
    if (user) {
      res.status(200).json(user);
    } else {
      res.status(404).json({message: `User ${userId} not found`});
    }
});

router.post('/register', (req,res) => {
    //FIXME: Register new user and send response as JSON
    const { email, password, fullName, givenName, familyName, role } = req.body;
    const errors = [];

    if (!email) {
        errors.push('Email is missing.');
    }
    if (!password) {
        errors.push('Password is missing.');
    }
    if (!fullName) {
        errors.push('Full name is missing.');
    }
    if (!givenName) {
        errors.push('Given name is missing.');
    }
    if (!familyName) {
        errors.push('Family name is missing.');
    }
    if (!role) {
        errors.push('Role is missing.');
    }

    if(errors.length > 0){
        res.status(400).type('text/plain').json({ errors });
    } else {
        const existingUser = usersArray.find(user => user.email === email);
    if (existingUser) {
        res.status(400).type('text/plain').json({error: 'Email already registered.'});
    } else {

        const newUserId = nanoid();
        const currentDate = new Date().toDateString();
        const newUser = {
            email,
            password,
            fullName,
            givenName,
            familyName,
            role,
            _id: newUserId,
            creationDate: currentDate,
        };
        usersArray.push(newUser);
        res.status(200).type('text/plain').json({message: `New user registered!`});
    }
}
});

router.post('/login', (req,res) => {
    //FIXME: check user's email and password as a send response as JSON
    const { email, password} = req.body;

    if(!email || !password){
        res.status(400).type('text/plain').json({message: 'Please input your login credentials'});
    }

    const existingUser = usersArray.find(user => user.email === email);
    if (existingUser && existingUser.password === password){
        res.status(200).type('text/plain').json({message: `Welcome back ${existingUser.fullName}.`});
    } else {
        res.status(404).type('text/plain').json({message: 'Invalid login credentials'});
    }
});

router.put('/:userId', (req,res) => {
    //FIXME:  update existing user and send response as JSON
    const userId = req.params.userId;
    const currentUser = usersArray.find(user => user._id == userId);

    const updatedUser = req.body;

    if(currentUser){
        for(const key in updatedUser){
            if(currentUser[key] != updatedUser[key]){
                currentUser[key] = updatedUser[key];
            }
        }

        const index = usersArray.findIndex(user => user._id == userId);
        if(index != -1){
            usersArray[index] = currentUser;
            currentUser.lastUpdated = new Date().toDateString();
        }
        res.status(200).type('text/plain').json({message: 'User updated!'});
    } else {
        res.status(404).type('text/plain').json({message: `User ${userId} not found.`});
    }
});

router.delete('/:userId', (req,res) => {
    //FIXME: delete user and send response as JSON
    const userId = req.params.userId;

    const index = usersArray.findIndex(user => user._id == userId);
    if(index != -1){
        usersArray.splice(index,1);
        res.status(200).type('text/plain').json({message: `User deleted!`});
    } else {
        res.status(404).type('text/plain').json({message: `User ${userId} not found.`});
    }
});


export {router as UserRouter};