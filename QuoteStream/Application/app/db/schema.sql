CREATE TABLE branch (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  currency CHAR(3) NOT NULL
);
CREATE TABLE principal (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  domain VARCHAR(120) NULL,
  branch_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branch(id)
);
CREATE TABLE app_user (
  id INT PRIMARY KEY AUTO_INCREMENT,
  kind VARCHAR(10) NOT NULL,
  name VARCHAR(120) NOT NULL,
  principal_id INT NULL,
  FOREIGN KEY (principal_id) REFERENCES principal(id)
);
CREATE TABLE service (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE,
  default_basis VARCHAR(12) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE TABLE supplier (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL
);
CREATE TABLE port (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(8) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  city VARCHAR(80) NOT NULL,
  country VARCHAR(60) NOT NULL,
  kind VARCHAR(10) NOT NULL
);
CREATE TABLE service_template (
  id INT PRIMARY KEY AUTO_INCREMENT,
  principal_id INT NOT NULL,
  mode VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  currency CHAR(3) NOT NULL,
  origin_port_id INT NULL,
  destination_port_id INT NULL,
  FOREIGN KEY (principal_id) REFERENCES principal(id)
);
CREATE TABLE service_template_detail (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_id INT NOT NULL,
  service_id INT NOT NULL,
  basis VARCHAR(12) NOT NULL,
  unit_price DECIMAL(14,4) NOT NULL,
  est_unit_cost DECIMAL(14,4) NOT NULL,
  supplier_id INT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (template_id) REFERENCES service_template(id),
  FOREIGN KEY (service_id) REFERENCES service(id)
);
CREATE TABLE branch_terms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  branch_id INT NOT NULL,
  text TEXT NOT NULL,
  FOREIGN KEY (branch_id) REFERENCES branch(id)
);
CREATE TABLE request (
  id INT PRIMARY KEY AUTO_INCREMENT,
  number VARCHAR(20) NOT NULL UNIQUE,
  source VARCHAR(10) NOT NULL,
  principal_id INT NULL,
  customer_name VARCHAR(160) NULL,
  mode VARCHAR(20) NULL,
  origin_port_id INT NULL,
  destination_port_id INT NULL,
  lane_text VARCHAR(200) NULL,
  data JSON NOT NULL,
  email_json JSON NULL,
  missing JSON NULL,
  status VARCHAR(30) NOT NULL,
  quotation_id INT NULL,
  draft_opened_at DATETIME NULL,
  sent_at DATETIME NULL,
  ai_fallback TINYINT NOT NULL DEFAULT 0,
  error_text VARCHAR(255) NULL,
  ai_meta JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE quotation (
  id INT PRIMARY KEY AUTO_INCREMENT,
  number VARCHAR(24) NOT NULL UNIQUE,
  request_id INT NULL,
  principal_id INT NOT NULL,
  branch_id INT NOT NULL,
  status VARCHAR(30) NOT NULL,
  flow_status VARCHAR(20) NULL,
  mode VARCHAR(20) NOT NULL,
  job_type VARCHAR(60) NULL,
  service_type VARCHAR(20) NULL,
  incoterm VARCHAR(8) NULL,
  origin_port_id INT NULL,
  destination_port_id INT NULL,
  billing_currency CHAR(3) NOT NULL,
  gross_weight DECIMAL(14,2) NOT NULL DEFAULT 0,
  volume DECIMAL(14,3) NOT NULL DEFAULT 0,
  chargeable_weight DECIMAL(14,2) NULL,
  total_quantity INT NOT NULL DEFAULT 1,
  rejection_reason VARCHAR(255) NULL,
  valid_until DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (principal_id) REFERENCES principal(id),
  FOREIGN KEY (branch_id) REFERENCES branch(id)
);
CREATE INDEX idx_quotation_lane ON quotation (mode, origin_port_id, destination_port_id, status);
CREATE TABLE quotation_po (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quotation_id INT NOT NULL,
  po_number VARCHAR(40) NOT NULL,
  gross_weight DECIMAL(14,2) NOT NULL,
  volume DECIMAL(14,3) NOT NULL,
  chargeable_weight DECIMAL(14,2) NULL,
  FOREIGN KEY (quotation_id) REFERENCES quotation(id)
);
CREATE TABLE quotation_product_cost (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quotation_id INT NOT NULL,
  service_name VARCHAR(80) NOT NULL,
  basis VARCHAR(12) NOT NULL,
  currency CHAR(3) NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  unit_price DECIMAL(14,4) NULL,
  bill_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  est_unit_cost DECIMAL(14,4) NULL,
  est_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  price_source VARCHAR(30) NOT NULL,
  source_ref VARCHAR(120) NULL,
  confidence VARCHAR(10) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (quotation_id) REFERENCES quotation(id)
);
CREATE TABLE approval (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quotation_id INT NOT NULL,
  version_no INT NOT NULL,
  action VARCHAR(12) NOT NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE quotation_note (
  id INT PRIMARY KEY AUTO_INCREMENT,
  principal_id INT NULL,
  mode VARCHAR(20) NULL,
  origin_port_id INT NULL,
  destination_port_id INT NULL,
  change_type VARCHAR(20) NOT NULL,
  service_name VARCHAR(80) NULL,
  basis VARCHAR(12) NULL,
  currency CHAR(3) NULL,
  old_value DECIMAL(14,4) NULL,
  new_value DECIMAL(14,4) NULL,
  est_unit_cost DECIMAL(14,4) NULL,
  reason VARCHAR(120) NULL,
  reason_text VARCHAR(255) NULL,
  quotation_id INT NULL,
  source_label VARCHAR(40) NOT NULL,
  is_test TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE note_dismissal (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quotation_id INT NOT NULL,
  note_id INT NOT NULL
);
CREATE TABLE request_event (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_id INT NOT NULL,
  type VARCHAR(30) NOT NULL,
  text VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE information_update (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_id INT NOT NULL,
  text TEXT NOT NULL,
  result JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE quotation_version (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quotation_id INT NOT NULL,
  request_id INT NOT NULL,
  version_no INT NOT NULL,
  snapshot JSON NOT NULL,
  sent_at DATETIME NOT NULL,
  UNIQUE KEY uq_version (quotation_id, version_no)
);
CREATE TABLE outgoing_email (
  id INT PRIMARY KEY AUTO_INCREMENT,
  kind VARCHAR(20) NOT NULL DEFAULT 'quotation',
  request_id INT NULL,
  quotation_id INT NULL,
  version_no INT NULL,
  to_email VARCHAR(160) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  fallback_used TINYINT NOT NULL DEFAULT 0,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE revision_request (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_id INT NOT NULL,
  version_no INT NOT NULL,
  message TEXT NULL,
  targets JSON NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sample_email (
  id INT PRIMARY KEY AUTO_INCREMENT,
  file_name VARCHAR(80) NOT NULL,
  label VARCHAR(160) NOT NULL,
  company VARCHAR(160) NOT NULL DEFAULT '',
  expect_text VARCHAR(200) NOT NULL DEFAULT '',
  from_email VARCHAR(160) NOT NULL,
  to_email VARCHAR(160) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL
);
CREATE TABLE ai_call_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task VARCHAR(30) NOT NULL,
  provider VARCHAR(20) NULL,
  model VARCHAR(60) NULL,
  duration_ms INT NULL,
  success TINYINT NOT NULL,
  fallback_used TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE counter (
  name VARCHAR(20) PRIMARY KEY,
  value INT NOT NULL
);
