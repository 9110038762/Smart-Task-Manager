const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reminderTime: {
    type: Date,
    required: [true, 'Please add a reminder date and time']
  },
  isSent: {
    type: Boolean,
    default: false
  },
  channel: {
    type: String,
    enum: ['System', 'Email'],
    default: 'System'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Reminder', ReminderSchema);
