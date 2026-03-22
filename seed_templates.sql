DELETE FROM templates_v2 WHERE id IN ('seed-tmpl-01', 'seed-tmpl-02');

INSERT INTO templates_v2 (id, name, type, version, template_json, active, created_at, updated_at, created_by)
VALUES 
('seed-tmpl-01', 'Smart Format: Core Tech Internship', 'Internship', 1, 
 '{"format_html": "<div style=\"font-family: inherit; font-size: 16px; line-height: 1.6;\">This certifies that <strong>{{student_name}}</strong> (Reg: {{reg_no}}) from {{branch_name}} has completed a technical internship program at {{company_name}} during the {{session}} session.<br/><br/>They worked successfully on the project titled \\"<strong>{{project_title}}</strong>\\" using <strong>{{technology_stack}}</strong>.<br/><br/>Their overall performance evaluation grade is: <strong>{{performance_grade}}</strong>.</div>", "form_fields": [{"name":"project_title","label":"Assigned Project Title","type":"text"}, {"name":"technology_stack","label":"Technology Stack Used","type":"text"}, {"name":"performance_grade","label":"Performance Grade","type":"dropdown","source":"Outstanding, Excellent, Good"}]}', 
 1, '2026-03-22T00:00:00Z', '2026-03-22T00:00:00Z', 'system'),

('seed-tmpl-02', 'Smart Format: Advanced Apprenticeship', 'Apprenticeship', 1, 
 '{"format_html": "<div style=\"font-family: inherit; font-size: 16px; line-height: 1.6;\">We proudly certify that <strong>{{student_name}}</strong> (Reg: {{reg_no}}) from {{branch_name}} has successfully finished an advanced apprenticeship at {{company_name}}.<br/><br/>The apprentice was deployed to the <strong>{{department_assigned}}</strong> division from {{start_date}} for {{duration}} months.<br/><br/><strong>Key Achievement:</strong> {{business_problem}}</div>", "form_fields": [{"name":"department_assigned","label":"Company Division Assigned","type":"text"}, {"name":"business_problem","label":"Summary of Core Problem Solved","type":"textarea"}]}', 
 1, '2026-03-22T00:00:00Z', '2026-03-22T00:00:00Z', 'system');
