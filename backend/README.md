# D2D HR Backend API

This is the backend API for the D2D HR System. It is built with Node.js, Express, and MySQL.

## Setup

1.  **Install Dependencies:**
    ```bash
    cd backend
    npm install
    ```

2.  **Database Setup:**
    - Ensure you have MySQL installed and running.
    - Create a database named `d2donehr`.
    - Run the SQL script in `database_mysql.sql` to create the tables.
    ```bash
    mysql -u root -p d2donehr < database_mysql.sql
    ```

3.  **Environment Variables:**
    - The `.env` file has been created with default values. Update `DB_NAME`, `DB_USER`, `DB_PASSWORD` if needed.

4.  **Run Server:**
    ```bash
    npm start
    # OR for development
    npm run dev
    ```

## API Endpoints

Base URL: `http://localhost:5000/api`

### Employees
- `GET /employees` - List all employees
- `GET /employees/:id` - Get employee details
- `POST /employees` - Create new employee
- `PUT /employees/:id` - Update employee
- `DELETE /employees/:id` - Delete employee

### Attendance
- `GET /attendance` - List all records
- `GET /attendance/employee/:employee_id` - List by employee
- `POST /attendance` - Check-in/Record attendance
- `PUT /attendance/:id` - Update (Check-out)

### Leaves
- `GET /leaves` - List all requests
- `POST /leaves` - Create request
- `PUT /leaves/:id` - Update status (Approve/Reject)

### Assets
- `GET /assets` - List all assets
- `POST /assets` - Create asset
- `POST /assets/assign` - Assign asset to employee

### Other Routes
- `/shifts` - Shift management
- `/warnings` - Disciplinary actions
- `/outdoor` - Outdoor sales activities
- `/holidays` - Public holidays
- `/notifications` - System notifications
- `/settings` - System settings
- `/audit` - Audit logs

## Folder Structure
- `server.js` - Main entry point
- `db.js` - Database connection
- `routes/` - API Route definitions
