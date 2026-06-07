import os, json, uuid, time, threading
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cv2
import google.generativeai as genai
from PIL import Image
import io

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".agents/.env")

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

app = Flask(__name__)
CORS(app)

BASE = Path(__file__).parent
UPLOAD_DIR = BASE / "uploads"
CLIPS_DIR  = BASE / "clips"
DATA_DIR   = BASE / "data"
for d in [UPLOAD_DIR, CLIPS_DIR, DATA_DIR]:
    d.mkdir(exist_ok=True)

RULES_FILE  = DATA_DIR / "rules.json"
VIDEOS_FILE = DATA_DIR / "videos.json"
ALERTS_FILE = DATA_DIR / "alerts.json"

def load_json(path):
    return json.loads(path.read_text()) if path.exists() else []

def save_json(path, data):
    path.write_text(json.dumps(data, indent=2))

# ── RULES ──────────────────────────────────────────────────────────────
@app.route("/api/rules", methods=["GET"])
def get_rules():
    return jsonify(load_json(RULES_FILE))

@app.route("/api/rules", methods=["POST"])
def create_rule():
    rules = load_json(RULES_FILE)
    rule = {**request.json, "id": str(uuid.uuid4()), "created_at": time.time(), "active": True}
    rules.append(rule)
    save_json(RULES_FILE, rules)
    return jsonify(rule), 201

@app.route("/api/rules/<rule_id>", methods=["DELETE"])
def delete_rule(rule_id):
    save_json(RULES_FILE, [r for r in load_json(RULES_FILE) if r["id"] != rule_id])
    return jsonify({"ok": True})

@app.route("/api/rules/<rule_id>", methods=["PUT"])
def update_rule(rule_id):
    rules = load_json(RULES_FILE)
    for i, r in enumerate(rules):
        if r["id"] == rule_id:
            rules[i] = {**r, **request.json}
            save_json(RULES_FILE, rules)
            return jsonify(rules[i])
    return jsonify({"error": "not found"}), 404

# ── VIDEOS ─────────────────────────────────────────────────────────────
@app.route("/api/videos", methods=["GET"])
def get_videos():
    return jsonify(load_json(VIDEOS_FILE))

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
    videos = load_json(VIDEOS_FILE)
    video = {
        "id": video_id, "filename": file.filename, "path": str(filepath),
        "uploaded_at": time.time(), "duration": round(fc/fps, 2),
        "fps": round(fps, 2), "frame_count": fc,
        "label": request.form.get("label", file.filename),
        "camera_type": request.form.get("camera_type", "unknown"),
    }
    videos.append(video)
    save_json(VIDEOS_FILE, videos)
    return jsonify(video), 201

@app.route("/api/videos/<video_id>", methods=["DELETE"])
def delete_video(video_id):
    videos = load_json(VIDEOS_FILE)
    v = next((x for x in videos if x["id"] == video_id), None)
    if v and Path(v["path"]).exists():
        Path(v["path"]).unlink()
    save_json(VIDEOS_FILE, [x for x in videos if x["id"] != video_id])
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
    model = genai.GenerativeModel("gemini-1.5-flash")
    buf = io.BytesIO()
    pil_image.save(buf, format="JPEG", quality=80)
    img_bytes = buf.getvalue()
    prompt = f"""You are a video surveillance AI.
RULE: {rule_prompt}
Analyze this frame. Respond ONLY with a JSON object, no markdown:
{{"violation": true/false, "confidence": 0.0-1.0, "description": "brief description", "objects_detected": ["list"]}}
Only mark violation=true if you clearly see evidence."""
    resp = model.generate_content([prompt, {"mime_type": "image/jpeg", "data": img_bytes}])
    text = resp.text.strip().strip("```json").strip("```").strip()
    return json.loads(text)

def save_snapshot(pil_image, snap_id):
    p = CLIPS_DIR / f"{snap_id}.jpg"
    pil_image.save(str(p), quality=90)
    return str(p)

def save_clip(video_path, start_sec, end_sec, clip_id, orig_fps):
    cap = cv2.VideoCapture(video_path)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    clip_path = CLIPS_DIR / f"{clip_id}.mp4"
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(clip_path), fourcc, orig_fps, (w, h))
    s = max(0, int((start_sec - 2) * orig_fps))
    e = int((end_sec + 2) * orig_fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES, s)
    fi = s
    while fi <= e:
        ret, frame = cap.read()
        if not ret:
            break
        out.write(frame)
        fi += 1
    cap.release()
    out.release()
    return str(clip_path)

def flush_streak(streak, video, rule, job_id, orig_fps, time_threshold):
    if not streak:
        return None
    duration = streak[-1][0] - streak[0][0]
    if duration < time_threshold and len(streak) < 2:
        return None
    alert_id = str(uuid.uuid4())
    start_ts, end_ts = streak[0][0], streak[-1][0]
    best = max(streak, key=lambda x: x[2].get("confidence", 0))
    snap_path = save_snapshot(best[1], f"snap_{alert_id}")
    clip_path = save_clip(video["path"], start_ts, end_ts, f"clip_{alert_id}", orig_fps)
    return {
        "id": alert_id, "job_id": job_id,
        "video_id": video["id"], "video_label": video.get("label",""),
        "rule_id": rule["id"], "rule_name": rule["name"], "rule_prompt": rule["prompt"],
        "severity": rule.get("severity","medium"),
        "start_time": round(start_ts,2), "end_time": round(end_ts,2),
        "duration": round(end_ts-start_ts,2),
        "confidence": round(best[2].get("confidence",0),2),
        "description": best[2].get("description",""),
        "objects_detected": best[2].get("objects_detected",[]),
        "snapshot_path": snap_path, "clip_path": clip_path,
        "created_at": time.time(), "frame_count": len(streak),
    }

def run_analysis(job_id, video_id, rule_ids, sample_fps=1):
    try:
        jobs[job_id]["status"] = "running"
        videos = load_json(VIDEOS_FILE)
        video = next((v for v in videos if v["id"] == video_id), None)
        if not video:
            jobs[job_id].update({"status":"error","error":"Video not found"}); return
        rules = [r for r in load_json(RULES_FILE) if r["id"] in rule_ids]
        if not rules:
            jobs[job_id].update({"status":"error","error":"No rules found"}); return

        jobs[job_id]["stage"] = "Extracting frames..."
        frames, orig_fps = extract_frames(video["path"], sample_fps)
        jobs[job_id]["total_frames"] = len(frames)

        all_alerts = load_json(ALERTS_FILE)
        new_alerts = []

        for rule in rules:
            jobs[job_id]["stage"] = f"Rule: {rule['name']}"
            streak = []
            thresh = rule.get("time_threshold_sec", 3)
            for i, (ts, pil_img, fidx) in enumerate(frames):
                jobs[job_id]["progress"] = int((i / max(len(frames),1)) * 100)
                try:
                    result = analyze_frame(pil_img, rule["prompt"])
                except Exception as ex:
                    result = {"violation": False, "confidence": 0, "description": str(ex), "objects_detected": []}

                if result.get("violation") and result.get("confidence",0) >= 0.55:
                    streak.append((ts, pil_img, result))
                else:
                    alert = flush_streak(streak, video, rule, job_id, orig_fps, thresh)
                    if alert:
                        new_alerts.append(alert)
                    streak = []
                if i % 8 == 0 and i > 0:
                    time.sleep(0.3)

            alert = flush_streak(streak, video, rule, job_id, orig_fps, thresh)
            if alert:
                new_alerts.append(alert)

        all_alerts.extend(new_alerts)
        save_json(ALERTS_FILE, all_alerts)
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
    jobs[job_id] = {"id":job_id,"video_id":vid,"rule_ids":rids,"status":"queued","progress":0,"stage":"Queued","created_at":time.time()}
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
    alerts = load_json(ALERTS_FILE)
    if request.args.get("video_id"):
        alerts = [a for a in alerts if a.get("video_id")==request.args["video_id"]]
    if request.args.get("rule_id"):
        alerts = [a for a in alerts if a.get("rule_id")==request.args["rule_id"]]
    return jsonify(sorted(alerts, key=lambda a: a.get("created_at",0), reverse=True))

@app.route("/api/alerts/<alert_id>", methods=["DELETE"])
def delete_alert(alert_id):
    alerts = load_json(ALERTS_FILE)
    a = next((x for x in alerts if x["id"]==alert_id), None)
    if a:
        for k in ["snapshot_path","clip_path"]:
            p=a.get(k)
            if p and Path(p).exists(): Path(p).unlink()
    save_json(ALERTS_FILE,[x for x in alerts if x["id"]!=alert_id])
    return jsonify({"ok":True})

@app.route("/api/alerts", methods=["DELETE"])
def clear_alerts():
    alerts = load_json(ALERTS_FILE)
    vid = request.args.get("video_id")
    targets = [a for a in alerts if a.get("video_id")==vid] if vid else alerts
    for a in targets:
        for k in ["snapshot_path","clip_path"]:
            p=a.get(k)
            if p and Path(p).exists(): Path(p).unlink()
    save_json(ALERTS_FILE,[a for a in alerts if a.get("video_id")!=vid] if vid else [])
    return jsonify({"ok":True})

# ── MEDIA ──────────────────────────────────────────────────────────────
@app.route("/api/media/snapshot/<alert_id>")
def get_snapshot(alert_id):
    a = next((x for x in load_json(ALERTS_FILE) if x["id"]==alert_id), None)
    if not a or not Path(a.get("snapshot_path","")).exists():
        return jsonify({"error":"not found"}),404
    return send_file(a["snapshot_path"], mimetype="image/jpeg")

@app.route("/api/media/clip/<alert_id>")
def get_clip(alert_id):
    a = next((x for x in load_json(ALERTS_FILE) if x["id"]==alert_id), None)
    if not a or not Path(a.get("clip_path","")).exists():
        return jsonify({"error":"not found"}),404
    return send_file(a["clip_path"], mimetype="video/mp4")

# ── STATS ──────────────────────────────────────────────────────────────
@app.route("/api/stats")
def get_stats():
    alerts=load_json(ALERTS_FILE); rules=load_json(RULES_FILE); videos=load_json(VIDEOS_FILE)
    sev={"critical":0,"high":0,"medium":0,"low":0}
    rule_c={}
    for a in alerts:
        sev[a.get("severity","medium")]=sev.get(a.get("severity","medium"),0)+1
        rule_c[a.get("rule_name","Unknown")]=rule_c.get(a.get("rule_name","Unknown"),0)+1
    return jsonify({"total_alerts":len(alerts),"total_rules":len(rules),"total_videos":len(videos),"severity_breakdown":sev,"alerts_by_rule":rule_c})

if __name__=="__main__":
    app.run(host="0.0.0.0", port=5050, debug=False)
