-- Seed data. Run after schema.sql:  mysql -u root -p patrika_newsroom < database/seed.sql
USE patrika_newsroom;

INSERT INTO editions (name) VALUES
 ('Jaipur'),('Jodhpur'),('Udaipur'),('Kota'),('Bhopal'),('Indore'),('Raipur')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Demo login: username = admin, password = patrika123
-- Hash generated with PHP password_hash('patrika123', PASSWORD_DEFAULT)
INSERT INTO users (username, password_hash, name, role, edition) VALUES
 ('admin', '$2y$10$e0NRl5h8w9hQ1mY3oP0Wq.uF6sV8b2cQx1rT4aD7gH9jK2lM3nO5u', 'Administrator', 'Admin', 'Jaipur')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO employees
 (sno, employee_code, vetan, pan_no, `groups`, divisions, teams, cells, level, teams2,
  total_rp, total_db, city_bureau_rp, city_bureau_db, diff_rp_db, copy_potential,
  category, location, employee_name, profile, salary, avg_pli, grade, salary_range,
  mid_range_salary, diff_actual_mid, age, qualification)
VALUES
 (1,'PK1001',62000,'ABCPK1001L','Editorial','Jaipur','Senior Reporter','Desk','M2','Senior Reporter',123,82,41,31,11,102,'Permanent','Jaipur','Rajesh Sharma','Senior Reporter',62000,7.9,'M2','54000-70000',62000,0,58,'MA Journalism'),
 (2,'PK1002',48000,'ABCPK1002L','Editorial','Jodhpur','Reporter','Desk','M1','Reporter',126,84,42,32,12,104,'Permanent','Jodhpur','Meena Verma','Reporter',48000,8.3,'M1','40000-56000',48000,0,34,'BA'),
 (3,'PK1003',78000,'ABCPK1003L','Editorial','Jaipur','Desk Editor','Desk','M3','Desk Editor',129,86,43,33,13,106,'Permanent','Jaipur','Arif Khan','Desk Editor',78000,8.7,'M3','70000-86000',78000,0,47,'MBA'),
 (6,'PK1006',105000,'ABCPK1006L','Editorial','Bhopal','Bureau Chief','Desk','M4','Bureau Chief',138,92,46,36,16,112,'Permanent','Bhopal','Kavita Rao','Bureau Chief',105000,9.1,'M4','95000-115000',105000,0,59,'PhD'),
 (8,'PK1008',53000,'ABCPK1008L','Editorial','Raipur','Reporter','Desk','M2','Reporter',144,96,48,38,18,116,'Permanent','Raipur','Anita Das','Reporter',53000,7.6,'M2','45000-61000',53000,0,63,'MA Journalism')
ON DUPLICATE KEY UPDATE employee_name = VALUES(employee_name);

INSERT INTO legal_cases (case_no, edition, court, party, advocate, hearing, status, risk) VALUES
 ('CIV/2025/118','Jaipur','Rajasthan HC','State vs Patrika','Adv. S. Mehta','2026-05-28','Active','High'),
 ('DEF/2024/77','Kota','District Court','XYZ Builders','Adv. R. Gupta','2026-06-04','Pending Docs','Medium'),
 ('CIV/2026/04','Indore','MP HC','ABC Trust','Adv. N. Iyer','2026-05-22','Active','Low')
ON DUPLICATE KEY UPDATE party = VALUES(party);

INSERT INTO calendar_events (title, event_date, category, note) VALUES
 ('Ambedkar Jayanti','2026-04-14','Political anniversary','Special edition — reuse archive editorials'),
 ('Independence Day','2026-08-15','National day','Front-page special'),
 ('Rajasthan Diwas','2026-03-30','Government program','State coverage');
