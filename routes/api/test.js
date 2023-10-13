import express from 'express';
const router = express.Router();

import debug from 'debug';
const debugTest = debug('app:TestRouter');

import Joi from 'joi';

import { nanoid } from 'nanoid';
import { addTestCase, connect, deleteTestCase, getTestCaseById, getTestCases, updateTestCase, newId } from '../../database.js';
import { validBody } from '../../middleware/validBody.js';
import { validId } from '../../middleware/validId.js';

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

router.get('/:bugId/test/list', validId('bugId'), async (req, res) => {
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
router.get('/:bugId/test/:testId', validId('bugId'), validId('testId'), async (req, res) => {
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
router.put('/:bugId/test/new', validId('bugId'), validBody(testCaseSchema), async (req, res) => {
  const bugId = req.bugId;
  const { userId, isPassed } = req.body;
  debugTest(`Adding a new test case to bug ${bugId}`);

  try {
    const testCase = {
      testId: newId(), // Generate a unique test ID
      userId,
      isPassed: (typeof isPassed === 'string' && isPassed.toLowerCase() === 'true') ? true : !!isPassed,
      createdOn: new Date().toLocaleString('en-US'),
    };

    await addTestCase(bugId, testCase);
    res.status(200).json({ message: 'New test case added!', testId: testCase.testId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bug/:bugId/test/:testId
router.put('/:bugId/test/:testId', validId('bugId'), validId('testId'), validBody(updateTestCaseSchema), async (req, res) => {
  const bugId = req.bugId;
  const testId = req.testId;
  const { isPassed } = req.body;
  debugTest(`Updating test case ${testId} for bug ${bugId}`);

  try {
    // Validate and convert the isPassed value to a boolean
    const isTestPassed = isPassed === 'true' || isPassed === true;

    await updateTestCase(bugId, testId, isTestPassed);
    res.status(200).json({ message: 'Test case updated!', testId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bug/:bugId/test/:testId
router.delete('/:bugId/test/:testId', validId('bugId'), validId('testId'), async (req, res) => {
  const bugId = req.bugId;
  const testId = req.testId;
  debugTest(`Deleting test case ${testId} for bug ${bugId}`);

  try {
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