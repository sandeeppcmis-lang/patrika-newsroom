-- ============================================================
--  Patrika Newsroom — MySQL Full Setup Script
--  Run this once on your MySQL server before starting the app.
--  Replace `editorial_reports` with your actual database name.
-- ============================================================

-- ── Users (login & role management) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100)  NOT NULL UNIQUE,
  name          VARCHAR(200)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('Admin','State Head','Regional Editor','Legal') NOT NULL DEFAULT 'Regional Editor',
  state         VARCHAR(100)  DEFAULT NULL,
  branch        VARCHAR(100)  DEFAULT NULL,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Legal Cases ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS legal_cases (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  case_no    VARCHAR(100) NOT NULL UNIQUE,
  edition    VARCHAR(100) DEFAULT NULL,
  court      VARCHAR(200) DEFAULT NULL,
  party      VARCHAR(200) DEFAULT NULL,
  advocate   VARCHAR(200) DEFAULT NULL,
  hearing    DATE         DEFAULT NULL,
  status     VARCHAR(50)  DEFAULT 'Active',
  risk       VARCHAR(20)  DEFAULT 'Low',
  documents  TEXT         DEFAULT NULL,
  notes      TEXT         DEFAULT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Alerts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  type       VARCHAR(100) DEFAULT NULL,
  severity   ENUM('high','med','low') DEFAULT 'low',
  message    TEXT         DEFAULT NULL,
  edition    VARCHAR(100) DEFAULT 'All',
  channel    VARCHAR(100) DEFAULT NULL,
  is_read    TINYINT(1)   DEFAULT 0,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Telegram Logs (non-critical, for audit) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_logs (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  alert_id          INT          DEFAULT NULL,
  message           TEXT         DEFAULT NULL,
  chat_id           VARCHAR(100) DEFAULT NULL,
  status            VARCHAR(20)  DEFAULT 'sent',
  telegram_response TEXT         DEFAULT NULL,
  created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── HR: Recruitment Candidates ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_candidates (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(200) DEFAULT NULL,
  father_name   VARCHAR(200) DEFAULT NULL,
  email         VARCHAR(200) DEFAULT NULL,
  mobile        VARCHAR(20)  DEFAULT NULL,
  address       TEXT         DEFAULT NULL,
  qualification VARCHAR(300) DEFAULT NULL,
  experience    VARCHAR(100) DEFAULT NULL,
  aadhar        VARCHAR(20)  DEFAULT NULL,
  pan           VARCHAR(20)  DEFAULT NULL,
  gender        VARCHAR(10)  DEFAULT NULL,
  status        ENUM('Pending','Eligible','Not Eligible') DEFAULT 'Pending',
  notes         TEXT         DEFAULT NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── HR: Training & Induction ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_training (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  emp_code        VARCHAR(50)  NOT NULL,
  training_type   ENUM('AI','Excel','Other') NOT NULL,
  completed       TINYINT(1)   DEFAULT 0,
  completion_date DATE         DEFAULT NULL,
  notes           TEXT         DEFAULT NULL,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_emp_training (emp_code, training_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── HR: PLI & Grading ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_grading (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  pan        VARCHAR(20) NOT NULL,
  month      VARCHAR(7)  NOT NULL,   -- format: YYYY-MM
  work       ENUM('A','B','C','D') DEFAULT NULL,
  behaviour  ENUM('A','B','C','D') DEFAULT NULL,
  discipline ENUM('A','B','C','D') DEFAULT NULL,
  interest   ENUM('A','B','C','D') DEFAULT NULL,
  overall    ENUM('A','B','C','D') DEFAULT NULL,
  pli_amount DECIMAL(10,2)         DEFAULT NULL,
  created_at TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pan_month (pan, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── HR: Sanctioned Posts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_sanctioned_posts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  profile    VARCHAR(200) NOT NULL UNIQUE,
  sanctioned INT          DEFAULT 0,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
--  FIRST ADMIN USER
--  Password below is bcrypt hash of:  Admin@1234
--  Change it immediately after first login via Settings → User Management.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO users (username, name, password_hash, role)
VALUES (
  'admin',
  'Administrator',
  '$2a$10$NRtilOS2FZeCKXe7xhcqCObwX.0rEn1CZ5EUpsmgYhGE5GB4H6xN.',
  'Admin'
);
-- NOTE: The hash above is the bcrypt of "password" (Laravel default test hash).
-- To generate a hash for your own password, run:
--   node -e "const b=require('bcryptjs');b.hash('YourPassword',10).then(console.log)"
