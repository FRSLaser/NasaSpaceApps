"""Astro Vitals - self-health monitoring for astronauts (NASA Space Apps).

Resources used: NASA Human Research Program "5 Hazards of Human Spaceflight"
(radiation, isolation, distance, gravity, hostile environments) and the CSA
"Monitoring Radiation for Astronaut Health" article. Reference ranges are
illustrative for a hackathon demo, not medical advice.
"""
import json
import random
import time
from pathlib import Path

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
DATA = Path(__file__).with_name("data.json")
CAREER_LIMIT_MSV = 600  # NASA career radiation limit (mSv)

# Typical daily dose (mSv/day) per environment, used as the radiation baseline.
ENVS = {
    "iss": {"name": "Space station (LEO)", "rad": 0.6},
    "transit": {"name": "Deep-space transit", "rad": 1.8},
    "moon": {"name": "Lunar base", "rad": 1.4},
    "mars": {"name": "Mars surface", "rad": 0.7},
}


def ind(label, unit, lo, hi, step, ok, warn, part, hazard, why, how, tip):
    return dict(label=label, unit=unit, min=lo, max=hi, step=step, ok=ok,
                warn=warn, part=part, hazard=hazard, why=why, how=how, tip=tip)


IND = {
    "hr": ind("Resting heart rate", "bpm", 20, 220, 1, (50, 90), (40, 110), "chest",
              "Altered gravity", "Fluid shifts and deconditioning change heart rate and rhythm.",
              "Sit still for 5 minutes, count your pulse for 30 s and double it.",
              "Rest, slow your breathing, then recheck in an hour. Add cardio to your routine."),
    "bp_sys": ind("Blood pressure (top)", "mmHg", 60, 220, 1, (90, 130), (80, 140), "chest",
                  "Altered gravity", "Without gravity, blood and fluid shift upward and pressure regulation changes.",
                  "Use the arm cuff seated, arm at heart level, after 5 minutes of rest.",
                  "Hydrate, cut salt, and recheck lying down and seated."),
    "bp_dia": ind("Blood pressure (bottom)", "mmHg", 40, 140, 1, (60, 85), (50, 90), "chest",
                  "Altered gravity", "Diastolic pressure shows how relaxed your vessels are between beats.",
                  "Read it from the same cuff measurement as the top number.",
                  "Same steps as the top number. Log both readings every day."),
    "glucose": ind("Blood sugar", "mg/dL", 40, 400, 1, (70, 110), (60, 140), "gut",
                   "Isolation and confinement", "Stress, less activity and diet changes can shift glucose control.",
                   "Fasting finger-prick test with the glucometer, before breakfast.",
                   "Eat a balanced meal, drink water, add light exercise, and retest in 2 hours."),
    "temp": ind("Body temperature", "°C", 33, 42, 0.1, (36.1, 37.5), (35.5, 38.0), "gut",
                "Hostile closed environment", "Fever can signal infection; immune function weakens in spaceflight.",
                "Use the forehead or ear thermometer, away from vents and after 10 minutes indoors.",
                "Rest and hydrate. Isolate from the crew if above 37.5 °C and tell the flight surgeon."),
    "sleep": ind("Sleep last night", "hours", 0, 14, 0.1, (7, 9), (5.5, 12), "head",
                 "Isolation and confinement", "Light cycles, noise and stress disrupt sleep, which affects mood and judgement.",
                 "Read the hours from your sleep tracker or sleep log.",
                 "Dim lights 1 hour before bed, keep a fixed schedule, and cut caffeine."),
    "mood": ind("Mood", "1 to 5", 1, 5, 1, (4, 5), (3, 5), "head",
                "Isolation and confinement", "Distance from Earth and confinement raise the risk of behavioral health problems.",
                "Rate yourself: 1 = very low, 3 = okay, 5 = very good.",
                "Call family or a friend, take a break, and talk to the crew or the ground team."),
    "exercise": ind("Exercise today", "min", 0, 300, 5, (120, 300), (60, 300), "legs",
                    "Altered gravity", "Bones and muscles weaken without load. Exercise slows that loss.",
                    "Add up your treadmill, bike and resistance-device time today.",
                    "Schedule a resistance session now. Skipping it speeds up bone loss."),
    "radiation": ind("Radiation dose", "mSv/day", 0, 10, 0.01, (0, 0), (0, 0), "body",
                     "Space radiation", "Radiation raises long-term cancer and cardiovascular risk and can harm the brain.",
                     "Read your personal dosimeter, as CSA's radiation monitors do.",
                     "Move to the shielded area (storm shelter) and tell the ground team."),
}

# Short tips shown when a reading is below (low) or above (high) the safe range.
TIPS = {
    "hr": ("Stand up slowly, drink water and skip hard cardio until your pulse recovers.",
           "Pause, breathe in for 4 and out for 6 for 5 minutes, and avoid caffeine."),
    "bp_sys": ("Drink water with a salty snack and stand up slowly to avoid dizziness.",
               "Cut salt, hydrate and rest seated for 10 minutes before retesting."),
    "bp_dia": ("Hydrate and avoid sudden position changes, then recheck seated.",
               "Rest quietly, skip caffeine and recheck after 15 minutes."),
    "glucose": ("Eat 15 g of fast sugar (juice or glucose tablets) and recheck in 15 minutes.",
                "Drink water, take light exercise and avoid sugary snacks."),
    "temp": ("Add a layer, drink something warm and check the cabin temperature.",
             "Rest, drink fluids and tell the flight surgeon if it stays above 37.5 °C."),
    "sleep": ("Dim lights an hour before bed, keep a fixed bedtime and skip caffeine after noon.",
              "Too much sleep can signal fatigue or low mood. Get bright light and some activity."),
    "mood": ("Call family or a friend, take a 10-minute break and tell your crew how you feel.",
             "Keep your routine and share what is working with the crew."),
    "exercise": ("Do a 20-minute resistance session now to protect your bones and muscles.",
                 "Rest and refuel. Training too hard without recovery risks injury."),
    "radiation": ("Radiation cannot go below zero. Check that your dosimeter is worn correctly.",
                  "Move to the shielded storm shelter, note the time and tell the ground team."),
}
for _k in IND:
    IND[_k].pop("tip")


def ranges(key, env):
    i = IND[key]
    if key == "radiation":
        r = ENVS[env]["rad"]
        return (0, round(r * 1.25, 2)), (0, round(r * 2, 2))
    return i["ok"], i["warn"]


def status(key, v, env):
    ok, warn = ranges(key, env)
    if ok[0] <= v <= ok[1]:
        return "ok"
    return "warn" if warn[0] <= v <= warn[1] else "crit"


def make_entry(day, values, env):
    values = {k: round(v, 2) for k, v in values.items()}
    return {"day": day, "values": values,
            "status": {k: status(k, v, env) for k, v in values.items()}}


def load():
    if DATA.exists():
        return json.loads(DATA.read_text())
    return {"env": "iss", "day": 1, "entries": [], "xp": 0, "tips": []}


def save(s):
    DATA.write_text(json.dumps(s))


def streak(s):
    days = {e["day"] for e in s["entries"]}
    d = s["day"] if s["day"] in days else s["day"] - 1
    n = 0
    while d in days:
        n, d = n + 1, d - 1
    return n


def badges(s):
    es, st = s["entries"], streak(s)
    return [
        {"name": "First check-in", "got": len(es) >= 1},
        {"name": "3-day streak", "got": st >= 3},
        {"name": "Iron bones (3 days of 120+ min)",
         "got": sum(e["values"].get("exercise", 0) >= 120 for e in es) >= 3},
        {"name": "Full sweep (all 9 indicators)", "got": any(len(e["values"]) == len(IND) for e in es)},
        {"name": "Well rested (3 nights of 7+ h)",
         "got": sum(e["values"].get("sleep", 0) >= 7 for e in es) >= 3},
    ]


def state_out(s):
    env = s["env"]
    latest = s["entries"][-1] if s["entries"] else None
    alerts = []
    if latest:
        for k, st in latest["status"].items():
            if st != "ok":
                low = latest["values"][k] < ranges(k, env)[0][0]
                alerts.append({"key": k, "label": IND[k]["label"], "status": st,
                               "dir": "low" if low else "high", "tip": TIPS[k][0 if low else 1]})
    dose = sum(e["values"].get("radiation", 0) for e in s["entries"])
    return {
        "env": env, "envs": ENVS, "day": s["day"], "xp": s["xp"], "level": s["xp"] // 100 + 1,
        "streak": streak(s), "badges": badges(s), "history": s["entries"][-14:],
        "latest": latest, "alerts": alerts,
        "tips_done": [t.split(":")[1] for t in s.get("tips", []) if t.split(":")[0] == str(s["day"])],
        "escalate": any(a["status"] == "crit" for a in alerts),
        "dose": round(dose, 2), "limit": CAREER_LIMIT_MSV,
        "ind": {k: {**v, "ok": ranges(k, env)[0], "warn": ranges(k, env)[1]} for k, v in IND.items()},
    }


def upsert(s, values):
    new_day = all(e["day"] != s["day"] for e in s["entries"])
    s["entries"] = [e for e in s["entries"] if e["day"] != s["day"]]
    s["entries"].append(make_entry(s["day"], values, s["env"]))
    if new_day:
        s["xp"] += 10 * len(values) + (20 if len(values) == len(IND) else 0)


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/state")
def get_state():
    return jsonify(state_out(load()))


@app.post("/api/checkin")
def checkin():
    s, values = load(), {}
    for k, v in (request.get_json(silent=True) or {}).get("values", {}).items():
        try:
            if k in IND:
                values[k] = float(v)
        except (TypeError, ValueError):
            pass
    if not values:
        return jsonify(error="Enter at least one measurement."), 400
    upsert(s, values)
    save(s)
    return jsonify(state_out(s))


@app.post("/api/day")
def next_day():
    s = load()
    s["day"] += 1
    save(s)
    return jsonify(state_out(s))


@app.post("/api/env")
def set_env():
    s, env = load(), (request.get_json(silent=True) or {}).get("env")
    if env in ENVS:
        s["env"] = env
        save(s)
    return jsonify(state_out(s))


@app.post("/api/demo")
def demo():
    s = {"env": load()["env"], "day": 8, "entries": [], "xp": 0}
    rnd, rad = random.Random(7), ENVS[load()["env"]]["rad"]
    for d in range(1, 8):
        s["day"] = d
        upsert(s, {
            "hr": 58 + d * 2 + rnd.uniform(-3, 3), "bp_sys": 118 + d * 2 + rnd.uniform(-4, 4),
            "bp_dia": 76 + rnd.uniform(-4, 4), "glucose": 92 + d * 2 + rnd.uniform(-6, 6),
            "temp": 36.6 + rnd.uniform(-0.3, 0.3), "sleep": 7.8 - d * 0.35 + rnd.uniform(-0.3, 0.3),
            "mood": max(1, min(5, round(4.6 - d * 0.3 + rnd.uniform(-0.4, 0.4)))),
            "exercise": 130 - d * 9 + rnd.uniform(-8, 8),
            "radiation": rad * (1.05 + rnd.uniform(0, 0.15) + (0.9 if d == 5 else 0)),
        })
    s["day"] = 8
    save(s)
    return jsonify(state_out(s))


# --- Automatic readings -------------------------------------------------------
# /api/live streams a simulated wearable suite (random walk plus an occasional
# radiation storm). A real device can POST its readings to /api/ingest and they
# take over the live feed for the next 15 seconds.
SIM = {"t": 0, "env": None, "cur": {}, "storm": 0, "sleep": 7}
LIVE = {"values": {}, "ts": 0}


def sim_values(env):
    r = ENVS[env]["rad"]
    base = {"hr": 66, "bp_sys": 118, "bp_dia": 76, "glucose": 92, "temp": 36.7, "radiation": r}
    sd = {"hr": 2.5, "bp_sys": 2, "bp_dia": 1.5, "glucose": 2, "temp": 0.04, "radiation": r * 0.04}
    if SIM["env"] != env:
        SIM.update(env=env, t=0, storm=0, cur=dict(base), sleep=round(random.uniform(6.2, 7.8), 1))
    SIM["t"] += 1
    for k in base:
        SIM["cur"][k] += random.gauss(0, sd[k]) + (base[k] - SIM["cur"][k]) * 0.15
    if SIM["t"] % 30 == 0:
        SIM["storm"] = 5
    v = dict(SIM["cur"])
    if SIM["storm"] > 0:
        v["radiation"] *= 3
        v["hr"] += 22
        SIM["storm"] -= 1
    v.update(sleep=SIM["sleep"], mood=4, exercise=min(300, SIM["t"] * 2))
    return {k: round(x, 2) for k, x in v.items()}


@app.get("/api/live")
def live():
    env = load()["env"]
    vals, src = sim_values(env), "simulated"
    if time.time() - LIVE["ts"] < 15:
        vals.update(LIVE["values"])
        src = "device"
    return jsonify(source=src, values=vals, status={k: status(k, v, env) for k, v in vals.items()})


@app.post("/api/ingest")
def ingest():
    body = request.get_json(silent=True) or {}
    vals = {}
    for k, v in body.get("values", body).items():
        try:
            if k in IND:
                vals[k] = float(v)
        except (TypeError, ValueError):
            pass
    if not vals:
        return jsonify(error="Send JSON such as {\"hr\": 72}."), 400
    LIVE.update(values=vals, ts=time.time())
    return jsonify(ok=True, accepted=sorted(vals))


@app.post("/api/tip")
def tip_done():
    s, k = load(), (request.get_json(silent=True) or {}).get("key")
    tag = f"{s['day']}:{k}"
    if k in IND and tag not in s.setdefault("tips", []):
        s["tips"].append(tag)
        s["xp"] += 5
        save(s)
    return jsonify(state_out(s))


@app.post("/api/reset")
def reset():
    s = {"env": load()["env"], "day": 1, "entries": [], "xp": 0}
    save(s)
    return jsonify(state_out(s))


if __name__ == "__main__":
    app.run(debug=True)
