import os, json, uuid, time, threading, base64, io
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cv2
from openai import OpenAI
from PIL import Image
import psycopg2
from psycopg2.extras import RealDictCursor
import urllib.request

app = Flask(__name__)
CORS(app)

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

BASE       = Path(__file__).parent
UPLOAD_DIR = Path("/tmp/uploads")
CLIPS_DIR  = Path("/tmp/clips")
for d in [UPLOAD_DIR, CLIPS_DIR]:
    d.mkdir(exist_ok=True)

# ── DATABASE ───────────────────────────────────────────────────────────
def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"], sslmode="require", cursor_factory=RealDictCursor)

def init_db():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS rules (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    prompt TEXT,
                    severity TEXT DEFAULT 'medium',
                    context TEXT DEFAULT '',
                    time_threshold_sec INTEGER DEFAULT 3,
                    active BOOLEAN DEFAULT TRUE,
                    created_at DOUBLE PRECISION
                );
                CREATE TABLE IF NOT EXISTS videos (
                    id TEXT PRIMARY KEY,
                    filename TEXT,
                    label TEXT,
                    camera_type TEXT,
                    duration DOUBLE PRECISION,
                    fps DOUBLE PRECISION,
                    frame_count INTEGER,
                    uploaded_at DOUBLE PRECISION,
                    file_url TEXT
                );
                CREATE TABLE IF NOT EXISTS alerts (
                    id TEXT PRIMARY KEY,
                    job_id TEXT,
                    video_id TEXT,
                    video_label TEXT,
                    rule_id TEXT,
                    rule_name TEXT,
                    rule_prompt TEXT,
                    severity TEXT,
                    start_time DOUBLE PRECISION,
                    end_time DOUBLE PRECISION,
                    duration DOUBLE PRECISION,
                    confidence DOUBLE PRECISION,
                    description TEXT,
                    objects_detected TEXT,
                    snapshot_b64 TEXT,
                    created_at DOUBLE PRECISION,
                    frame_count INTEGER
                );
            """)
            conn.commit()

try:
    init_db()
    print("DB initialized")
except Exception as e:
    print(f"DB init failed: {e}")

# ── RULES ──────────────────────────────────────────────────────────────
@app.route("/api/rules", methods=["GET"])
def get_rules():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM rules ORDER BY created_at DESC")
            return jsonify([dict(r) for r in cur.fetchall()])

@app.route("/api/rules", methods=["POST"])
def create_rule():
    d = request.json
    rule = {
        "id": str(uuid.uuid4()), "name": d.get("name",""),
        "prompt": d.get("prompt",""), "severity": d.get("severity","medium"),
        "context": d.get("context",""), "time_threshold_sec": d.get("time_threshold_sec",3),
        "active": True, "created_at": time.time()
    }
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""INSERT INTO rules VALUES (%(id)s,%(name)s,%(prompt)s,%(severity)s,%(context)s,%(time_threshold_sec)s,%(active)s,%(created_at)s)""", rule)
            conn.commit()
    return jsonify(rule), 201

@app.route("/api/rules/<rule_id>", methods=["DELETE"])
def delete_rule(rule_id):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM rules WHERE id=%s", (rule_id,))
            conn.commit()
    return jsonify({"ok": True})

@app.route("/api/rules/<rule_id>", methods=["PUT"])
def update_rule(rule_id):
    d = request.json
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""UPDATE rules SET name=%(name)s, prompt=%(prompt)s, severity=%(severity)s,
                context=%(context)s, time_threshold_sec=%(time_threshold_sec)s, active=%(active)s
                WHERE id=%(id)s""", {**d, "id": rule_id})
            conn.commit()
            cur.execute("SELECT * FROM rules WHERE id=%s", (rule_id,))
            row = cur.fetchone()
    return jsonify(dict(row)) if row else (jsonify({"error":"not found"}),404)

# ── VIDEOS ─────────────────────────────────────────────────────────────
@app.route("/api/videos", methods=["GET"])
def get_videos():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM videos ORDER BY uploaded_at DESC")
            return jsonify([dict(r) for r in cur.fetchall()])

@app.route("/api/videos", methods=["POST"])
def upload_video():
    if "file" not in request.files:
        return jsonify({"error": "no file"}), 400
    file = request.files["file"]
    video_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix
    filepath = UPLOAD_DIR / f"{video_id}{ext}"
    file.save(str(filepath))
    cap = cv2.VideoCapture(str(filepath))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    fc  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    video = {
        "id": video_id, "filename": file.filename,
        "label": request.form.get("label", file.filename),
        "camera_type": request.form.get("camera_type", "unknown"),
        "duration": round(fc / fps, 2), "fps": round(fps, 2),
        "frame_count": fc, "uploaded_at": time.time(),
        "file_url": str(filepath)   # temp path — good for current session
    }
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""INSERT INTO videos VALUES (%(id)s,%(filename)s,%(label)s,%(camera_type)s,
                %(duration)s,%(fps)s,%(frame_count)s,%(uploaded_at)s,%(file_url)s)""", video)
            conn.commit()
    return jsonify(video), 201

@app.route("/api/videos/<video_id>", methods=["DELETE"])
def delete_video(video_id):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT file_url FROM videos WHERE id=%s", (video_id,))
            row = cur.fetchone()
            if row and row["file_url"] and Path(row["file_url"]).exists():
                Path(row["file_url"]).unlink(missing_ok=True)
            cur.execute("DELETE FROM videos WHERE id=%s", (video_id,))
            conn.commit()
    return jsonify({"ok": True})

# ── ANALYSIS ───────────────────────────────────────────────────────────
jobs = {}

def extract_frames(video_path, sample_fps=1):
    cap = cv2.VideoCapture(video_path)
    orig_fps = cap.get(cv2.CAP_PROP_FPS) or 25
    interval = max(1, int(orig_fps / sample_fps))
    frames = []
    idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % interval == 0:
            ts = idx / orig_fps
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append((ts, Image.fromarray(rgb), idx))
        idx += 1
    cap.release()
    return frames, orig_fps

def analyze_frame(pil_image, rule_prompt):
    buf = io.BytesIO()
    pil_image.save(buf, format="JPEG", quality=75)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    prompt = f"""You are a video surveillance AI analyzing a single video frame.
RULE: {rule_prompt}

Respond ONLY with a JSON object — no markdown, no explanation:
{{"violation": true or false, "confidence": 0.0 to 1.0, "description": "brief description", "objects_detected": ["list"]}}

Only mark violation=true if you clearly see evidence of the rule being broken."""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role":"user","content":[
            {"type":"image_url","image_url":{"url":f"data:image/jpeg;base64,{b64}","detail":"low"}},
            {"type":"text","text":prompt}
        ]}],
        max_tokens=300, temperature=0.1
    )
    text = response.choices[0].message.content.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"): text = text[4:]
    return json.loads(text.strip())

def pil_to_b64(pil_image):
    buf = io.BytesIO()
    pil_image.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def flush_streak(streak, video, rule, job_id):
    if not streak: return None
    if len(streak) < 2: return None
    alert_id  = str(uuid.uuid4())
    start_ts  = streak[0][0]
    end_ts    = streak[-1][0]
    best      = max(streak, key=lambda x: x[2].get("confidence", 0))
    snap_b64  = pil_to_b64(best[1])
    return {
        "id": alert_id, "job_id": job_id,
        "video_id": video["id"], "video_label": video.get("label",""),
        "rule_id": rule["id"], "rule_name": rule["name"], "rule_prompt": rule["prompt"],
        "severity": rule.get("severity","medium"),
        "start_time": round(start_ts,2), "end_time": round(end_ts,2),
        "duration": round(end_ts - start_ts, 2),
        "confidence": round(best[2].get("confidence",0), 2),
        "description": best[2].get("description",""),
        "objects_detected": json.dumps(best[2].get("objects_detected",[])),
        "snapshot_b64": snap_b64,
        "created_at": time.time(), "frame_count": len(streak),
    }

def run_analysis(job_id, video_id, rule_ids, sample_fps=1):
    try:
        jobs[job_id]["status"] = "running"

        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM videos WHERE id=%s", (video_id,))
                video = dict(cur.fetchone() or {})
                cur.execute(f"SELECT * FROM rules WHERE id = ANY(%s)", (rule_ids,))
                rules = [dict(r) for r in cur.fetchall()]

        if not video:
            jobs[job_id].update({"status":"error","error":"Video not found"}); return
        if not rules:
            jobs[job_id].update({"status":"error","error":"No rules found"}); return

        # Video file — re-download not needed, still in /tmp for this session
        video_path = video.get("file_url","")
        if not Path(video_path).exists():
            jobs[job_id].update({"status":"error","error":"Video file not found on disk. Please re-upload."}); return

        jobs[job_id]["stage"] = "Extracting frames..."
        frames, orig_fps = extract_frames(video_path, sample_fps)
        jobs[job_id]["total_frames"] = len(frames)

        new_alerts = []
        for rule in rules:
            jobs[job_id]["stage"] = f"Analyzing: {rule['name']}"
            streak = []
            for i, (ts, pil_img, fidx) in enumerate(frames):
                jobs[job_id]["progress"] = int((i / max(len(frames),1)) * 100)
                try:
                    result = analyze_frame(pil_img, rule["prompt"])
                except Exception as ex:
                    print(f"Frame {i} error: {ex}")
                    result = {"violation":False,"confidence":0,"description":str(ex),"objects_detected":[]}

                if result.get("violation") and result.get("confidence",0) >= 0.55:
                    streak.append((ts, pil_img, result))
                else:
                    alert = flush_streak(streak, video, rule, job_id)
                    if alert: new_alerts.append(alert)
                    streak = []
                time.sleep(0.3)

            alert = flush_streak(streak, video, rule, job_id)
            if alert: new_alerts.append(alert)

        if new_alerts:
            with get_db() as conn:
                with conn.cursor() as cur:
                    for a in new_alerts:
                        cur.execute("""INSERT INTO alerts VALUES
                            (%(id)s,%(job_id)s,%(video_id)s,%(video_label)s,%(rule_id)s,%(rule_name)s,
                            %(rule_prompt)s,%(severity)s,%(start_time)s,%(end_time)s,%(duration)s,
                            %(confidence)s,%(description)s,%(objects_detected)s,%(snapshot_b64)s,
                            %(created_at)s,%(frame_count)s)""", a)
                    conn.commit()

        jobs[job_id].update({"status":"done","progress":100,"stage":"Complete","alert_count":len(new_alerts)})

    except Exception as ex:
        import traceback; traceback.print_exc()
        jobs[job_id].update({"status":"error","error":str(ex)})

@app.route("/api/analyze", methods=["POST"])
def start_analysis():
    d = request.json
    vid = d.get("video_id"); rids = d.get("rule_ids",[])
    if not vid or not rids:
        return jsonify({"error":"video_id and rule_ids required"}), 400
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"id":job_id,"video_id":vid,"rule_ids":rids,
                    "status":"queued","progress":0,"stage":"Queued","created_at":time.time()}
    threading.Thread(target=run_analysis, args=(job_id,vid,rids,d.get("sample_fps",1)), daemon=True).start()
    return jsonify({"job_id":job_id}), 202

@app.route("/api/jobs/<job_id>")
def get_job(job_id):
    job = jobs.get(job_id)
    return jsonify(job) if job else (jsonify({"error":"not found"}),404)

@app.route("/api/jobs")
def list_jobs():
    return jsonify(list(jobs.values()))

# ── ALERTS ─────────────────────────────────────────────────────────────
@app.route("/api/alerts")
def get_alerts():
    q = "SELECT * FROM alerts"
    params = []
    filters = []
    if request.args.get("video_id"):
        filters.append("video_id=%s"); params.append(request.args["video_id"])
    if request.args.get("rule_id"):
        filters.append("rule_id=%s"); params.append(request.args["rule_id"])
    if filters:
        q += " WHERE " + " AND ".join(filters)
    q += " ORDER BY created_at DESC"
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(q, params)
            rows = [dict(r) for r in cur.fetchall()]
    for r in rows:
        if r.get("objects_detected"):
            try: r["objects_detected"] = json.loads(r["objects_detected"])
            except: pass
    return jsonify(rows)

@app.route("/api/alerts/<alert_id>", methods=["DELETE"])
def delete_alert(alert_id):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM alerts WHERE id=%s", (alert_id,))
            conn.commit()
    return jsonify({"ok":True})

@app.route("/api/alerts", methods=["DELETE"])
def clear_alerts():
    vid = request.args.get("video_id")
    with get_db() as conn:
        with conn.cursor() as cur:
            if vid:
                cur.execute("DELETE FROM alerts WHERE video_id=%s", (vid,))
            else:
                cur.execute("DELETE FROM alerts")
            conn.commit()
    return jsonify({"ok":True})

# ── SNAPSHOTS (served from DB) ─────────────────────────────────────────
@app.route("/api/media/snapshot/<alert_id>")
def get_snapshot(alert_id):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT snapshot_b64 FROM alerts WHERE id=%s", (alert_id,))
            row = cur.fetchone()
    if not row or not row["snapshot_b64"]:
        return jsonify({"error":"not found"}), 404
    img_bytes = base64.b64decode(row["snapshot_b64"])
    return send_file(io.BytesIO(img_bytes), mimetype="image/jpeg")

# ── STATS ──────────────────────────────────────────────────────────────
@app.route("/api/stats")
def get_stats():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as c FROM alerts"); ta = cur.fetchone()["c"]
            cur.execute("SELECT COUNT(*) as c FROM rules");  tr = cur.fetchone()["c"]
            cur.execute("SELECT COUNT(*) as c FROM videos"); tv = cur.fetchone()["c"]
            cur.execute("SELECT severity, COUNT(*) as c FROM alerts GROUP BY severity")
            sev = {"critical":0,"high":0,"medium":0,"low":0}
            for r in cur.fetchall(): sev[r["severity"]] = r["c"]
            cur.execute("SELECT rule_name, COUNT(*) as c FROM alerts GROUP BY rule_name")
            by_rule = {r["rule_name"]: r["c"] for r in cur.fetchall()}
    return jsonify({"total_alerts":ta,"total_rules":tr,"total_videos":tv,
                    "severity_breakdown":sev,"alerts_by_rule":by_rule})

@app.route("/api/health")
def health():
    return jsonify({"status":"ok","time":time.time(),"model":"gpt-4o"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port, debug=False)
