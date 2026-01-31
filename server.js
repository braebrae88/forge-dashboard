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

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
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
  sql += ' ORDER BY CASE priority WHEN "urgent" THEN 0 WHEN "high" THEN 1 WHEN "normal" THEN 2 ELSE 3 END, created_at DESC';
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

app.put('/api/tasks/:id', (req, res) => {
  const { title, description, status, priority, tags, due_date, archived } = req.body;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  db.prepare(
    `UPDATE tasks SET title=?, description=?, status=?, priority=?, tags=?, due_date=?, archived=?, updated_at=datetime('now') WHERE id=?`
  ).run(
    title ?? task.title, description ?? task.description, status ?? task.status,
    priority ?? task.priority, tags ? JSON.stringify(tags) : task.tags,
    due_date ?? task.due_date, archived ?? task.archived, req.params.id
  );
  // Log status changes
  if (status && status !== task.status) {
    db.prepare('INSERT INTO activity_log (icon, category, title, description) VALUES (?, ?, ?, ?)').run(
      status === 'done' ? '✅' : '⚡', 'task', `Task ${status === 'done' ? 'completed' : 'updated'}: ${task.title}`, `Status: ${task.status} → ${status}`
    );
  }
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// CIO Targets
app.get('/api/cio', (req, res) => {
  const rows = db.prepare('SELECT * FROM cio_targets ORDER BY CASE priority WHEN "high" THEN 0 WHEN "normal" THEN 1 ELSE 2 END, organization').all();
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
  const { title, content, category, pinned } = req.body;
  db.prepare("UPDATE notes SET title=?, content=?, category=?, pinned=?, updated_at=datetime('now') WHERE id=?").run(
    title??note.title, content??note.content, category??note.category, pinned??note.pinned, req.params.id
  );
  res.json({ ok: true });
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
  res.json(db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all());
});

app.post('/api/leads', (req, res) => {
  const { name, title, organization, email, phone, interest, source, notes } = req.body;
  if (!name || !organization) return res.status(400).json({ error: 'name and organization required' });
  const result = db.prepare(
    'INSERT INTO leads (name, title, organization, email, phone, interest, source, notes) VALUES (?,?,?,?,?,?,?,?)'
  ).run(name, title||'', organization, email||'', phone||'', interest||'Warm', source||'', notes||'');
  db.prepare('INSERT INTO activity_log (icon, category, title, description) VALUES (?, ?, ?, ?)').run('🔥', 'lead', `Lead captured: ${name}`, `${organization} — ${interest}`);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/leads/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  const { name, title, organization, email, phone, interest, source, notes } = req.body;
  db.prepare(
    'UPDATE leads SET name=?, title=?, organization=?, email=?, phone=?, interest=?, source=?, notes=? WHERE id=?'
  ).run(name??lead.name, title??lead.title, organization??lead.organization, email??lead.email, phone??lead.phone, interest??lead.interest, source??lead.source, notes??lead.notes, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/leads/:id', (req, res) => {
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Fallback to index
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`FORGE Dashboard running on http://localhost:${PORT}`);
});
