import React, { useEffect, useState, useRef } from 'react';
import { getVideos, uploadVideo, deleteVideo } from '../api';
import { Upload, Trash2, Clock, Film, AlertTriangle } from 'lucide-react';

function fmt(sec) {
  const m = Math.floor(sec/60), s = Math.round(sec%60);
  return `${m}:${s.toString().padStart(2,'0')}`;
}

export default function Videos() {
  const [videos, setVideos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [label, setLabel] = useState('');
  const [cameraType, setCameraType] = useState('truck_cabin');
  const fileRef = useRef();

  useEffect(() => { getVideos().then(setVideos).catch(()=>{}); }, []);

  const handleFiles = async (files) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('label', label || file.name);
      form.append('camera_type', cameraType);
      const v = await uploadVideo(form);
      setVideos(vs => [...vs, v]);
      setLabel('');
    } catch(e) { alert('Upload failed: '+e.message); }
    setUploading(false);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this video?')) return;
    await deleteVideo(id);
    setVideos(v => v.filter(x => x.id!==id));
  };

  return (
    <div style={{ padding:32 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#f1f5f9', margin:0 }}>Video Library</h1>
        <p style={{ color:'#64748b', margin:'4px 0 0', fontSize:13 }}>Upload recordings to analyze. Any camera source works.</p>
      </div>

      {/* Upload area */}
      <div style={{ background:'#1e293b', borderRadius:12, padding:24, border:'1px solid #334155', marginBottom:24 }}>
        <h3 style={{ margin:'0 0 16px', color:'#e2e8f0', fontSize:14, fontWeight:600 }}>Upload Video</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <div>
            <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Label (optional)</label>
            <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Truck 42 - Trip Delhi-Pune"
              style={{ width:'100%', background:'#0f172a', border:'1px solid #334155', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontSize:13, boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Camera Type</label>
            <select value={cameraType} onChange={e=>setCameraType(e.target.value)}
              style={{ width:'100%', background:'#0f172a', border:'1px solid #334155', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontSize:13 }}>
              <option value="truck_cabin">Truck Cabin</option>
              <option value="truck_road">Truck Road-Facing</option>
              <option value="plant_gate">Plant Gate</option>
              <option value="warehouse_dock">Warehouse Dock</option>
              <option value="yard">Yard / Parking</option>
              <option value="shopfloor">Shopfloor / Loading Bay</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div
          onDragOver={e=>{e.preventDefault();setDragOver(true);}}
          onDragLeave={()=>setDragOver(false)}
          onDrop={e=>{e.preventDefault();setDragOver(false);handleFiles(e.dataTransfer.files);}}
          onClick={()=>fileRef.current.click()}
          style={{ border:`2px dashed ${dragOver?'#6366f1':'#334155'}`, borderRadius:10, padding:'32px', textAlign:'center', cursor:'pointer', transition:'all .2s', background: dragOver?'#1e1b4b':'transparent' }}>
          <Upload size={28} color={dragOver?'#6366f1':'#475569'} style={{ marginBottom:8 }} />
          <div style={{ color:'#94a3b8', fontSize:14 }}>{uploading ? 'Uploading...' : 'Drop video here or click to browse'}</div>
          <div style={{ color:'#475569', fontSize:12, marginTop:4 }}>MP4, AVI, MOV, MKV supported</div>
          <input ref={fileRef} type="file" accept="video/*" style={{ display:'none' }} onChange={e=>handleFiles(e.target.files)} />
        </div>
      </div>

      {/* Videos grid */}
      {videos.length === 0
        ? <div style={{ background:'#1e293b', borderRadius:12, padding:40, textAlign:'center', color:'#475569', border:'1px dashed #334155' }}>
            No videos yet. Upload your first recording.
          </div>
        : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
            {videos.map(v => (
              <div key={v.id} style={{ background:'#1e293b', borderRadius:12, border:'1px solid #334155', overflow:'hidden' }}>
                <div style={{ background:'#0f172a', height:120, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Film size={40} color="#334155" />
                </div>
                <div style={{ padding:16 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#e2e8f0', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.label}</div>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:2, textTransform:'capitalize' }}>{v.camera_type?.replace(/_/g,' ')}</div>
                  <div style={{ display:'flex', gap:12, marginTop:8 }}>
                    <span style={{ fontSize:11, color:'#64748b', display:'flex', alignItems:'center', gap:4 }}><Clock size={11}/>{fmt(v.duration||0)}</span>
                    <span style={{ fontSize:11, color:'#64748b', display:'flex', alignItems:'center', gap:4 }}><Film size={11}/>{v.fps||0} fps</span>
                    <span style={{ fontSize:11, color:'#64748b', display:'flex', alignItems:'center', gap:4 }}><AlertTriangle size={11}/>{v.frame_count||0} frames</span>
                  </div>
                  <button onClick={()=>del(v.id)} style={{ marginTop:12, background:'#450a0a', border:'none', color:'#ef4444', borderRadius:6, padding:'6px 12px', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
                    <Trash2 size={12}/> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}
