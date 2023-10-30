import express from 'express';
const router = express.Router();

import debug from 'debug';
const debugComment = debug('app:CommentRouter');

import Joi from 'joi';

import { nanoid } from 'nanoid';
import { connect, getUserById, getCommentById, getComments, addComment,newId } from '../../database.js';
import { validBody } from '../../middleware/validBody.js';
import { validId } from '../../middleware/validId.js';
import jwt from 'jsonwebtoken';
import {isLoggedIn} from '@merlin4/express-auth';

// Define the comment schema with userId
const commentSchema = Joi.object({
    userId: Joi.string().required(),
    text: Joi.string().min(1).max(1000).required(),
});

router.get('/:bugId/comment/list', isLoggedIn(), validId('bugId'), async (req, res) => {
    const bugId = req.bugId;
    debugComment(`Getting comments for bug ${bugId}`);

    try {
        // Fetch comments for the specified bug from the database
        const comments = await getComments(bugId);
        res.status(200).json(comments);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

router.get('/:bugId/comment/:commentId', isLoggedIn(), validId('bugId'), validId('commentId'), async (req, res) => {
  const bugId = req.bugId;
  const commentId = req.commentId;
  console.log(`Received bugId: ${bugId}, commentId: ${commentId}`);
  debugComment(`Getting comment ${commentId} for bug ${bugId}`);

  try {
    const comment = await getCommentById(bugId, commentId);
    res.status(200).json(comment);
  } catch (err) {
    res.status(404).json({ error: err.message }); // Use a 404 status code for "not found"
  }
});

router.put('/:bugId/comment/new',isLoggedIn(), validId('bugId'), validBody(commentSchema), async (req, res) => {
  const bugId = req.bugId; // Use req.params to get the bugId
  const text = req.body.text; // Get the comment text from req.body

  debugComment(`Adding a comment to bug ${bugId}`);

  try {
    // Use req.auth to get the user who posted the comment
    const user = await getUserById(req.auth._id);

    const comment = {
      commentId: newId(), // Generate a unique comment ID
      author: user, // Use the user's full name
      text,
      createdAt: new Date().toLocaleString('en-US'),
    };

    // Insert the new comment into the database
    await addComment(bugId, comment);
    res.status(200).json({ message: 'New comment added!', commentId: comment.commentId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export {router as CommentRouter};