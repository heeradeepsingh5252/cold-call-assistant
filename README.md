# Cold Call Assistant

A full-stack application that guides sales callers through an eight-stage cold-call structure in real time, logs stage outcomes and prospects' exact words, tracks call results, and shows past calls and analytics. Includes AI-powered objection-response suggestions via the Cerebras API.

**Live demo:** https://cold-call-assistant-zeta.vercel.app

## What it does

1. Caller works through **8 defined stages** of a cold call
2. At each stage, logs the **outcome** and the **prospect's exact words**
3. On an objection, calls the **Cerebras API** for a suggested response
4. Every call is saved — view **past calls and analytics** afterward

## Tech stack

- **Frontend:** React, Vite
- **Backend:** Node.js, Express (`/backend`)
- **Database:** Supabase (Postgres)
- **AI:** Cerebras API

## How the AI objection-handling works

When a stage is marked "objection raised," the prospect's exact words and call context (stage, offer) go to the Cerebras API, which returns a short suggested response the caller can use live.

## Setup

### Prerequisites
- Node.js (v18+)
- A Supabase project
- A Cerebras API key

### Install & run

\`\`\`bash
git clone https://github.com/heeradeepsingh5252/cold-call-assistant.git
cd cold-call-assistant
npm install
npm run dev          # frontend

cd backend
npm install
npm start            # backend, separate terminal
\`\`\`

### Environment variables
Create `.env` files (check `/backend` for the exact variable names it reads) with your Supabase URL/key and Cerebras API key.

## Project structure

\`\`\`
cold-call-assistant/
├── src/        # React frontend
├── backend/    # Express API + Supabase + Cerebras integration
└── public/     # Static assets
\`\`\`

## Limitations

- No automated test suite yet
- No authentication layer
- Objection suggestions aren't scored against outcomes yet

## License

MIT. See `LICENSE`.
