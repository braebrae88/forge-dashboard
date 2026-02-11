const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3456;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database
const db = new Database(path.join(__dirname, 'forge.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done','backlog')),
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
    tags TEXT DEFAULT '[]',
    due_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    archived INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS cio_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    organization TEXT NOT NULL,
    title TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    location TEXT DEFAULT '',
    status TEXT DEFAULT 'prospect' CHECK(status IN ('prospect','researching','contacted','meeting','proposal','nurture','won','lost')),
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high')),
    notes TEXT DEFAULT '',
    last_contact TEXT,
    next_followup TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cio_target_id INTEGER,
    type TEXT DEFAULT 'note' CHECK(type IN ('email','call','meeting','note','linkedin','conference')),
    summary TEXT NOT NULL,
    details TEXT DEFAULT '',
    date TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (cio_target_id) REFERENCES cio_targets(id)
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icon TEXT DEFAULT '📌',
    category TEXT DEFAULT 'general',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    title TEXT DEFAULT '',
    organization TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    interest TEXT DEFAULT 'Warm',
    source TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Add progress column if missing
  CREATE TABLE IF NOT EXISTS mira_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','completed','blocked')),
    progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    milestones TEXT DEFAULT '[]',
    category TEXT DEFAULT 'general',
    started_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sales_pipeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cio_target_id INTEGER,
    stage TEXT DEFAULT 'outreach' CHECK(stage IN ('outreach','teach','qualify','expand','propose','close','won','lost')),
    -- MEDDPICC fields
    metrics TEXT DEFAULT '',
    economic_buyer TEXT DEFAULT '',
    decision_criteria TEXT DEFAULT '',
    decision_process TEXT DEFAULT '',
    paper_process TEXT DEFAULT '',
    identified_pain TEXT DEFAULT '',
    champion TEXT DEFAULT '',
    competition TEXT DEFAULT '',
    -- Deal info
    deal_value INTEGER DEFAULT 0,
    engagement_type TEXT DEFAULT 'advisor' CHECK(engagement_type IN ('advisor','activator','assessment','sdk')),
    next_action TEXT DEFAULT '',
    next_action_date TEXT,
    days_in_stage INTEGER DEFAULT 0,
    stage_entered_at TEXT DEFAULT (datetime('now')),
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (cio_target_id) REFERENCES cio_targets(id)
  );
`);

// ── Migrations (safe column additions) ──────────────
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN notes TEXT DEFAULT ''`);
  console.log('Migration: Added notes column to tasks');
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec(`ALTER TABLE notes ADD COLUMN mira_unread INTEGER DEFAULT 0`);
  console.log('Migration: Added mira_unread column to notes');
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec(`ALTER TABLE tasks ADD COLUMN mira_unread INTEGER DEFAULT 0`);
  console.log('Migration: Added mira_unread column to tasks');
} catch (e) {
  // Column already exists, ignore
}

// Leads enhancements
try {
  db.exec(`ALTER TABLE leads ADD COLUMN region TEXT DEFAULT 'other'`);
  db.exec(`ALTER TABLE leads ADD COLUMN country TEXT DEFAULT ''`);
  db.exec(`ALTER TABLE leads ADD COLUMN mira_notes TEXT DEFAULT ''`);
  db.exec(`ALTER TABLE leads ADD COLUMN mira_unread INTEGER DEFAULT 0`);
  db.exec(`ALTER TABLE leads ADD COLUMN next_action TEXT DEFAULT ''`);
  db.exec(`ALTER TABLE leads ADD COLUMN next_action_date TEXT`);
  db.exec(`ALTER TABLE leads ADD COLUMN status TEXT DEFAULT 'new'`);
  db.exec(`ALTER TABLE leads ADD COLUMN linkedin TEXT DEFAULT ''`);
  db.exec(`ALTER TABLE leads ADD COLUMN proposed_outreach TEXT DEFAULT ''`);
  console.log('Migration: Enhanced leads table');
} catch (e) {
  // Columns may already exist
}

// Actions table for promoted @MIRA directives
db.exec(`
  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','done')),
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
    source_note_id INTEGER,
    mira_response TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (source_note_id) REFERENCES notes(id)
  )
`);

// ── Seed data if empty ──────────────────────────────
const taskCount = db.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
if (taskCount === 0) {
  const insertTask = db.prepare('INSERT INTO tasks (title, status, priority, tags, created_at) VALUES (?, ?, ?, ?, ?)');
  const seedTasks = [
    ['Finalize Activation Bridge pitch deck', 'todo', 'urgent', '["Strategy","Priority"]', '2026-01-30'],
    ['Research VHA Home HealthCare CIO', 'todo', 'high', '["CIO Target"]', '2026-01-29'],
    ['Oak Valley Health — intro email draft', 'todo', 'normal', '["Outreach"]', '2026-01-28'],
    ['SDK compliance pack: HIPAA module outline', 'todo', 'normal', '["SDK"]', '2026-01-27'],
    ['Register for e-Health 2026 conference', 'todo', 'normal', '["GTM"]', '2026-01-26'],
    ['Michael Garron Hospital — CIO outreach', 'in_progress', 'urgent', '["CIO Target","Priority"]', '2026-01-25'],
    ['Lumen App — scoring kernel refinement', 'in_progress', 'high', '["Lumen"]', '2026-01-20'],
    ['FORGE website content update', 'in_progress', 'normal', '["Brand"]', '2026-01-22'],
    ['CIO targeting document — 20+ Ontario hospitals', 'done', 'normal', '["CIO Target"]', '2026-01-30'],
    ['Conference research — e-Health, HIMSS, ViVE, FHLIP', 'done', 'normal', '["GTM"]', '2026-01-29'],
    ['Lead capture form → Google Sheet', 'done', 'normal', '["Ops"]', '2026-01-28'],
    ['Mira portal — heymira.app live', 'done', 'normal', '["Infra"]', '2026-01-31'],
    ['Open-source radiology AI + SDK vertical play', 'backlog', 'normal', '["SDK","Big Play"]', '2026-01-30'],
    ['Teams extension for clinical AI governance', 'backlog', 'normal', '["Product"]', '2026-01-28'],
    ['US market pilot — "Pilot Purgatory" messaging', 'backlog', 'normal', '["GTM"]', '2026-01-27'],
  ];
  const insertMany = db.transaction((tasks) => {
    for (const t of tasks) insertTask.run(...t);
  });
  insertMany(seedTasks);

  // Seed CIO targets
  const insertCIO = db.prepare('INSERT INTO cio_targets (name, organization, location, status, priority, notes) VALUES (?, ?, ?, ?, ?, ?)');
  const seedCIOs = [
    ['TBD', 'Michael Garron Hospital', 'East Toronto', 'researching', 'high', 'Digital transformation focus. Priority target.'],
    ['TBD', 'VHA Home HealthCare', 'Ontario', 'prospect', 'high', 'Home care — AI readiness assessment needed.'],
    ['TBD', 'Oak Valley Health', 'Markham-Stouffville', 'prospect', 'high', 'MSH/Uxbridge sites. Growing system.'],
    ['TBD', 'Baycrest Health Sciences', 'Toronto', 'prospect', 'normal', 'Geriatric care. Research-oriented.'],
    ['TBD', 'SickKids', 'Toronto', 'nurture', 'normal', 'Pediatric. Innovation leader. Long-term target.'],
  ];
  const insertManyCIO = db.transaction((cios) => {
    for (const c of cios) insertCIO.run(...c);
  });
  insertManyCIO(seedCIOs);

  // Seed Mira projects
  const insertProject = db.prepare('INSERT INTO mira_projects (name, description, status, progress, milestones, category, started_at) VALUES (?,?,?,?,?,?,?)');
  const seedProjects = [
    ['GTM Strategy', 'Go-to-market strategy for FORGE Health — CIO targeting, conference prep, messaging, content pipeline', 'active', 35,
      JSON.stringify([
        {name:'CIO target list (20+ Ontario hospitals)', done:true},
        {name:'Conference research (e-Health, HIMSS, ViVE, FHLIP)', done:true},
        {name:'Activation Bridge pitch deck', done:false},
        {name:'LinkedIn content calendar', done:false},
        {name:'CIO outreach email sequences', done:false},
        {name:'Conference registration & booth planning', done:false},
      ]), 'gtm', '2026-01-28'],
    ['Lumen App', 'Defensible decision record app — scoring kernel, constraint engine, intake paths', 'active', 65,
      JSON.stringify([
        {name:'Intake engine (parameter + freeform paths)', done:true},
        {name:'Scoring kernel (MCDA + Monte Carlo)', done:true},
        {name:'NIST AI RMF alignment', done:true},
        {name:'PHIPA kill switch', done:true},
        {name:'Scoring kernel refinement', done:false},
        {name:'User testing & feedback loop', done:false},
      ]), 'product', '2026-01-15'],
    ['Lumen SDK', 'Embeddable runtime governance SDK for health software vendors', 'active', 15,
      JSON.stringify([
        {name:'Architecture design (10 CHAI domains)', done:true},
        {name:'Abstract scoring kernel from app', done:false},
        {name:'HIPAA compliance pack', done:false},
        {name:'PHIPA compliance pack', done:false},
        {name:'Vendor integration docs', done:false},
        {name:'Pilot partner identified', done:false},
      ]), 'product', '2026-01-20'],
    ['CIO Pipeline', 'Active outreach to Ontario hospital CIOs', 'active', 20,
      JSON.stringify([
        {name:'Michael Garron Hospital — researching', done:true},
        {name:'VHA Home HealthCare — identified', done:true},
        {name:'Oak Valley Health — identified', done:true},
        {name:'First meeting booked', done:false},
        {name:'Proposal sent', done:false},
      ]), 'pipeline', '2026-01-25'],
    ['FORGE Dashboard', 'Command center — kanban, CIO pipeline, briefings, Mira integration', 'active', 70,
      JSON.stringify([
        {name:'Dashboard with stats & kanban', done:true},
        {name:'CIO pipeline view', done:true},
        {name:'Daily briefing system', done:true},
        {name:'Lead capture', done:true},
        {name:'Mira status widget', done:true},
        {name:'Custom chat interface', done:false},
        {name:'Notes & docs section', done:false},
      ]), 'infra', '2026-01-31'],
  ];
  const insertManyProj = db.transaction((projs) => {
    for (const p of projs) insertProject.run(...p);
  });
  insertManyProj(seedProjects);

  // Seed activity
  const insertActivity = db.prepare('INSERT INTO activity_log (icon, category, title, description, created_at) VALUES (?, ?, ?, ?, ?)');
  const seedActivity = [
    ['🌐', 'infra', 'heymira.app went live', 'Cloudflare Tunnel configured — accessible worldwide', '2026-01-31 09:25:00'],
    ['🔮', 'infra', 'Voice enabled for Mira', 'ElevenLabs + OpenAI TTS configured', '2026-01-31 09:48:00'],
    ['📄', 'strategy', 'CIO targeting doc created', '20+ Ontario hospital targets identified', '2026-01-30 14:00:00'],
    ['🎯', 'gtm', 'Conference research completed', 'e-Health 2026, HIMSS26, ViVE dates compiled', '2026-01-29 11:00:00'],
    ['🏝️', 'personal', 'Bahamas trip app deployed', 'Full itinerary app on GitHub Pages', '2026-01-29 16:00:00'],
    ['🍌', 'infra', 'Image generation enabled', 'Nano Banana Pro (Gemini) configured', '2026-01-31 08:35:00'],
    ['📊', 'strategy', 'FORGE Dashboard v1 built', 'Command center with kanban, CIO pipeline, activity feed', '2026-01-31 09:55:00'],
  ];
  const insertManyAct = db.transaction((acts) => {
    for (const a of acts) insertActivity.run(...a);
  });
  insertManyAct(seedActivity);
}

// ── API Routes ──────────────────────────────────────

// Tasks
app.get('/api/tasks', (req, res) => {
  const { status, archived } = req.query;
  let sql = 'SELECT * FROM tasks WHERE archived = ?';
  const params = [archived === '1' ? 1 : 0];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += " ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, created_at DESC";
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/tasks', (req, res) => {
  const { title, description, status, priority, tags, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const result = db.prepare(
    'INSERT INTO tasks (title, description, status, priority, tags, due_date) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, description || '', status || 'todo', priority || 'normal', JSON.stringify(tags || []), due_date || null);
  // Log activity
  db.prepare('INSERT INTO activity_log (icon, category, title, description) VALUES (?, ?, ?, ?)').run('📋', 'task', `Task created: ${title}`, '');
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  res.json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const { title, description, notes, status, priority, tags, due_date, archived, mira_unread } = req.body;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  db.prepare(
    `UPDATE tasks SET title=?, description=?, notes=?, status=?, priority=?, tags=?, due_date=?, archived=?, mira_unread=?, updated_at=datetime('now') WHERE id=?`
  ).run(
    title ?? task.title, description ?? task.description, notes ?? task.notes ?? '', status ?? task.status,
    priority ?? task.priority, tags ? JSON.stringify(tags) : task.tags,
    due_date ?? task.due_date, archived ?? task.archived, mira_unread ?? task.mira_unread ?? 0, req.params.id
  );
  // Log status changes
  if (status && status !== task.status) {
    db.prepare('INSERT INTO activity_log (icon, category, title, description) VALUES (?, ?, ?, ?)').run(
      status === 'done' ? '✅' : '⚡', 'task', `Task ${status === 'done' ? 'completed' : 'updated'}: ${task.title}`, `Status: ${task.status} → ${status}`
    );
  }
  res.json({ ok: true });
});

// Mark task as read (clear mira_unread flag)
app.post('/api/tasks/:id/mark-read', (req, res) => {
  db.prepare("UPDATE tasks SET mira_unread=0 WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// CIO Targets
app.get('/api/cio', (req, res) => {
  const rows = db.prepare("SELECT * FROM cio_targets ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, organization").all();
  res.json(rows);
});

app.post('/api/cio', (req, res) => {
  const { name, organization, title, email, phone, location, status, priority, notes } = req.body;
  if (!organization) return res.status(400).json({ error: 'organization required' });
  const result = db.prepare(
    'INSERT INTO cio_targets (name, organization, title, email, phone, location, status, priority, notes) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(name||'TBD', organization, title||'', email||'', phone||'', location||'', status||'prospect', priority||'normal', notes||'');
  db.prepare('INSERT INTO activity_log (icon, category, title, description) VALUES (?, ?, ?, ?)').run('🎯', 'pipeline', `CIO target added: ${organization}`, '');
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/cio/:id', (req, res) => {
  const target = db.prepare('SELECT * FROM cio_targets WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'not found' });
  const { name, organization, title, email, phone, location, status, priority, notes, next_followup, last_contact } = req.body;
  db.prepare(
    `UPDATE cio_targets SET name=?,organization=?,title=?,email=?,phone=?,location=?,status=?,priority=?,notes=?,next_followup=?,last_contact=?,updated_at=datetime('now') WHERE id=?`
  ).run(
    name??target.name, organization??target.organization, title??target.title,
    email??target.email, phone??target.phone, location??target.location,
    status??target.status, priority??target.priority, notes??target.notes,
    next_followup??target.next_followup, last_contact??target.last_contact, req.params.id
  );
  if (status && status !== target.status) {
    db.prepare('INSERT INTO activity_log (icon, category, title, description) VALUES (?, ?, ?, ?)').run(
      '🎯', 'pipeline', `${target.organization} status updated`, `${target.status} → ${status}`
    );
  }
  res.json({ ok: true });
});

// Interactions
app.get('/api/interactions', (req, res) => {
  const { cio_target_id } = req.query;
  let sql = 'SELECT i.*, c.organization FROM interactions i LEFT JOIN cio_targets c ON i.cio_target_id = c.id';
  const params = [];
  if (cio_target_id) { sql += ' WHERE i.cio_target_id = ?'; params.push(cio_target_id); }
  sql += ' ORDER BY i.date DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/interactions', (req, res) => {
  const { cio_target_id, type, summary, details, date } = req.body;
  if (!summary) return res.status(400).json({ error: 'summary required' });
  const result = db.prepare(
    'INSERT INTO interactions (cio_target_id, type, summary, details, date) VALUES (?,?,?,?,?)'
  ).run(cio_target_id||null, type||'note', summary, details||'', date||new Date().toISOString());
  if (cio_target_id) {
    db.prepare("UPDATE cio_targets SET last_contact = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(cio_target_id);
    const org = db.prepare('SELECT organization FROM cio_targets WHERE id = ?').get(cio_target_id);
    db.prepare('INSERT INTO activity_log (icon, category, title, description) VALUES (?, ?, ?, ?)').run(
      '💬', 'interaction', `${type||'note'}: ${org?.organization || 'Unknown'}`, summary
    );
  }
  res.json({ id: result.lastInsertRowid });
});

// Activity Log
app.get('/api/activity', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(db.prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?').all(limit));
});

app.post('/api/activity', (req, res) => {
  const { icon, category, title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const result = db.prepare('INSERT INTO activity_log (icon, category, title, description) VALUES (?,?,?,?)').run(icon||'📌', category||'general', title, description||'');
  res.json({ id: result.lastInsertRowid });
});

// Notes
app.get('/api/notes', (req, res) => {
  res.json(db.prepare('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC').all());
});

app.post('/api/notes', (req, res) => {
  const { title, content, category, pinned } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const result = db.prepare('INSERT INTO notes (title, content, category, pinned) VALUES (?,?,?,?)').run(title, content||'', category||'general', pinned?1:0);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/notes/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'not found' });
  const { title, content, category, pinned, mira_unread } = req.body;
  db.prepare("UPDATE notes SET title=?, content=?, category=?, pinned=?, mira_unread=?, updated_at=datetime('now') WHERE id=?").run(
    title??note.title, content??note.content, category??note.category, pinned??note.pinned, mira_unread??note.mira_unread??0, req.params.id
  );
  res.json({ ok: true });
});

// Mark note as read (clear mira_unread flag)
app.post('/api/notes/:id/mark-read', (req, res) => {
  db.prepare("UPDATE notes SET mira_unread=0 WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/notes/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Sales Pipeline
app.get('/api/pipeline', (req, res) => {
  const deals = db.prepare(`
    SELECT p.*, c.organization, c.name as cio_name, c.location
    FROM sales_pipeline p
    LEFT JOIN cio_targets c ON p.cio_target_id = c.id
    ORDER BY 
      CASE p.stage 
        WHEN 'outreach' THEN 1 
        WHEN 'teach' THEN 2 
        WHEN 'qualify' THEN 3 
        WHEN 'expand' THEN 4 
        WHEN 'propose' THEN 5 
        WHEN 'close' THEN 6 
        WHEN 'won' THEN 7 
        WHEN 'lost' THEN 8 
      END, p.created_at DESC
  `).all();
  res.json(deals);
});

app.post('/api/pipeline', (req, res) => {
  const { cio_target_id, stage, metrics, economic_buyer, decision_criteria, decision_process, paper_process, identified_pain, champion, competition, deal_value, engagement_type, next_action, next_action_date, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO sales_pipeline (
      cio_target_id, stage, metrics, economic_buyer, decision_criteria, decision_process, 
      paper_process, identified_pain, champion, competition, deal_value, engagement_type, 
      next_action, next_action_date, notes
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    cio_target_id||null, stage||'outreach', metrics||'', economic_buyer||'', decision_criteria||'',
    decision_process||'', paper_process||'', identified_pain||'', champion||'', competition||'',
    deal_value||0, engagement_type||'advisor', next_action||'', next_action_date||null, notes||''
  );
  
  // Log activity
  const org = cio_target_id ? db.prepare('SELECT organization FROM cio_targets WHERE id = ?').get(cio_target_id) : null;
  db.prepare('INSERT INTO activity_log (icon, category, title, description) VALUES (?, ?, ?, ?)').run(
    '💰', 'pipeline', `Deal created: ${org?.organization || 'New Deal'}`, `Stage: ${stage||'outreach'}`
  );
  
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/pipeline/:id', (req, res) => {
  const deal = db.prepare('SELECT * FROM sales_pipeline WHERE id = ?').get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'not found' });
  
  const { stage, metrics, economic_buyer, decision_criteria, decision_process, paper_process, identified_pain, champion, competition, deal_value, engagement_type, next_action, next_action_date, notes } = req.body;
  
  // Update days in stage and stage_entered_at if stage changed
  let stage_entered_at = deal.stage_entered_at;
  let days_in_stage = deal.days_in_stage;
  if (stage && stage !== deal.stage) {
    stage_entered_at = new Date().toISOString();
    days_in_stage = 0;
  }
  
  db.prepare(`
    UPDATE sales_pipeline SET 
      stage=?, metrics=?, economic_buyer=?, decision_criteria=?, decision_process=?, 
      paper_process=?, identified_pain=?, champion=?, competition=?, deal_value=?, 
      engagement_type=?, next_action=?, next_action_date=?, notes=?, 
      stage_entered_at=?, days_in_stage=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    stage??deal.stage, metrics??deal.metrics, economic_buyer??deal.economic_buyer,
    decision_criteria??deal.decision_criteria, decision_process??deal.decision_process,
    paper_process??deal.paper_process, identified_pain??deal.identified_pain,
    champion??deal.champion, competition??deal.competition, deal_value??deal.deal_value,
    engagement_type??deal.engagement_type, next_action??deal.next_action,
    next_action_date??deal.next_action_date, notes??deal.notes,
    stage_entered_at, days_in_stage, req.params.id
  );
  
  // Log stage changes
  if (stage && stage !== deal.stage) {
    const org = deal.cio_target_id ? db.prepare('SELECT organization FROM cio_targets WHERE id = ?').get(deal.cio_target_id) : null;
    db.prepare('INSERT INTO activity_log (icon, category, title, description) VALUES (?, ?, ?, ?)').run(
      '🚀', 'pipeline', `${org?.organization || 'Deal'} stage updated`, `${deal.stage} → ${stage}`
    );
  }
  
  res.json({ ok: true });
});

app.delete('/api/pipeline/:id', (req, res) => {
  db.prepare('DELETE FROM sales_pipeline WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/pipeline/actions', (req, res) => {
  const now = new Date();
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  
  const overdue = db.prepare(`
    SELECT p.*, c.organization 
    FROM sales_pipeline p 
    LEFT JOIN cio_targets c ON p.cio_target_id = c.id
    WHERE p.next_action_date < ? AND p.stage NOT IN ('won', 'lost')
  `).all(now.toISOString());
  
  const stale = db.prepare(`
    SELECT p.*, c.organization
    FROM sales_pipeline p
    LEFT JOIN cio_targets c ON p.cio_target_id = c.id  
    WHERE p.stage_entered_at < ? AND p.stage NOT IN ('won', 'lost')
  `).all(twoWeeksAgo);
  
  res.json({ overdue, stale });
});

app.get('/api/pipeline/stats', (req, res) => {
  const stageStats = db.prepare(`
    SELECT stage, COUNT(*) as count, SUM(deal_value) as total_value
    FROM sales_pipeline 
    WHERE stage NOT IN ('won', 'lost')
    GROUP BY stage
  `).all();
  
  const totalValue = db.prepare(`
    SELECT SUM(deal_value) as total FROM sales_pipeline WHERE stage NOT IN ('lost')
  `).get().total || 0;
  
  const avgDaysStats = db.prepare(`
    SELECT stage, AVG(days_in_stage) as avg_days
    FROM sales_pipeline 
    WHERE stage NOT IN ('won', 'lost')
    GROUP BY stage
  `).all();
  
  res.json({ 
    byStage: Object.fromEntries(stageStats.map(s => [s.stage, { count: s.count, value: s.total_value || 0 }])),
    totalValue,
    avgDays: Object.fromEntries(avgDaysStats.map(s => [s.stage, Math.round(s.avg_days || 0)]))
  });
});

app.get('/api/pipeline/nudges', (req, res) => {
  const now = new Date();
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const nudges = [];
  
  // Overdue next actions
  const overdue = db.prepare(`
    SELECT p.*, c.organization 
    FROM sales_pipeline p 
    LEFT JOIN cio_targets c ON p.cio_target_id = c.id
    WHERE p.next_action_date < ? AND p.stage NOT IN ('won', 'lost')
  `).all(now.toISOString());
  
  overdue.forEach(deal => {
    nudges.push({
      priority: 'high',
      message: `Overdue action: ${deal.next_action}`,
      deal_id: deal.id,
      action_suggestion: `Contact ${deal.organization || 'client'} about: ${deal.next_action}`
    });
  });
  
  // Stale deals (>14 days in stage)
  const stale = db.prepare(`
    SELECT p.*, c.organization
    FROM sales_pipeline p
    LEFT JOIN cio_targets c ON p.cio_target_id = c.id  
    WHERE p.stage_entered_at < ? AND p.stage NOT IN ('won', 'lost')
  `).all(twoWeeksAgo);
  
  stale.forEach(deal => {
    nudges.push({
      priority: 'medium',
      message: `${deal.organization || 'Deal'} stale in ${deal.stage} for >14 days`,
      deal_id: deal.id,
      action_suggestion: `Schedule follow-up or move to next stage`
    });
  });
  
  // Deals in outreach with no interaction
  const outreachDeals = db.prepare(`
    SELECT p.*, c.organization, c.id as cio_id
    FROM sales_pipeline p
    LEFT JOIN cio_targets c ON p.cio_target_id = c.id
    WHERE p.stage = 'outreach'
  `).all();
  
  outreachDeals.forEach(deal => {
    if (deal.cio_id) {
      const interactions = db.prepare('SELECT COUNT(*) as count FROM interactions WHERE cio_target_id = ?').get(deal.cio_id);
      if (interactions.count === 0) {
        nudges.push({
          priority: 'medium',
          message: `${deal.organization} in outreach but no interactions logged`,
          deal_id: deal.id,
          action_suggestion: 'Log first contact attempt or meeting'
        });
      }
    }
  });
  
  // CIO targets contacted but no follow-up scheduled
  const contacted = db.prepare(`
    SELECT * FROM cio_targets 
    WHERE status = 'contacted' AND (next_followup IS NULL OR next_followup = '')
  `).all();
  
  contacted.forEach(cio => {
    nudges.push({
      priority: 'medium',
      message: `${cio.organization} contacted but no follow-up scheduled`,
      deal_id: null,
      action_suggestion: 'Schedule follow-up meeting or call'
    });
  });
  
  res.json(nudges);
});

// Stats
app.get('/api/stats', (req, res) => {
  const tasks = db.prepare("SELECT status, COUNT(*) as count FROM tasks WHERE archived=0 GROUP BY status").all();
  const cios = db.prepare("SELECT status, COUNT(*) as count FROM cio_targets GROUP BY status").all();
  const totalCIOs = db.prepare("SELECT COUNT(*) as c FROM cio_targets").get().c;
  const activeOutreach = db.prepare("SELECT COUNT(*) as c FROM cio_targets WHERE status IN ('researching','contacted','meeting','proposal')").get().c;
  res.json({ tasks: Object.fromEntries(tasks.map(t=>[t.status,t.count])), cios: Object.fromEntries(cios.map(c=>[c.status,c.count])), totalCIOs, activeOutreach });
});

// Briefing data (serve from forge-daily-briefing/data/)
const briefingDir = path.join(__dirname, '..', 'forge-daily-briefing', 'data');
const fs = require('fs');

app.get('/api/briefing/dates', (req, res) => {
  try {
    const files = fs.readdirSync(briefingDir).filter(f => f.endsWith('.json')).sort().reverse();
    res.json(files.map(f => f.replace('.json', '')));
  } catch(e) { res.json([]); }
});

app.get('/api/briefing/:date', (req, res) => {
  const file = path.join(briefingDir, req.params.date + '.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(data);
  } catch(e) { res.status(404).json({ error: 'not found' }); }
});

// Leads
app.get('/api/leads', (req, res) => {
  // Sort by region priority: ontario, canada, us, uk, other
  const leads = db.prepare(`
    SELECT * FROM leads 
    ORDER BY 
      CASE region 
        WHEN 'ontario' THEN 1 
        WHEN 'canada' THEN 2 
        WHEN 'us' THEN 3 
        WHEN 'uk' THEN 4 
        ELSE 5 
      END,
      CASE status WHEN 'new' THEN 1 WHEN 'contacted' THEN 2 WHEN 'meeting' THEN 3 WHEN 'nurture' THEN 4 ELSE 5 END,
      created_at DESC
  `).all();
  res.json(leads);
});

app.get('/api/leads/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  res.json(lead);
});

app.post('/api/leads', (req, res) => {
  const { name, title, organization, email, phone, interest, source, notes, region, country, linkedin, proposed_outreach, mira_notes, next_action, next_action_date, status } = req.body;
  if (!name || !organization) return res.status(400).json({ error: 'name and organization required' });
  const result = db.prepare(
    'INSERT INTO leads (name, title, organization, email, phone, interest, source, notes, region, country, linkedin, proposed_outreach, mira_notes, next_action, next_action_date, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(name, title||'', organization, email||'', phone||'', interest||'', source||'', notes||'', region||'other', country||'', linkedin||'', proposed_outreach||'', mira_notes||'', next_action||'', next_action_date||null, status||'new');
  db.prepare('INSERT INTO activity_log (icon, category, title, description) VALUES (?, ?, ?, ?)').run('🔥', 'lead', `Lead added: ${name}`, `${organization} — ${region}`);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/leads/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  const { name, title, organization, email, phone, interest, source, notes, region, country, linkedin, proposed_outreach, mira_notes, mira_unread, next_action, next_action_date, status } = req.body;
  db.prepare(`
    UPDATE leads SET name=?, title=?, organization=?, email=?, phone=?, interest=?, source=?, notes=?, 
    region=?, country=?, linkedin=?, proposed_outreach=?, mira_notes=?, mira_unread=?, next_action=?, next_action_date=?, status=?
    WHERE id=?
  `).run(
    name??lead.name, title??lead.title, organization??lead.organization, email??lead.email, phone??lead.phone, 
    interest??lead.interest, source??lead.source, notes??lead.notes, region??lead.region, country??lead.country,
    linkedin??lead.linkedin, proposed_outreach??lead.proposed_outreach, mira_notes??lead.mira_notes, mira_unread??lead.mira_unread??0,
    next_action??lead.next_action, next_action_date??lead.next_action_date, status??lead.status, req.params.id
  );
  res.json({ ok: true });
});

app.post('/api/leads/:id/mark-read', (req, res) => {
  db.prepare("UPDATE leads SET mira_unread=0 WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/leads/:id', (req, res) => {
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Advisor Ticker — context-aware strategic tips
app.get('/api/advisor/tip', (req, res) => {
  // Gather context
  const todoCount = db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status='todo' AND archived=0").get().c;
  const urgentTasks = db.prepare("SELECT title FROM tasks WHERE priority='urgent' AND status IN ('todo','in_progress') AND archived=0").all();
  const inProgress = db.prepare("SELECT title FROM tasks WHERE status='in_progress' AND archived=0").all();
  const cioStats = db.prepare("SELECT status, COUNT(*) as c FROM cio_targets GROUP BY status").all();
  const totalCIOs = db.prepare("SELECT COUNT(*) as c FROM cio_targets").get().c;
  const meetingCount = cioStats.find(c => c.status === 'meeting')?.c || 0;
  const contactedCount = cioStats.find(c => c.status === 'contacted')?.c || 0;

  const tips = [];

  // Priority-based tips
  if (urgentTasks.length > 0 && !urgentTasks.some(t => t.title.includes('Pitch Deck'))) {
    tips.push('<strong>Focus:</strong> Your pitch deck is the #1 revenue blocker. Every day without it is a day you can\'t book meetings.');
  }
  if (urgentTasks.some(t => t.title.includes('Pitch Deck'))) {
    tips.push('<strong>Pitch Deck Priority:</strong> Get this done before any outreach. A CIO will give you 10 minutes — make every slide count. Lead with their pain, not your product.');
  }
  if (meetingCount === 0 && contactedCount === 0) {
    tips.push('<strong>Pipeline Alert:</strong> Zero CIOs contacted or in meetings. The best strategy deck in the world is worthless without conversations. Outreach is oxygen.');
  }
  if (totalCIOs > 0 && meetingCount === 0) {
    tips.push('<strong>Sales Reality:</strong> ' + totalCIOs + ' targets identified, 0 meetings booked. Healthcare sales cycles are 6-18 months — start conversations NOW or e-Health will be your first real touchpoint.');
  }

  // Strategic tips (rotated)
  const strategic = [
    // Activation Bridge Methodology
    '<strong>Methodology:</strong> DISCOVER → MAP → PROTOTYPE → READY. Every engagement follows this. The infographic on the website should match what CIOs hear in presentations.',
    '<strong>Positioning:</strong> "We don\'t implement. We build readiness evidence and governance rails." Say this in every conversation. It\'s your trust differentiator.',
    '<strong>LUMEN Play:</strong> LUMEN decision records are referenced in every presentation as the evidence artifact. Give LUMEN its own section on the website — it\'s invisible right now.',
    '<strong>Engagement Models:</strong> AI Advisor ($8-15K/mo retainer) vs AI Activator (hands-on, retainer or fixed scope). These aren\'t on the website yet. Add them above the CTA.',

    // Pipeline & GTM
    '<strong>Pipeline Reality:</strong> 4 custom presentations built (Baycrest, MGH, SickKids, PHO) — zero contracts yet. The decks are world-class. Now book the meetings.',
    '<strong>Conference Tip:</strong> e-Health 2026 (May 31, Toronto) is your home turf. Find 3 target CIOs on LinkedIn this week. Cold intros at conferences fail — warm ones close.',
    '<strong>Content Hook:</strong> "80% of hospital AI stalls between strategy and scale" — that\'s your LinkedIn post. One contrarian post per week builds more credibility than 10 cold emails.',
    '<strong>First Contract:</strong> It doesn\'t need to be big — it needs to be referenceable. A $25K activation assessment with Baycrest or MGH is worth more than a $200K deal with no brand name.',

    // SDK Strategy
    '<strong>SDK Priority:</strong> The app proves the concept, the SDK is the exit play. Step 1: audit the scoring kernel. Step 2: define the API surface. Step 3: abstract into embeddable SDK.',
    '<strong>SDK Moat:</strong> Nobody else has a runtime governance SDK for clinical AI decisions. That\'s not a feature — that\'s a category. Verify the competitive gap and own it.',
    '<strong>Revenue Model:</strong> Compliance packs (HIPAA, PHIPA, Pharma) as modular add-ons + per-vendor licensing. Model 3 pricing scenarios before building anything else.',
    '<strong>CHAI Alignment:</strong> SDK scores across 10 domains aligned to the Coalition for Health AI. That\'s instant credibility with any hospital governance committee.',

    // Presentation Insights
    '<strong>Customization Wins:</strong> Every deck reflects the target\'s strategic plan, their systems, their staff quotes. That research depth is the differentiator — make it visible on the website.',
    '<strong>Deferred Value Framework:</strong> Three pillars: operational fragmentation, workforce strain, fundability risk. Use in every CIO conversation — it\'s in all 4 decks for a reason.',
    '<strong>Proof Pattern:</strong> Staff/family quotes → map to measurable impact → propose activation candidate → flag lowest-risk (LUMEN-assessed). This pattern closes.',
    '<strong>Website Gap:</strong> Remove Microsoft references — not in any presentation anymore. Clean up the meta description. The site should match the decks.',

    // Operational
    '<strong>Pricing:</strong> Advisory $8-15K/mo, LUMEN assessment $3-7K, Prototype/pilot $15-40K, Executive briefing $5-10K. Price by outcome, not hours.',
    '<strong>Timing:</strong> AI governance regulations are coming. Ontario Ministry audits already assess documentation quality. Position FORGE as "get ahead of the mandate."',
    '<strong>US Market:</strong> If Canadian hospitals aren\'t biting, pivot energy south. Pilot purgatory is a $2B+ problem in the US. Go where the urgency is.',
    '<strong>Philosophy Check:</strong> "We do not push AI. We create conditions where AI becomes safe to try." — if the website contradicts this, fix the website.',
  ];

  // Add strategic tips
  tips.push(...strategic);

  // Return all tips — client rotates them dynamically
  // Shuffle so each fetch gives a fresh order
  const shuffled = tips.sort(() => Math.random() - 0.5);
  res.json({ tips: shuffled });
});

// Mira Projects
app.get('/api/projects', (req, res) => {
  const status = req.query.status || 'active';
  res.json(db.prepare('SELECT * FROM mira_projects WHERE status = ? ORDER BY updated_at DESC').all(status));
});

app.get('/api/projects/all', (req, res) => {
  res.json(db.prepare("SELECT * FROM mira_projects ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'blocked' THEN 2 ELSE 3 END, updated_at DESC").all());
});

app.put('/api/projects/:id', (req, res) => {
  const proj = db.prepare('SELECT * FROM mira_projects WHERE id = ?').get(req.params.id);
  if (!proj) return res.status(404).json({ error: 'not found' });
  const { name, description, status, progress, milestones, category } = req.body;
  db.prepare(
    `UPDATE mira_projects SET name=?,description=?,status=?,progress=?,milestones=?,category=?,updated_at=datetime('now') WHERE id=?`
  ).run(name??proj.name, description??proj.description, status??proj.status, progress??proj.progress, milestones?JSON.stringify(milestones):proj.milestones, category??proj.category, req.params.id);
  res.json({ ok: true });
});

// Mira Status — poll OpenClaw gateway
const OPENCLAW_URL = 'http://127.0.0.1:18789';
const OPENCLAW_TOKEN = '88a82af55b41cdc3372ba46ef93ed4f2ebf366637444932c';

app.get('/api/mira/status', async (req, res) => {
  try {
    const resp = await fetch(`${OPENCLAW_URL}/api/sessions`, {
      headers: { 'Authorization': `Bearer ${OPENCLAW_TOKEN}` }
    });
    if (!resp.ok) throw new Error('gateway unreachable');
    const sessions = await resp.json();
    // Check main session for activity
    const main = sessions.find(s => s.agent === 'main') || sessions[0];
    const subAgents = sessions.filter(s => s.agent !== 'main' && s.kind === 'isolated');
    const isActive = main && main.busy;
    const hasSubAgents = subAgents.some(s => s.busy);
    
    let state = 'idle';
    let label = 'Idle';
    if (hasSubAgents) { state = 'working'; label = 'Spinning up sub-agents'; }
    else if (isActive) { state = 'working'; label = 'Thinking'; }
    
    const projects = db.prepare("SELECT name, progress, status, category FROM mira_projects WHERE status = 'active' ORDER BY updated_at DESC").all();
    res.json({ state, label, sessions: sessions.length, projects });
  } catch(e) {
    // If we can't reach gateway, check if it's running
    try {
      await fetch(`${OPENCLAW_URL}/health`);
      res.json({ state: 'idle', label: 'Idle', sessions: 0 });
    } catch {
      res.json({ state: 'offline', label: 'Offline', sessions: 0 });
    }
  }
});

// ── Global Search ──────────
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q || q.length < 2) return res.json({ results: [] });
  
  const results = [];
  
  // Search tasks
  const tasks = db.prepare('SELECT * FROM tasks WHERE archived = 0').all();
  tasks.forEach(t => {
    const score = fuzzyScore(q, t.title) + fuzzyScore(q, t.description || '') + fuzzyScore(q, t.notes || '');
    if (score > 0) {
      results.push({
        type: 'task',
        id: t.id,
        title: t.title,
        subtitle: t.status === 'done' ? '✅ Done' : t.status === 'in_progress' ? '⚡ In Progress' : '📋 To Do',
        icon: t.priority === 'urgent' ? '🚨' : t.priority === 'high' ? '🔥' : '📋',
        score,
        status: t.status
      });
    }
  });
  
  // Search notes
  const notes = db.prepare('SELECT * FROM notes').all();
  notes.forEach(n => {
    const score = fuzzyScore(q, n.title) + fuzzyScore(q, n.content || '') * 0.5;
    if (score > 0) {
      results.push({
        type: 'note',
        id: n.id,
        title: n.title,
        subtitle: n.category || 'Note',
        icon: '📝',
        score
      });
    }
  });
  
  // Search CIO targets
  const cios = db.prepare('SELECT * FROM cio_targets').all();
  cios.forEach(c => {
    const score = fuzzyScore(q, c.organization) + fuzzyScore(q, c.name) + fuzzyScore(q, c.notes || '') * 0.5;
    if (score > 0) {
      results.push({
        type: 'cio',
        id: c.id,
        title: c.organization,
        subtitle: c.name !== 'TBD' ? c.name : c.location,
        icon: '🏥',
        score
      });
    }
  });
  
  // Search pipeline deals
  const deals = db.prepare(`
    SELECT p.*, c.organization, c.name as cio_name 
    FROM sales_pipeline p 
    LEFT JOIN cio_targets c ON p.cio_target_id = c.id
  `).all();
  deals.forEach(d => {
    const score = fuzzyScore(q, d.organization || '') + fuzzyScore(q, d.champion || '') + fuzzyScore(q, d.identified_pain || '') + fuzzyScore(q, d.next_action || '');
    if (score > 0) {
      results.push({
        type: 'deal',
        id: d.id,
        title: d.organization || 'Unknown',
        subtitle: `${d.stage} · $${(d.deal_value || 0).toLocaleString()}`,
        icon: '💰',
        score
      });
    }
  });
  
  // Search actions
  const actions = db.prepare('SELECT * FROM actions').all();
  actions.forEach(a => {
    const score = fuzzyScore(q, a.description);
    if (score > 0) {
      results.push({
        type: 'action',
        id: a.id,
        title: a.description,
        subtitle: a.status === 'done' ? '✅ Done' : '🎯 Pending',
        icon: '🎯',
        score
      });
    }
  });
  
  // Search leads
  const leads = db.prepare('SELECT * FROM leads').all();
  leads.forEach(l => {
    const score = fuzzyScore(q, l.name) + fuzzyScore(q, l.organization || '') + fuzzyScore(q, l.title || '');
    if (score > 0) {
      results.push({
        type: 'lead',
        id: l.id,
        title: l.name,
        subtitle: l.organization || l.title || 'Lead',
        icon: '🔥',
        score
      });
    }
  });
  
  // Sort by score and limit
  results.sort((a, b) => b.score - a.score);
  res.json({ results: results.slice(0, 15) });
});

// Simple fuzzy scoring
function fuzzyScore(query, text) {
  if (!text) return 0;
  text = text.toLowerCase();
  
  // Exact match bonus
  if (text.includes(query)) return 10 + (query.length / text.length) * 5;
  
  // Word start match
  const words = text.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(query)) return 7;
  }
  
  // Fuzzy character match
  let qi = 0, consecutive = 0, maxConsecutive = 0;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) {
      qi++;
      consecutive++;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    } else {
      consecutive = 0;
    }
  }
  
  if (qi === query.length) {
    return 3 + maxConsecutive;
  }
  
  return 0;
}

// ── Dashboard Summary (for phone agent context) ──────────
app.get('/api/dashboard/summary', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE archived = 0').all();
  const pipeline = db.prepare(`
    SELECT p.*, c.organization, c.name as cio_name 
    FROM sales_pipeline p 
    LEFT JOIN cio_targets c ON p.cio_target_id = c.id
  `).all();
  const actions = db.prepare("SELECT * FROM actions WHERE status != 'done'").all();
  const notes = db.prepare('SELECT id, title, mira_unread FROM notes').all();
  
  const tasksByStatus = { todo: [], in_progress: [], done: [], backlog: [] };
  tasks.forEach(t => { if (tasksByStatus[t.status]) tasksByStatus[t.status].push(t); });
  
  const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done');
  const highTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'done');
  const miraUnreadTasks = tasks.filter(t => t.mira_unread);
  const miraUnreadNotes = notes.filter(n => n.mira_unread);
  
  const activeDeals = pipeline.filter(p => !['won', 'lost'].includes(p.stage));
  const upcomingActions = activeDeals.filter(d => d.next_action_date).sort((a, b) => 
    new Date(a.next_action_date) - new Date(b.next_action_date)
  ).slice(0, 5);
  
  res.json({
    summary: {
      tasks: {
        todo: tasksByStatus.todo.length,
        in_progress: tasksByStatus.in_progress.length,
        done: tasksByStatus.done.length,
        ideas: tasksByStatus.backlog.length,
        urgent: urgentTasks.length,
        high_priority: highTasks.length,
        mira_unread: miraUnreadTasks.length
      },
      pipeline: {
        active_deals: activeDeals.length,
        total_value: activeDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0)
      },
      actions: {
        pending: actions.length
      },
      notes: {
        mira_unread: miraUnreadNotes.length
      }
    },
    urgent_tasks: urgentTasks.map(t => ({ id: t.id, title: t.title, status: t.status })),
    high_priority_tasks: highTasks.map(t => ({ id: t.id, title: t.title, status: t.status })),
    upcoming_deal_actions: upcomingActions.map(d => ({
      organization: d.organization,
      next_action: d.next_action,
      next_action_date: d.next_action_date
    })),
    pending_actions: actions.map(a => ({ id: a.id, description: a.description, priority: a.priority })),
    mira_unread_items: [
      ...miraUnreadTasks.map(t => ({ type: 'task', id: t.id, title: t.title })),
      ...miraUnreadNotes.map(n => ({ type: 'note', id: n.id, title: n.title }))
    ]
  });
});

// ── Actions (promoted from @MIRA directives) ──────────
app.get('/api/actions', (req, res) => {
  const actions = db.prepare(`
    SELECT * FROM actions 
    ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, created_at DESC
  `).all();
  res.json(actions);
});

app.post('/api/actions', (req, res) => {
  const { description, source_note_id, priority } = req.body;
  const result = db.prepare(
    'INSERT INTO actions (description, source_note_id, priority) VALUES (?, ?, ?)'
  ).run(description, source_note_id || null, priority || 'normal');
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/actions/:id', (req, res) => {
  const action = db.prepare('SELECT * FROM actions WHERE id = ?').get(req.params.id);
  if (!action) return res.status(404).json({ error: 'not found' });
  const { description, status, priority, mira_response } = req.body;
  db.prepare(`
    UPDATE actions SET description=?, status=?, priority=?, mira_response=?, updated_at=datetime('now'),
    completed_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE completed_at END
    WHERE id=?
  `).run(
    description ?? action.description, status ?? action.status, priority ?? action.priority,
    mira_response ?? action.mira_response, status ?? action.status, req.params.id
  );
  res.json({ ok: true });
});

app.delete('/api/actions/:id', (req, res) => {
  db.prepare('DELETE FROM actions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Scan notes AND tasks for @Mira: directives ──────────
app.get('/api/notes/scan-directives', (req, res) => {
  const directives = [];
  
  // Scan notes
  const notes = db.prepare('SELECT * FROM notes').all();
  for (const note of notes) {
    if (!note.content) continue;
    const lines = note.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^@Mira:\s*(.+)$/i);
      if (match) {
        const nextLine = lines[i + 1] || '';
        const hasResponse = nextLine.trim().startsWith('→ MIRA');
        if (!hasResponse) {
          directives.push({
            type: 'note',
            id: note.id,
            title: note.title,
            directive: match[1].trim(),
            line_number: i
          });
        }
      }
    }
  }
  
  // Scan task notes
  const tasks = db.prepare("SELECT * FROM tasks WHERE notes IS NOT NULL AND notes != ''").all();
  for (const task of tasks) {
    const lines = task.notes.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^@Mira:\s*(.+)$/i);
      if (match) {
        const nextLine = lines[i + 1] || '';
        const hasResponse = nextLine.trim().startsWith('→ MIRA');
        if (!hasResponse) {
          directives.push({
            type: 'task',
            id: task.id,
            title: task.title,
            directive: match[1].trim(),
            line_number: i
          });
        }
      }
    }
  }
  
  // Scan lead notes
  const leads = db.prepare("SELECT * FROM leads WHERE notes IS NOT NULL AND notes != ''").all();
  for (const lead of leads) {
    const lines = lead.notes.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^@Mira:\s*(.+)$/i);
      if (match) {
        const nextLine = lines[i + 1] || '';
        const hasResponse = nextLine.trim().startsWith('→ MIRA');
        if (!hasResponse) {
          directives.push({
            type: 'lead',
            id: lead.id,
            title: lead.name + ' (' + lead.organization + ')',
            directive: match[1].trim(),
            line_number: i
          });
        }
      }
    }
  }
  
  res.json(directives);
});

// Fallback to index
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`FORGE Dashboard running on http://localhost:${PORT}`);
});
