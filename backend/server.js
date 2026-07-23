require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const cron = require('node-cron');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const reminderRoutes = require('./routes/reminders');
const adminRoutes = require('./routes/admin');
const Reminder = require('./models/Reminder');
const Task = require('./models/Task');

const app = express();
const server = http.createServer(app);

// Enable CORS with support for credentials
app.use(cors({
  origin: '*', // In development, allow all origins. Can be restricted to React app port.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/admin', adminRoutes);

// Simple Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Smart Task Manager Server is running.' });
});

// Socket.io Setup
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store active socket connections map: userId -> socketId
const activeSockets = new Map();

io.on('connection', (socket) => {
  console.log(`New Socket Client Connected: ${socket.id}`);

  // Register user
  socket.on('register', (userId) => {
    if (userId) {
      activeSockets.set(userId.toString(), socket.id);
      console.log(`Socket user registered: User ${userId} connected on socket ${socket.id}`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Socket Client Disconnected: ${socket.id}`);
    // Clean up from activeSockets map
    for (const [userId, socketId] of activeSockets.entries()) {
      if (socketId === socket.id) {
        activeSockets.delete(userId);
        console.log(`Socket user unregistered: User ${userId}`);
        break;
      }
    }
  });
});

// Smart Reminder Background Scheduler
// Checks every 10 seconds for testing responsiveness
setInterval(async () => {
  try {
    const now = new Date();
    // Find all unsent reminders that are due
    const pendingReminders = await Reminder.find({
      reminderTime: { $lte: now },
      isSent: false
    }).populate('task');

    for (const reminder of pendingReminders) {
      if (!reminder.task) {
        // Task has been deleted, delete reminder
        await reminder.deleteOne();
        continue;
      }

      // Mark as sent
      reminder.isSent = true;
      await reminder.save();

      console.log(`[Smart Reminder Alert] Task "${reminder.task.title}" is due for User ${reminder.user}`);

      // Dispatch real-time notification if user is online
      const userSocketId = activeSockets.get(reminder.user.toString());
      if (userSocketId) {
        io.to(userSocketId).emit('reminder_notification', {
          id: reminder._id,
          task: {
            id: reminder.task._id,
            title: reminder.task.title,
            description: reminder.task.description,
            dueDate: reminder.task.dueDate,
            priority: reminder.task.priority,
            status: reminder.task.status
          },
          reminderTime: reminder.reminderTime,
          channel: reminder.channel
        });
        console.log(`[Smart Reminder Alert] Successfully sent real-time socket alert to user ${reminder.user}`);
      } else {
        console.log(`[Smart Reminder Alert] User ${reminder.user} is offline. Notification queued.`);
      }

      // If channel is Email, simulate sending an email
      if (reminder.channel === 'Email') {
        console.log(`[SIMULATED EMAIL SENT] To user ID: ${reminder.user} for Task "${reminder.task.title}"`);
      }
    }
  } catch (err) {
    console.error('Error running reminder check interval:', err);
  }
}, 10000);

// Connect to Database and start server
let mongoServer;
const connectDB = async () => {
  const dbUri = process.env.MONGO_URI;
  if (dbUri) {
    try {
      await mongoose.connect(dbUri);
      console.log('Successfully connected to MongoDB Database');
      return;
    } catch (err) {
      console.error('Failed connecting to configured MONGO_URI. Trying memory database fallback...', err);
    }
  }

  // Fallback to in-memory database
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log(`Connected to fallback In-Memory MongoDB running at: ${uri}`);
  } catch (err) {
    console.error('Database connection failed completely. Memory server could not be created:', err);
    process.exit(1);
  }
};

const PORT = process.env.PORT || 5005;

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
};

startServer().catch(err => {
  console.error('Failed starting backend server:', err);
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received. Shutting down gracefully.');
  server.close(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('Backend server closed.');
    process.exit(0);
  });
});
