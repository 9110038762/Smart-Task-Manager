const express = require('express');
const router = express.Router();
const Reminder = require('../models/Reminder');
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');

// @desc    Get all reminders for logged in user
// @route   GET /api/reminders
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const reminders = await Reminder.find({ user: req.user.id })
      .populate({
        path: 'task',
        select: 'title description status priority dueDate'
      })
      .sort('reminderTime');

    res.status(200).json({ success: true, count: reminders.length, data: reminders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Create a reminder
// @route   POST /api/reminders
// @access  Private
router.post('/', protect, async (req, res) => {
  const { taskId, reminderTime, channel } = req.body;

  try {
    // Check if task exists and user has access to it
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    if (req.user.role === 'User') {
      const isCreator = task.creator.toString() === req.user.id;
      const isAssignee = task.assignee && task.assignee.toString() === req.user.id;
      if (!isCreator && !isAssignee) {
        return res.status(403).json({ success: false, error: 'Not authorized to create a reminder for this task' });
      }
    }

    // Check if reminderTime is in the future
    if (new Date(reminderTime) <= new Date()) {
      return res.status(400).json({ success: false, error: 'Reminder time must be in the future' });
    }

    // Delete existing reminder for the same task and user to prevent duplicates
    await Reminder.deleteMany({ task: taskId, user: req.user.id });

    const reminder = await Reminder.create({
      task: taskId,
      user: req.user.id,
      reminderTime,
      channel: channel || 'System'
    });

    const populatedReminder = await Reminder.findById(reminder._id)
      .populate({
        path: 'task',
        select: 'title description status priority dueDate'
      });

    res.status(201).json({ success: true, data: populatedReminder });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// @desc    Delete a reminder
// @route   DELETE /api/reminders/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);

    if (!reminder) {
      return res.status(404).json({ success: false, error: 'Reminder not found' });
    }

    // Check ownership
    if (reminder.user.toString() !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this reminder' });
    }

    await reminder.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
