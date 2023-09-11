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
    if(user){
      res.status(200).send(user);
    } else {
      res.status(404).send({message: `User ${userId} not found`});
    }
});

router.post('/register', (req,res) => {
    //FIXME: Register new user and send response as JSON
    const newUser = req.body;
    res.status(400).type('text/plain').send()
});

router.post('/login', (req,res) => {
    //FIXME: check user's email and password as a send response as JSON
});

router.put(':/userId', (req,res) => {
    //FIXME:  update existing user and send response as JSON
});

router.delete(':/userId', (req,res) => {
    //FIXME: delete user and send response as JSON
});


export {router as UserRouter};