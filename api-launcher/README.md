# API Launcher
Node.js + Express backend with a web UI. Launch one API in any mode:
- Stateless / Stateful (stateful = server keeps a session, send `x-session-id`)
- Synchronous (200 + result) / Asynchronous (202 + jobId, poll `/api/jobs/:id` or stream `/api/jobs/:id/events`)

## Run
    npm install
    npm start
Open http://localhost:3000

## Endpoints
- POST /api/launch  { state, flow, payload }
- GET  /api/jobs/:id   |  GET /api/jobs/:id/events (SSE)
- GET  /api/sessions/:id | DELETE /api/sessions/:id
- GET  /api/health

## curl examples
    curl -X POST localhost:3000/api/launch -H 'Content-Type: application/json' -d '{"state":"stateless","flow":"sync","payload":{"numbers":[1,2,3]}}'
    curl -X POST localhost:3000/api/launch -H 'Content-Type: application/json' -d '{"state":"stateful","flow":"async","payload":{"text":"hi"}}'
