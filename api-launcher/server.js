const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map(); // stateful: server remembers clients
const jobs = new Map();     // async: background jobs
const id = () => crypto.randomBytes(6).toString('hex');

// The actual "business logic" the API runs
function runLogic(p = {}) {
  return {
    echo: p,
    sum: Array.isArray(p.numbers) ? p.numbers.reduce((a, b) => a + Number(b), 0) : null,
    upper: typeof p.text === 'string' ? p.text.toUpperCase() : null,
    processedAt: new Date().toISOString(),
  };
}

app.get('/api/health', (_, res) => res.json({ status: 'ok', sessions: sessions.size, jobs: jobs.size }));

// ONE entry point: launch in any mode
// body: { state: 'stateful'|'stateless', flow: 'sync'|'async', payload: {...} }
// header (stateful only): x-session-id
app.post('/api/launch', (req, res) => {
  const { state = 'stateless', flow = 'sync', payload = {} } = req.body || {};
  if (!['stateful', 'stateless'].includes(state) || !['sync', 'async'].includes(flow))
    return res.status(400).json({ error: "state must be stateful|stateless, flow must be sync|async" });

  // STATEFUL: server stores history per session. STATELESS: nothing is stored.
  let session = null;
  if (state === 'stateful') {
    const sid = req.header('x-session-id');
    session = sessions.get(sid);
    if (!session) { session = { id: id(), calls: 0, history: [] }; sessions.set(session.id, session); }
    session.calls++;
  }
  const meta = { state, flow, ...(session && { sessionId: session.id, callNumber: session.calls }) };
  const record = (result) => session && session.history.push({ at: new Date().toISOString(), payload, result });

  if (flow === 'sync') {
    const result = runLogic(payload);
    record(result);
    return res.status(200).json({ ...meta, result });
  }

  // ASYNC: accept now (202), finish later; poll or stream
  const job = { id: id(), status: 'pending', result: null, listeners: [] };
  jobs.set(job.id, job);
  setTimeout(() => {
    job.status = 'done';
    job.result = runLogic(payload);
    record(job.result);
    job.listeners.forEach(fn => fn());
  }, 2500);
  res.status(202).json({ ...meta, jobId: job.id, statusUrl: `/api/jobs/${job.id}`, eventsUrl: `/api/jobs/${job.id}/events` });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  res.json({ jobId: job.id, status: job.status, result: job.result });
});

// Server-Sent Events: push result when job completes
app.get('/api/jobs/:id/events', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).end();
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = () => { res.write(`data: ${JSON.stringify({ status: job.status, result: job.result })}\n\n`); if (job.status === 'done') res.end(); };
  send();
  if (job.status !== 'done') job.listeners.push(send);
});

app.get('/api/sessions/:id', (req, res) => {
  const s = sessions.get(req.params.id);
  s ? res.json(s) : res.status(404).json({ error: 'session not found' });
});
app.delete('/api/sessions/:id', (req, res) => res.json({ deleted: sessions.delete(req.params.id) }));

const PORT = globalThis.process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API Launcher running at http://localhost:${PORT}`));
