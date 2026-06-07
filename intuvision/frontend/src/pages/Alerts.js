import React, { useEffect, useState } from 'react';
import { getAlerts, deleteAlert, snapshotUrl, clipUrl, getRules, getVideos } from '../api';
import { Trash2, Image, Video, ChevronDown, ChevronUp, Filter } from 'lucide-react';

const SEV_COLOR = { critical:'#ef4444', high:'#f97316', medium:'#eab308', low:'#22c55e' };
const SEV_BG    = { critical:'#450a0a', high:'#431407', medium:'#422006', low:'#052e16' };

function AlertCard({ alert, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [showSnap, setShowSnap] = useState(false);
  const [showClip, setShowClip] = useState(false);

  return (
    <div style={{ background:'#1e293b', borderRadius:10, border:`1px solid ${SEV_COLOR[alert.severity]||'#334155'}33`, marginBottom:10, overflow:'hidden' }}>
      <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }} onClick={()=>setExpanded(e=>!e)}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:SEV_COLOR[alert.severity]||'#6366f1', flexShrink:0 }} />
        <div style={{ flex:1, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:2 }}>
            <span style={{ fontSize:14, fontWeight:600, color:'#e2e8f0' }}>{alert.rule_name}</span>
            <span style={{ fontSize:11, fontWeight:600, background:SEV_BG[alert.severity], color:SEV_COLOR[alert.severity], borderRadius:5, padding:'2px 8px', textTransform:'uppercase' }}>{alert.severity}</span>
            <span style={{ fontSize:11, color:'#64748b' }}>confidence: {Math.round((alert.confidence||0)*100)}%</span>
          </div>
          <div style={{ fontSize:12, color:'#64748b' }}>{alert.video_label} · {alert.start_time}s → {alert.end_time}s ({alert.duration}s)</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={e=>{e.stopPropagation();onDelete(alert.id);}} style={{ background:'#450a0a', border:'none', color:'#ef4444', borderRadius:6, padding:'5px 8px', cursor:'pointer' }}><Trash2 size={13}/></button>
          {expanded ? <ChevronUp size={16} color="#475569"/> : <ChevronDown size={16} color="#475569"/>}
        </div>
      </div>

      {expanded && (
        <div style={{ padding:'0 18px 18px', borderTop:'1px solid #334155' }}>
          <div style={{ marginTop:14, marginBottom:12 }}>
            <div style={{ fontSize:12, color:'#94a3b8', marginBottom:4, fontWeight:600 }}>Detection Description</div>
            <div style={{ fontSize:13, color:'#e2e8f0', background:'#0f172a', borderRadius:8, padding:'10px 14px' }}>{alert.description || 'No description'}</div>
          </div>
          {alert.objects_detected?.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:'#94a3b8', marginBottom:6, fontWeight:600 }}>Objects Detected</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {alert.objects_detected.map((o,i) => (
                  <span key={i} style={{ fontSize:11, background:'#1e1b4b', color:'#a5b4fc', borderRadius:5, padding:'3px 10px' }}>{o}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setShowSnap(s=>!s)} style={{ display:'flex', alignItems:'center', gap:6, background:'#1e293b', border:'1px solid #334155', color:'#94a3b8', borderRadius:7, padding:'7px 14px', cursor:'pointer', fontSize:12 }}>
              <Image size={13}/> {showSnap?'Hide':'View'} Snapshot
            </button>
            <button onClick={()=>setShowClip(s=>!s)} style={{ display:'flex', alignItems:'center', gap:6, background:'#1e293b', border:'1px solid #334155', color:'#94a3b8', borderRadius:7, padding:'7px 14px', cursor:'pointer', fontSize:12 }}>
              <Video size={13}/> {showClip?'Hide':'View'} Clip
            </button>
            <a href={clipUrl(alert.id)} download style={{ display:'flex', alignItems:'center', gap:6, background:'#312e81', border:'none', color:'#a5b4fc', borderRadius:7, padding:'7px 14px', cursor:'pointer', fontSize:12, textDecoration:'none' }}>
              ↓ Download Clip
            </a>
          </div>
          {showSnap && (
            <div style={{ marginTop:12 }}>
              <img src={snapshotUrl(alert.id)} alt="snapshot" style={{ maxWidth:'100%', borderRadius:8, border:'1px solid #334155' }}
                onError={e=>{e.target.style.display='none';}} />
            </div>
          )}
          {showClip && (
            <div style={{ marginTop:12 }}>
              <video src={clipUrl(alert.id)} controls style={{ maxWidth:'100%', borderRadius:8, border:'1px solid #334155' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [videos, setVideos] = useState([]);
  const [filterSev, setFilterSev] = useState('');
  const [filterRule, setFilterRule] = useState('');
  const [filterVideo, setFilterVideo] = useState('');

  useEffect(() => {
    getAlerts().then(setAlerts).catch(()=>{});
    getRules().then(setRules).catch(()=>{});
    getVideos().then(setVideos).catch(()=>{});
  }, []);

  const del = async (id) => {
    const { deleteAlert: da } = await import('../api');
    await da(id);
    setAlerts(a => a.filter(x=>x.id!==id));
  };

  const filtered = alerts.filter(a => {
    if (filterSev && a.severity!==filterSev) return false;
    if (filterRule && a.rule_id!==filterRule) return false;
    if (filterVideo && a.video_id!==filterVideo) return false;
    return true;
  });

  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#f1f5f9', margin:0 }}>Alerts</h1>
          <p style={{ color:'#64748b', margin:'4px 0 0', fontSize:13 }}>{filtered.length} alert{filtered.length!==1?'s':''} {filterSev||filterRule||filterVideo?'(filtered)':''}</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <select value={filterSev} onChange={e=>setFilterSev(e.target.value)}
          style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13 }}>
          <option value="">All Severities</option>
          {['critical','high','medium','low'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
        <select value={filterRule} onChange={e=>setFilterRule(e.target.value)}
          style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13 }}>
          <option value="">All Rules</option>
          {rules.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={filterVideo} onChange={e=>setFilterVideo(e.target.value)}
          style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13 }}>
          <option value="">All Videos</option>
          {videos.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        {(filterSev||filterRule||filterVideo) && (
          <button onClick={()=>{setFilterSev('');setFilterRule('');setFilterVideo('');}}
            style={{ background:'#334155', border:'none', color:'#94a3b8', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontSize:13 }}>
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0
        ? <div style={{ background:'#1e293b', borderRadius:12, padding:40, textAlign:'center', color:'#475569', border:'1px dashed #334155' }}>
            No alerts yet. Run an analysis to detect violations.
          </div>
        : filtered.map(a => <AlertCard key={a.id} alert={a} onDelete={del} />)
      }
    </div>
  );
}
