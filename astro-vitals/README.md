# Astro Vitals

A self-health check tool for astronauts on long missions (NASA Space Apps Challenge).
Log nine health indicators, see them on a clickable body map with color-coded status,
follow trends, get plain-language guidance, and earn XP, streaks and badges.

**Resources used:** NASA Human Research Program, *5 Hazards of Human Spaceflight*, and the
CSA article *Monitoring Radiation for Astronaut Health*. Each indicator links to the hazard that affects it.

## Run it

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000 and press **Load demo week** to see example data.

## Features
- **NASA-style theme:** deep-space blue, NASA red accents, status colors (green, amber, red)
- **Overview:** clickable body map (the heart beats at your logged pulse), health score gauge, and an action plan
- **Tips:** every vital has a short tip for "below range" and "above range". Tap *Done* to earn XP
- **Live sensors:** a simulated wearable suite streams all nine vitals every 2 s with sparklines, flags problems instantly, and can auto-save
- **Check-in:** sliders, +/- buttons and mood faces that change color as you move into or out of range
- **Insights:** health radar, daily status bars, animated trend lines with the safe range shaded, and badges
- **Gamification:** XP levels, streaks and badges
- Radiation limits change with location (station, deep space, Moon, Mars)

## Connecting a real device
The live feed is simulated by default. Any device or script can send readings instead:

```bash
curl -X POST http://127.0.0.1:5000/api/ingest -H "Content-Type: application/json" \
     -d '{"hr": 74, "temp": 36.8, "glucose": 95}'
```
Keys: `hr, bp_sys, bp_dia, glucose, temp, sleep, mood, exercise, radiation`.
For the next 15 seconds the live tiles show your values instead of simulated ones.

## Notes
Reference ranges are illustrative for a hackathon demo, not medical advice.
Data is saved to `data.json` (ignored by git).
