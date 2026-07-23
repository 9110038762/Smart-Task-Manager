# Smart Task Manager

A full-stack, real-time task management application built using the MERN stack (MongoDB, Express, React, Node) featuring JWT-based authentication, Role-Based Access Control (RBAC), and real-time smart reminder alerts.

---

## 🚀 How to Run the Application

The project has been configured with an orchestrator script that boots up both the backend and frontend dev servers concurrently.

### Booting Up Services
In your terminal, execute:
```bash
./run.sh
```

Once running:
* **Frontend Web Application**: [http://localhost:5173](http://localhost:5173)
* **Backend REST API**: [http://localhost:5005](http://localhost:5005)

*Press `Ctrl + C` in the terminal to cleanly terminate both servers.*

---

## 🔒 Role-Based Access Control (RBAC) Testing

During account creation (registration), you can pick a specific workplace role to test multi-user workflows:

1. **User Role**:
   - Access: Can view tasks assigned to them or created by them.
   - Permissions: Can **only** drag-and-drop or edit the **status** (Todo, In Progress, Review, Done) of their tasks. All other task details (title, due date, assignee, etc.) are disabled.
2. **Manager Role**:
   - Access: Can view all tasks in the system.
   - Permissions: Can create new tasks, assign tasks to any registered member, update all fields of any task, and schedule smart reminders. Cannot manage user roles.
3. **Admin Role**:
   - Access: Can view all tasks and access the **Team Roles** control panel.
   - Permissions: Has full CRUD permissions for all tasks, and can change the system-wide roles of any registered user (e.g. promoting a regular User to a Manager or Admin).

### 💡 Suggested Testing Flow
* Open two different browser tabs (or one normal window and one incognito window).
* Register one user as **Admin** and another as **User**.
* As the **Admin**: Create a new task and select the other user as the assignee.
* As the **User**: Log in. You will see the task appear on your board. Try to edit the task; notice you can only change its status. Drag and drop it to "In Progress".
* Go back to the **Admin** window. You will see the task has automatically updated on the admin's board.

---

## 🔔 Smart Real-Time Reminders

The system runs a background scheduler that monitors due reminders every 10 seconds.

### How to Test Reminders:
1. Log in to your account.
2. Create or edit a task.
3. Under the **Set Smart Reminder** section, pick a date and time exactly **1 minute** in the future.
4. Click **Save Task**.
5. Wait for the designated time. You will see a glowing purple toast alert slide in at the bottom-right of the dashboard instantly.

---

## 📂 Project Architecture

```
├── backend/
│   ├── models/           # Mongoose schemas (User, Task, Reminder)
│   ├── middleware/       # JWT auth & RBAC guards
│   ├── routes/           # REST endpoints
│   ├── server.js         # Entrypoint, WebSocket server & scheduler
│   └── .env              # Server configuration
├── frontend/
│   ├── src/
│   │   ├── components/   # Modal & Toast UI components
│   │   ├── context/      # Authentication & Socket sync context
│   │   ├── pages/        # Login, Register, Dashboard views
│   │   ├── App.jsx       # Client routes and guard components
│   │   ├── index.css     # Premium glassmorphic styling system
│   │   └── main.jsx      # Vite React mount
│   └── package.json
└── run.sh                # Services bootstrapper
```

### 🗄️ Database Fallback Design
If a custom `MONGO_URI` is not provided in `backend/.env`, the backend server will automatically spin up an in-memory MongoDB instance (`mongodb-memory-server`) locally. This guarantees the application works out-of-the-box without requiring a local database installation or network configuration!
