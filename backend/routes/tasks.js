const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Reminder = require('../models/Reminder');
const { protect, authorize } = require('../middleware/auth');

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    // If not Admin or Manager, user only sees their created or assigned tasks
    if (req.user.role === 'User') {
      query = {
        $or: [
          { creator: req.user.id },
          { assignee: req.user.id }
        ]
      };
    }

    const tasks = await Task.find(query)
      .populate('creator', 'name email role')
      .populate('assignee', 'name email role')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Create a task
// @route   POST /api/tasks
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    // Add creator to body
    req.body.creator = req.user.id;

    // Handle empty assignee
    if (!req.body.assignee) {
      delete req.body.assignee;
    }

    const task = await Task.create(req.body);
    const populatedTask = await Task.findById(task._id)
      .populate('creator', 'name email role')
      .populate('assignee', 'name email role');

    const io = req.app.get('io');
    if (io) {
      io.emit('task_created', populatedTask);
    }

    res.status(201).json({ success: true, data: populatedTask });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('creator', 'name email role')
      .populate('assignee', 'name email role');

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Check ownership if user is regular User
    if (req.user.role === 'User') {
      const isCreator = task.creator._id.toString() === req.user.id;
      const isAssignee = task.assignee && task.assignee._id.toString() === req.user.id;
      if (!isCreator && !isAssignee) {
        return res.status(403).json({ success: false, error: 'Not authorized to view this task' });
      }
    }

    res.status(200).json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // RBAC logic for update
    if (req.user.role === 'User') {
      const isCreator = task.creator.toString() === req.user.id;
      const isAssignee = task.assignee && task.assignee.toString() === req.user.id;

      if (!isCreator && !isAssignee) {
        return res.status(403).json({ success: false, error: 'Not authorized to update this task' });
      }

      // Regular user can only update status
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ success: false, error: 'Regular users can only update task status' });
      }
      
      task.status = status;
      await task.save();
    } else {
      // Manager/Admin can update all fields
      if (req.body.title !== undefined) task.title = req.body.title;
      if (req.body.description !== undefined) task.description = req.body.description;
      if (req.body.status !== undefined) task.status = req.body.status;
      if (req.body.priority !== undefined) task.priority = req.body.priority;
      if (req.body.dueDate !== undefined) task.dueDate = req.body.dueDate;
      if (req.body.category !== undefined) task.category = req.body.category;

      if ('assignee' in req.body) {
        task.assignee = req.body.assignee ? req.body.assignee : undefined;
      }

      await task.save();
    }

    const updatedTask = await Task.findById(task._id)
      .populate('creator', 'name email role')
      .populate('assignee', 'name email role');

    const io = req.app.get('io');
    if (io) {
      io.emit('task_updated', updatedTask);
    }

    res.status(200).json({ success: true, data: updatedTask });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private (Manager & Admin only)
router.delete('/:id', protect, authorize('Manager', 'Admin'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    await task.deleteOne();
    await Reminder.deleteMany({ task: req.params.id });

    const io = req.app.get('io');
    if (io) {
      io.emit('task_deleted', { taskId: req.params.id });
    }

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
