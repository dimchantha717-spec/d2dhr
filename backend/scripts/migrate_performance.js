const db = require('../config/db');

const createPerformanceTable = `
CREATE TABLE IF NOT EXISTS performance_reviews (
  id VARCHAR(50) NOT NULL,
  employee_id VARCHAR(50) NOT NULL,
  reviewer_id VARCHAR(50) DEFAULT NULL,
  review_date DATE NOT NULL,
  rating INT(11) DEFAULT 0,
  comments TEXT,
  goals TEXT,
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY employee_id (employee_id),
  CONSTRAINT performance_employee_fk FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

(async () => {
    try {
        console.log('Running migration...');
        await db.query(createPerformanceTable);
        console.log('✅ Performance table created successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
})();
