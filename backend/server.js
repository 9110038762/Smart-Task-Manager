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

// On Vercel serverless, ensure database connection is established before routing requests
let isConnected = false;
if (process.env.VERCEL) {
  app.use(async (req, res, next) => {
    try {
      await connectDB();
      next();
    } catch (err) {
      console.error('Database connection error on serverless invocation:', err);
      return res.status(500).json({
        success: false,
        error: 'Database connection failed: ' + (err.message || 'Please check your MONGO_URI configuration.')
      });
    }
  });
}

// Socket.io Setup
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
});

// Expose io instance to Express routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/admin', adminRoutes);

// Simple Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Smart Task Manager Server is running.' });
});

// Socket connection handling
io.on('connection', (socket) => {
  console.log(`New Socket Client Connected: ${socket.id}`);

  // Register user into a dedicated user room
  socket.on('register', (userId) => {
    if (userId) {
      const room = `user:${userId.toString()}`;
      socket.join(room);
      console.log(`Socket user registered: User ${userId} joined room ${room} on socket ${socket.id}`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Socket Client Disconnected: ${socket.id}`);
  });
});

// Smart Reminder Check Function
const checkReminders = async () => {
  try {
    const now = new Date();
    // Find all unsent reminders that are due
    const pendingReminders = await Reminder.find({
      reminderTime: { $lte: now },
      isSent: false
    }).populate('task');

    const processed = [];

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
      processed.push(reminder);

      // Dispatch real-time notification to user room
      const userRoom = `user:${reminder.user.toString()}`;
      io.to(userRoom).emit('reminder_notification', {
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
      console.log(`[Smart Reminder Alert] Real-time socket alert dispatched to room ${userRoom}`);

      // If channel is Email, simulate sending an email
      if (reminder.channel === 'Email') {
        console.log(`[SIMULATED EMAIL SENT] To user ID: ${reminder.user} for Task "${reminder.task.title}"`);
      }
    }
    return processed;
  } catch (err) {
    console.error('Error running reminder check:', err);
    throw err;
  }
};

// Cron endpoint for Vercel Cron or external schedulers
app.get('/api/cron/reminders', async (req, res) => {
  // Enforce security check if running on Vercel
  if (process.env.VERCEL) {
    const hasCronHeader = req.headers['x-vercel-cron'] === '1';
    const hasAuthHeader = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
    if (!hasCronHeader && !hasAuthHeader) {
      return res.status(401).json({ success: false, error: 'Unauthorized cron request' });
    }
  }

  try {
    const processedReminders = await checkReminders();
    res.status(200).json({
      success: true,
      message: 'Reminder cron check completed successfully',
      count: processedReminders.length,
      processed: processedReminders.map(r => ({ id: r._id, task: r.task?.title }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Run background interval check ONLY when not running as a Serverless Function on Vercel
if (!process.env.VERCEL) {
  setInterval(async () => {
    try {
      await checkReminders();
    } catch (err) {
      console.error('Error running reminder check interval:', err);
    }
  }, 10000);
}

// Connect to Database and start server
let mongoServer;
const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const dbUri = process.env.MONGO_URI;
  if (dbUri) {
    try {
      await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 5000 });
      isConnected = true;
      console.log('Successfully connected to MongoDB Database');
      return;
    } catch (err) {
      console.error('Failed connecting to configured MONGO_URI:', err.message);
      if (process.env.VERCEL) {
        throw err;
      }
    }
  }

  // Fallback to in-memory database (only for non-serverless local runs)
  if (!process.env.VERCEL) {
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      if (!mongoServer) {
        mongoServer = await MongoMemoryServer.create();
      }
      const uri = mongoServer.getUri();
      await mongoose.connect(uri);
      isConnected = true;
      console.log(`Connected to fallback In-Memory MongoDB running at: ${uri}`);
    } catch (err) {
      console.error('Database connection failed completely. Memory server could not be created:', err);
      process.exit(1);
    }
  } else {
    console.error('Error: MONGO_URI must be provided when running in a serverless environment (Vercel).');
    throw new Error('Missing MONGO_URI environment variable. Please set MONGO_URI in your Vercel Project Settings.');
  }
};

const PORT = process.env.PORT || 5005;

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
};

// If running in local/persistent mode, start server; on Vercel, just initialize DB connection
if (!process.env.VERCEL) {
  startServer().catch(err => {
    console.error('Failed starting backend server:', err);
  });
} else {
  // Trigger connection and cache it for subsequent serverless requests
  connectDB().catch(err => {
    console.error('Failed to initialize database connection on serverless startup:', err);
  });
}

// Graceful Shutdown (only applicable in persistent servers)
if (!process.env.VERCEL) {
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
}

module.exports = app;
