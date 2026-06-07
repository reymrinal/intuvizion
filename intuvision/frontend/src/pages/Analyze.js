import React, { useEffect, useState } from 'react';
import { getVideos, getRules, startAnalysis, getJob } from '../api';
import { Play, CheckCircle, XCircle, Loader, AlertTriangle } from 'lucide-react';

export default function Analyze() {
  const [videos, setVideos] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [selectedRules, setSelectedRules] = useState([]);
  const [sampleFps, setSampleFps] = useState(1);
  const [job, setJob] = useState(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    getVideos().then(setVideos).catch(()=>{});
    getRules().then(setRules).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!polling || !job) return;
    const t = setInterval(async () => {
      const j = await getJob(job.job_id).catch(()=>null);
      if (j) {
        setJob(j);
        if (j.status === 'done' || j.status === 'error') {
          setPolling(false);
        }
      }
    }, 2000);
    return () => clearInterval(t);
  }, [polling, job]);

  const toggleRule = (id) => setSelectedRules(r => r.includes(id) ? r.filter(x=>x!==id) : [...r,id]);

  const run = async () => {
    if (!selectedVideo || selectedRules.length===0) return;
    const res = await startAnalysis({ video_id:selectedVideo, rule_ids:selectedRules, sample_fps:sampleFps });
    setJob({ job_id:res.job_id, status:'queued', progress:0, stage:'Queued' });
    setPolling(true);
  };

  const statusIcon = (s) => {
    if (s==='done')    return <CheckCircle size={16} color="#22c55e"/>;
    if (s==='error')   return <XCircle size={16} color="#ef4444"/>;
    if (s==='running') return <Loader size={16} color="#6366f1" style={{animation:'spin 1s linear infinite'}}/>;
    return <AlertTriangle size={16} color="#eab308"/>;
  };


  return (
    <div style={{ padding:32 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#f1f5f9', margin:0 }}>Run Analysis</h1>
        <p style={{ color:'#64748b', margin:'4px 0 0', fontSize:13 }}>Select a video + rules, hit Run. Gemini Vision analyzes every frame.</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
        {/* Select Video */}
        <div style={{ background:'#1e293b', borderRadius:12, padding:20, border:'1px solid #334155' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:600, color:'#e2e8f0' }}>1. Select Video</h3>
          {videos.length===0
            ? <div style={{ color:'#475569', fontSize:13 }}>No videos yet. Upload one first.</div>
            : videos.map(v => (
                <div key={v.id} onClick={()=>setSelectedVideo(v.id)}
                  style={{ padding:'10px 12px', borderRadius:8, border:`1px solid ${selectedVideo===v.id?'#6366f1':'#334155'}`, marginBottom:8, cursor:'pointer', background:selectedVideo===v.id?'#1e1b4b':'transparent', transition:'all .15s' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>{v.label}</div>
                  <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{v.camera_type?.replace(/_/g,' ')} · {Math.round(v.duration||0)}s · {v.fps}fps</div>
                </div>
              ))
          }
        </div>

        {/* Select Rules */}
        <div style={{ background:'#1e293b', borderRadius:12, padding:20, border:'1px solid #334155' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:600, color:'#e2e8f0' }}>2. Select Rules</h3>
          {rules.length===0
            ? <div style={{ color:'#475569', fontSize:13 }}>No rules yet. Create some first.</div>
            : rules.map(r => (
                <div key={r.id} onClick={()=>toggleRule(r.id)}
                  style={{ padding:'10px 12px', borderRadius:8, border:`1px solid ${selectedRules.includes(r.id)?'#6366f1':'#334155'}`, marginBottom:8, cursor:'pointer', background:selectedRules.includes(r.id)?'#1e1b4b':'transparent', transition:'all .15s', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${selectedRules.includes(r.id)?'#6366f1':'#475569'}`, background:selectedRules.includes(r.id)?'#6366f1':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {selectedRules.includes(r.id) && <CheckCircle size={10} color="white"/>}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>{r.name}</div>
                    <div style={{ fontSize:11, color:'#64748b' }}>{r.prompt.slice(0,60)}{r.prompt.length>60?'...':''}</div>
                  </div>
                </div>
              ))
          }
        </div>
      </div>

      {/* Settings */}
      <div style={{ background:'#1e293b', borderRadius:12, padding:20, border:'1px solid #334155', marginBottom:20, display:'flex', alignItems:'center', gap:24 }}>
        <div>
          <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Sample Rate (frames/sec)</label>
          <select value={sampleFps} onChange={e=>setSampleFps(+e.target.value)}
            style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13 }}>
            <option value={0.5}>0.5 fps (1 frame every 2s) — cheapest</option>
            <option value={1}>1 fps — recommended</option>
            <option value={2}>2 fps — more detail</option>
            <option value={3}>3 fps — high detail</option>
          </select>
        </div>
        <div style={{ fontSize:12, color:'#475569', maxWidth:300 }}>
          Lower fps = faster + cheaper. Most rules (phone, seatbelt, guard) work well at 1fps.
        </div>
      </div>

      {/* Run button */}
      <button onClick={run} disabled={!selectedVideo||selectedRules.length===0||polling}
        style={{ display:'flex', alignItems:'center', gap:10, background: (!selectedVideo||selectedRules.length===0||polling)?'#334155':'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', color:'white', borderRadius:10, padding:'14px 28px', cursor: (!selectedVideo||selectedRules.length===0||polling)?'not-allowed':'pointer', fontWeight:700, fontSize:15, marginBottom:28 }}>
        <Play size={18} /> {polling ? 'Analyzing...' : 'Run Analysis'}
      </button>

      {/* Current job progress */}
      {job && (
        <div style={{ background:'#1e293b', borderRadius:12, padding:20, border:`1px solid ${job.status==='done'?'#16a34a':job.status==='error'?'#dc2626':'#334155'}`, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            {statusIcon(job.status)}
            <span style={{ fontWeight:600, color:'#e2e8f0', fontSize:14 }}>
              {job.status==='done' ? `Complete — ${job.alert_count} alert(s) found` : job.status==='error' ? `Error: ${job.error}` : job.stage}
            </span>
          </div>
          {(job.status==='running'||job.status==='queued') && (
            <div style={{ background:'#0f172a', borderRadius:6, height:8, overflow:'hidden' }}>
              <div style={{ width:`${job.progress||0}%`, height:'100%', background:'linear-gradient(90deg,#6366f1,#8b5cf6)', transition:'width .5s', borderRadius:6 }} />
            </div>
          )}
          {job.total_frames && <div style={{ fontSize:12, color:'#64748b', marginTop:6 }}>Frame {Math.round((job.progress/100)*job.total_frames)} of {job.total_frames}</div>}
        </div>
      )}
    </div>
  );
}
