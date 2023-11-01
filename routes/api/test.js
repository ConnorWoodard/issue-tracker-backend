import express from 'express';
const router = express.Router();

import debug from 'debug';
const debugTest = debug('app:TestRouter');

import Joi from 'joi';

import { nanoid } from 'nanoid';
import { addTestCase, connect, getUserById, deleteTestCase, getTestCaseById, getTestCases, updateTestCase, newId, getBugById, saveEdit } from '../../database.js';
import { validBody } from '../../middleware/validBody.js';
import { validId } from '../../middleware/validId.js';
import jwt from 'jsonwebtoken';
import {isLoggedIn, hasPermission} from '@merlin4/express-auth';

// Define the Test Case Schema for validation
const testCaseSchema = Joi.object({
  userId: Joi.string().required(),
  isPassed: Joi.alternatives().try(
      Joi.boolean(),
      Joi.string().valid("true", "false")
  ).required(),
});

const updateTestCaseSchema = Joi.object({
  isPassed: Joi.alternatives().try((Joi.boolean(), Joi.string().valid('true', 'false'))),
});

router.get('/:bugId/test/list', isLoggedIn(), hasPermission('canViewData'),validId('bugId'), async (req, res) => {
  const bugId = req.bugId;
  debugTest(`Getting test cases for bug ${bugId}`);

  try {
    const testCases = await getTestCases(bugId);
    res.status(200).json(testCases);
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

// GET /api/bug/:bugId/test/:testId
router.get('/:bugId/test/:testId', isLoggedIn(),hasPermission('canViewData'), validId('bugId'), validId('testId'), async (req, res) => {
  const bugId = req.bugId;
  const testId = req.testId;
  debugTest(`Getting test case ${testId} for bug ${bugId}`);

  try {
    const testCase = await getTestCaseById(bugId, testId);
    if (testCase) {
      res.status(200).json(testCase);
    } else {
      res.status(404).json({ error: 'Test case not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

// PUT /api/bug/:bugId/test/new
router.put('/:bugId/test/new', isLoggedIn(),hasPermission('canAddTestCase'), validId('bugId'), validBody(testCaseSchema), async (req, res) => {
  const bugId = req.bugId;
  const newTestCase = req.body;
  debugTest(`Adding a new test case to bug ${bugId}`);

  try {
    const user = await getUserById(newId(req.auth._id))
    const testCase = {
      testId: newId(), // Generate a unique test ID
      isPassed: (typeof newTestCase.isPassed === 'string' && newTestCase.isPassed.toLowerCase() === 'true') ? true : !!newTestCase.isPassed,
      createdBy: user.fullName,
      createdOn: new Date().toLocaleString('en-US'),
    };

    const dbResult = await addTestCase(bugId, testCase);
    debugTest(dbResult);
    if(dbResult.acknowledged == true){
        const edit = {
          timestamp: new Date().toLocaleString('en-US'),
          col: 'bug',
          op: 'insert',
          target: { bugId: bugId },
          update: {
            isPassed: newTestCase.isPassed,
            createdOn: new Date().toLocaleString('en-US'),
            creator: {
              fullName: user.fullName,
              userId: user._id,
            },
        },
        auth: { _id: req.auth._id, fullName: user.fullName, title: updatedBug.title },
    }
    await saveEdit(edit);
    res.status(200).json({ message: 'New test case added!', testId: testCase.testId });
  }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bug/:bugId/test/:testId
router.put('/:bugId/test/:testId', isLoggedIn(),hasPermission('canEditTestCase'), validId('bugId'), validId('testId'), validBody(updateTestCaseSchema), async (req, res) => {
  const bugId = req.bugId;
  const testId = req.testId;
  const updatedTestCase = req.body;

  debugTest(`Updating test case ${testId} for bug ${bugId}`);

  try {
    const user = await getUserById(newId(req.auth._id))
    const bug = await getBugById(bugId);
    // Validate and convert the isPassed value to a boolean
    const isPassed = updatedTestCase.isPassed === 'true' || updatedTestCase.isPassed === true;

    const updatedBug = await updateTestCase(bugId, testId, isPassed, user);
    if (updatedBug) {
      const changes = {
          testCases: updatedBug.testCases
      };

      // Construct the edit object
      const edit = {
          timestamp: new Date().toLocaleString('en-US'),
          col: 'bug',
          op: 'update',
          target: { bugId },
          update: changes, // Include the changes object
          auth: { _id: req.auth._id, fullName: user.fullName, title: updatedBug.title },
      };

      // Save the edit
      await saveEdit(edit);
    res.status(200).json({ message: 'Test case updated!', testId });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bug/:bugId/test/:testId
router.delete('/:bugId/test/:testId', isLoggedIn(),hasPermission('canDeleteTestCase'), validId('bugId'), validId('testId'), async (req, res) => {
  const bugId = req.bugId;
  const testId = req.testId;
  debugTest(`Deleting test case ${testId} for bug ${bugId}`);

  try {
    if (testId) {
      const edit = {
        timestamp: new Date().toLocaleString('en-US'),
        col: 'bug',
        op: 'delete',
        target: { testId },
        auth: req.auth,
      };
      await saveEdit(edit);
    }
    const deleted = await deleteTestCase(bugId, testId);
    if (deleted) {
      res.status(200).json({ message: 'Test case deleted!' });
    } else {
      res.status(404).json({ error: 'Test case not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export {router as TestRouter};