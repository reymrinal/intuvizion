# IntuVision AI

**Prompt-based video intelligence for logistics, trucks, warehouses, and plants.**

> Write a rule in plain English. IntuVision watches the camera feed, detects the event, creates an alert, clips evidence.

## What it does

- **Rule Builder** — write any rule in plain English ("Alert if driver uses phone while driving")
- **Video Upload** — upload any recording (truck cabin, gate, dock, yard)
- **AI Analysis** — Gemini Vision analyzes frames at 1fps against your rules
- **Alert Engine** — applies time thresholds, confidence scores, generates alerts
- **Evidence** — auto-clips the violation segment + saves a snapshot

## Architecture

```
Frontend (React → Netlify)
    ↕
Backend (Flask → Render)
    ↕
Gemini Vision API (Google)
```

## Local setup

### Backend
```bash
cd backend
pip install -r requirements.txt
export GEMINI_API_KEY=your_key_here
python server.py
```

### Frontend
```bash
cd frontend
echo "REACT_APP_API_URL=http://localhost:5050" > .env.local
npm install
npm start
```

## Deploy

- **Backend**: Render (set `GEMINI_API_KEY` env var)
- **Frontend**: Netlify (set `REACT_APP_API_URL` to your Render URL)

## Use cases

| Camera | Rule example |
|--------|-------------|
| Truck cabin | "Alert if driver uses phone while driving" |
| Truck cabin | "Alert if driver is not wearing seatbelt" |
| Plant gate | "Alert if no security guard visible for 15 minutes" |
| Warehouse dock | "Alert if loading stopped for more than 20 minutes" |
| Yard | "Alert if truck parks outside marked bay" |

Built for **Intugine Technologies** — logistics visibility platform.
