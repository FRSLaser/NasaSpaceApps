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
- Clickable body map: head, heart, metabolism, bones and a whole-body radiation ring
- Green, amber and red status with a "contact your flight surgeon" alert
- Radiation limits that change with location (station, deep space, Moon, Mars)
- Trend charts, daily check-in, XP levels, streaks and badges
- Each indicator explains why it matters, how to measure it and what to do

## Notes
Reference ranges are illustrative for a hackathon demo, not medical advice.
Data is saved to `data.json` (ignored by git).
