-- Patrika Newsroom — Supabase / PostgreSQL Schema
-- Run this in Supabase Dashboard → SQL Editor

-- Users
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(80) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(120) NOT NULL,
    role          VARCHAR(40) NOT NULL CHECK (role IN ('Admin','Editor','Bureau Chief','HR','Legal','Management','Reporter')),
    edition       VARCHAR(60) DEFAULT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
    sno               INT,
    employee_code     VARCHAR(40) PRIMARY KEY,
    vetan             NUMERIC(12,2),
    pan_no            VARCHAR(20),
    groups            VARCHAR(80),
    divisions         VARCHAR(80),
    teams             VARCHAR(80),
    cells             VARCHAR(80),
    level             VARCHAR(40),
    teams2            VARCHAR(80),
    total_rp          INT,
    total_db          INT,
    city_bureau_rp    INT,
    city_bureau_db    INT,
    diff_rp_db        INT,
    copy_potential    NUMERIC(10,2),
    category          VARCHAR(60),
    location          VARCHAR(80),
    employee_name     VARCHAR(160) NOT NULL,
    profile           VARCHAR(120),
    salary            NUMERIC(12,2),
    avg_pli           NUMERIC(6,2),
    grade             VARCHAR(20),
    salary_range      VARCHAR(60),
    mid_range_salary  NUMERIC(12,2),
    diff_actual_mid   NUMERIC(12,2),
    age               INT,
    qualification     VARCHAR(120),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Legal Cases
CREATE TABLE IF NOT EXISTS legal_cases (
    id          SERIAL PRIMARY KEY,
    case_no     VARCHAR(60) UNIQUE,
    edition     VARCHAR(60),
    court       VARCHAR(120),
    party       VARCHAR(160),
    advocate    VARCHAR(120),
    hearing     DATE,
    status      VARCHAR(40),
    risk        VARCHAR(10) DEFAULT 'Low' CHECK (risk IN ('Low','Medium','High')),
    documents   VARCHAR(255),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id          SERIAL PRIMARY KEY,
    type        VARCHAR(40),
    severity    VARCHAR(10) DEFAULT 'low' CHECK (severity IN ('low','med','high')),
    message     VARCHAR(255),
    edition     VARCHAR(60),
    channel     VARCHAR(40),
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Telegram Logs
CREATE TABLE IF NOT EXISTS telegram_logs (
    id                SERIAL PRIMARY KEY,
    alert_id          INT DEFAULT NULL,
    message           TEXT,
    chat_id           VARCHAR(80),
    status            VARCHAR(10) DEFAULT 'failed' CHECK (status IN ('sent','failed')),
    telegram_response TEXT,
    sent_at           TIMESTAMPTZ DEFAULT NOW()
);

-- HR Notices
CREATE TABLE IF NOT EXISTS hr_notices (
    id            SERIAL PRIMARY KEY,
    employee_code VARCHAR(40),
    type          VARCHAR(20) NOT NULL CHECK (type IN ('Appreciation','Warning','Notice')),
    note          TEXT,
    score         INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Editorial Plan
CREATE TABLE IF NOT EXISTS editorial_plan (
    id          SERIAL PRIMARY KEY,
    edition     VARCHAR(60),
    title       VARCHAR(255) NOT NULL,
    reporter    VARCHAR(120),
    priority    VARCHAR(20) CHECK (priority IN ('Breaking','Exclusive','Follow-up','Investigative')),
    status      VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft','Assigned','In Progress','Approved')),
    importance  INT DEFAULT 0,
    plan_date   DATE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Production Logs
CREATE TABLE IF NOT EXISTS production_logs (
    id              SERIAL PRIMARY KEY,
    edition         VARCHAR(60),
    log_date        DATE,
    page_open       TIME,
    editing_done    TIME,
    pdf_export      TIME,
    plate_release   TIME,
    printing_done   TIME,
    delay_minutes   INT,
    sla_breached    BOOLEAN DEFAULT FALSE,
    department      VARCHAR(60)
);

-- Default seed users
-- IMPORTANT: The password_hash values below are PLACEHOLDERS.
-- Before running this script, generate real bcrypt hashes using Node.js:
--
--   node -e "const b=require('bcryptjs'); console.log(b.hashSync('admin123',10));"
--
-- Replace each placeholder hash with the output of the command above
-- (run once per user / password combination you want to seed).
--
-- The placeholder string '$2a$10$REPLACE_THIS_WITH_REAL_HASH' will NOT work for login.

INSERT INTO users (username, password_hash, name, role)
VALUES
  ('admin', '$2a$10$REPLACE_THIS_WITH_REAL_HASH_FOR_admin123', 'Admin User',    'Admin'),
  ('legal', '$2a$10$REPLACE_THIS_WITH_REAL_HASH_FOR_admin123', 'Legal Officer', 'Legal')
ON CONFLICT (username) DO NOTHING;

-- HR Employees (mirrors the editorial_reports.user table)
CREATE TABLE IF NOT EXISTS hr_employees (
    id                    SERIAL PRIMARY KEY,
    "Status"              VARCHAR(20),
    "EMP_CODE"            VARCHAR(30) UNIQUE,
    pan_no                VARCHAR(20),
    "EMPNAME"             VARCHAR(100),
    "FATHER_NAME"         VARCHAR(100),
    "State"               VARCHAR(50),
    "Branch"              VARCHAR(60),
    district              VARCHAR(200),
    bureau                VARCHAR(100),
    "Location"            VARCHAR(60),
    profile               VARCHAR(100),
    "Email_ID"            VARCHAR(255),
    "Mob_No"              VARCHAR(30),
    "DOB"                 VARCHAR(10),
    "DOJ"                 VARCHAR(10),
    "Story_Type"          VARCHAR(100),
    "Profile_Story_Ideation" VARCHAR(10),
    is_top_team           SMALLINT DEFAULT 0,
    is_qc_team            SMALLINT DEFAULT 0,
    is_v2content_team     SMALLINT DEFAULT 0,
    is_data_team          SMALLINT DEFAULT 0,
    is_tv_multi_team      SMALLINT DEFAULT 0,
    is_other_team         VARCHAR(255),
    emp_deptt             VARCHAR(100),
    emp_designation       VARCHAR(256),
    emp_qualification     VARCHAR(256),
    gross_salary          VARCHAR(20),
    part_b                VARCHAR(20),
    emp_pli               VARCHAR(20),
    other_allowance       VARCHAR(20),
    g_total               INT,
    is_emp_working        SMALLINT DEFAULT 1,
    address               TEXT,
    mobile_device         VARCHAR(50),
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- HR MODULE — SUB-MODULES (run after hr_employees is created)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Recruitment Candidates
CREATE TABLE IF NOT EXISTS hr_candidates (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    father_name     TEXT,
    gender          VARCHAR(20),
    dob             DATE,
    email           TEXT,
    mobile          VARCHAR(20),
    address         TEXT,
    qualification   TEXT,
    experience      TEXT,
    aadhar          VARCHAR(20),
    pan             VARCHAR(20),
    applied_for     TEXT,
    status          VARCHAR(30) DEFAULT 'pending'  -- pending / eligible / not_eligible
                    CHECK (status IN ('pending','eligible','not_eligible')),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Training & Induction Records
CREATE TABLE IF NOT EXISTS hr_training (
    id              BIGSERIAL PRIMARY KEY,
    emp_code        TEXT NOT NULL,
    emp_name        TEXT,
    training_type   TEXT NOT NULL,            -- AI / Excel / Other
    training_name   TEXT,                     -- free-text for "Other"
    status          TEXT DEFAULT 'required'   -- required / completed
                    CHECK (status IN ('required','completed')),
    completed_date  DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (emp_code, training_type)
);

-- 3. PLI & Monthly Grading
CREATE TABLE IF NOT EXISTS hr_grading (
    id                BIGSERIAL PRIMARY KEY,
    pan               TEXT NOT NULL,
    emp_code          TEXT,
    emp_name          TEXT,
    month             VARCHAR(7) NOT NULL,     -- YYYY-MM
    work_grade        CHAR(1) CHECK (work_grade       IN ('A','B','C','D')),
    behaviour_grade   CHAR(1) CHECK (behaviour_grade  IN ('A','B','C','D')),
    discipline_grade  CHAR(1) CHECK (discipline_grade IN ('A','B','C','D')),
    interest_grade    CHAR(1) CHECK (interest_grade   IN ('A','B','C','D')),
    overall_grade     CHAR(1) CHECK (overall_grade    IN ('A','B','C','D')),
    pli_percent       NUMERIC(12,2),
    remarks           TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (pan, month)
);

-- 4. Sanctioned Posts (for Profile-wise Sanction vs Available in Admin tab)
CREATE TABLE IF NOT EXISTS hr_sanctioned_posts (
    id               BIGSERIAL PRIMARY KEY,
    profile          TEXT NOT NULL UNIQUE,   -- designation / profile name
    department       TEXT,
    state            TEXT,
    branch           TEXT,
    sanctioned_count INTEGER DEFAULT 0,
    min_salary       NUMERIC(12,2),
    max_salary       NUMERIC(12,2),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

