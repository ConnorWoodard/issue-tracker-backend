/* eslint-disable no-undef */
import * as dotenv from 'dotenv';
dotenv.config();
import debug from 'debug';
const debugMain = debug('app:Server');
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { UserRouter } from './routes/api/user.js';
import { BugRouter } from './routes/api/bug.js';
import { CommentRouter } from './routes/api/comment.js';
import { TestRouter } from './routes/api/test.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//create our web server
const app = express();

app.use(express.static('public'));
app.use(express.urlencoded({extended: true}));
app.use('/api/user', UserRouter);
app.use('/api/bug', BugRouter);
app.use('/api/bugs', CommentRouter);
app.use('/api/bug', TestRouter);

//register routes
app.get('/',(req,res) => {
    debugMain('Home Route hit');
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

//Register Error Handlers
app.use((req,res) => {
    debugMain(`Sorry couldn't find ${req.originalUrl}`);
    res.status(404).json({error:`Sorry couldn't find ${req.originalUrl}`});
});

//add Listener for requests
const port = process.env.PORT || 5001;

app.listen(port, () => {
    debugMain(`Listening on port http://localhost:${port}`);
});