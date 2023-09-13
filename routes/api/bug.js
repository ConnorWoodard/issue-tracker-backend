import express from 'express';
const router = express.Router();

import debug from 'debug';
const debugBug = debug('app:BugRouter');

import { nanoid } from 'nanoid';

router.use(express.urlencoded({extended:false}));

const bugsArray = [{"title":"Button doesn't work","description":"Clicking the link doesnt take me anywhere. Even after refreshing.","stepsToReproduce":"I log into my account and try to click on the link. And it just doesnt work.","_id": 1},
{"title":"Sent to wrong site","description":"When I click on the about link, it takes me back to the homepage.","stepsToReproduce":"I log into my account and browse the home page for a bit. Then I click on the about link but it refreshes to the main page.", "_id":2},
{"title":"Keeps crashing","description":"I can explore the site for 10 minutes but then the page just crashes","stepsToReproduce":"Login to account and browse for a few minutes. MAybe have other tabs open","_id":3},
{"title":"Error code 404","description":"Whenever I try to log in, an error 404 message opens saying that it cant find my account","stepsToReproduce":"Login to this persons account, see what is going on","_id":4}]

router.get('/list', (req,res) => {
    debugBug('bug list route hit');
    res.status(200).json(bugsArray);
});

router.get('/:bugId', (req,res) => {
    const bugId = req.params.bugId;
    //FIXME: get bug from bugsArray and send response as JSON
    const bug = bugsArray.find(bug => bug._id == bugId);
    if(bug){
        res.status(200).json(bug);
    } else {
        res.status(404).type('text/plain').json({message: `Bug ${bugId} not found.`});
    }
});

router.post('/new', (req,res) => {
    //FIXME: create new bug and send response as JSON
    const {title, description, stepsToReproduce} = req.body;
    const errors = [];

    if(!title){
        errors.push('Title is missing');
    }
    if(!description){
        errors.push('Description is missing');
    }
    if(!stepsToReproduce){
        errors.push('Steps to reproduce is missing');
    }

    if(errors.length > 0){
        res.status(400).type('text/plain').json({ errors });
    }else{

    const newBugId = nanoid();
    const currentDate = new Date().toDateString();
    const newBug = {
        title,
        description,
        stepsToReproduce,
        _id: newBugId,
        creationDate: currentDate,
    };
    bugsArray.push(newBug);
    res.status(200).type('text/plain').json({message: 'New bug reported'});
}
});

router.put('/:bugId', (req,res) => {
    //FIXME: update existing bug and send response as JSON
    const bugId = req.params.bugId;
    const currentBug = bugsArray.find(bug => bug._id == bugId);

    const updatedBug = req.body;

    if(currentBug){
        for(const key in updatedBug){
            if(currentBug[key] != updatedBug[key]){
                currentBug[key] = updatedBug[key];
            }
        }
        const index = bugsArray.findIndex(bug => bug._id == bugId);
        if(index != -1){
            bugsArray[index] = currentBug;
            currentBug.lastUpdated = new Date().toDateString();
        }
        res.status(200).type('text/plain').json({message: 'Bug updated!'});
    } else {
        res.status(404).type('text/plain').json({message: `Bug ${bugId} not found.`});
    }
});

router.put('/:bugId/classify', (req,res) => {
    //FIXME: Classify bug and send response as JSON
    const bugId = req.params.bugId;
    const { classification } = req.body;

    const bugToUpdate = bugsArray.find(bug => bug._id == bugId);

    if(!bugToUpdate){
        res.status(404).type('text/plain').json(`Bug ${bugId} not found.`);
    }
    else if(!classification){
        res.status(400).type('text/plain').json('Classification is missing or invalid.');
    } else {
        bugToUpdate.classification = classification;
        bugToUpdate.classifiedOn = new Date().toDateString();
        bugToUpdate.lastUpdated = new Date().toDateString();

        res.status(200).type('text/plain').json({message: 'Bug classified'});
    }
});

router.put('/:bugId/assign', (req,res) => {
    //FIXME: assign bug to a user and send response as JSON
    const bugId = req.params.bugId;
    const { assignedToUserId, assignedToUserName} = req.body;

    const bugToAssign = bugsArray.find(bug => bug._id == bugId);

    if(!bugToAssign){
        res.status(404).type('text/plain').json(`Bug ${bugId} not found.`);
    }
    else if(!assignedToUserId || !assignedToUserName){
        res.status(400).type('text/plain').json('Assigned user data is missing or invalid.');
    } else {
        bugToAssign.assignedToUserId = assignedToUserId;
        bugToAssign.assignedToUserName = assignedToUserName;
        bugToAssign.assignedOn = new Date().toDateString();
        bugToAssign.lastUpdated = new Date().toDateString();

        res.status(200).type('text/plain').json({message: `Bug assigned!`});
    }
});

router.put('/:bugId/close', (req,res) => {
    //FIXME: close bug and send response as JSON
    const bugId = req.params.bugId;
    const { closed } = req.body;

    const bugToClose = bugsArray.find(bug => bug._id == bugId);

    if (!bugToClose) {
        res.status(404).type('text/plain').json(`Bug ${bugId} not found.`);
    } else if (closed !== 'true' && closed !== 'false') {
        return res.status(400).type('text/plain').send('The "closed" field is missing or invalid.');
    } else {
        const isClosed = closed === 'true';
        bugToClose.closed = isClosed;
        bugToClose.closedOn = isClosed ? new Date().toDateString() : null;
        bugToClose.lastUpdated = new Date().toDateString();
        if(closed === 'true'){
            res.status(200).type('text/plain').json('Bug closed!');
        } else {
            res.status(200).type('text/plain').json('Bug is open');
        }
    }
});

export {router as BugRouter};