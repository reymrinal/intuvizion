import React, { useEffect, useState } from 'react';
import { getRules, createRule, deleteRule, updateRule } from '../api';
import { Plus, Trash2, Edit2, Check, X, Zap } from 'lucide-react';

const SEVERITIES = ['low','medium','high','critical'];
const SEV_COLOR  = { critical:'#ef4444', high:'#f97316', medium:'#eab308', low:'#22c55e' };

const SUGGESTIONS = [
  "Alert if the driver is using a phone while driving",
  "Alert if the driver is not wearing a seatbelt",
  "Alert if the driver is smoking inside the cabin",
  "Alert if no person is visible in the driver seat while ignition is on",
  "Alert if a security guard is absent from the gate area",
  "Alert if more than 5 vehicles are waiting near the gate",
  "Alert if a worker is not wearing a helmet in a loading area",
  "Alert if a person enters a restricted zone",
  "Alert if loading activity has stopped for an extended period",
  "Alert if a truck remains stationary at a dock for too long",
];

function Tag({ label, color }) {
  return <span style={{ fontSize:11, fontWeight:600, background:`${color}22`, color, borderRadius:5, padding:'2px 8px', textTransform:'uppercase' }}>{label}</span>;
}

export default function Rules() {
  const [rules, setRules] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', prompt:'', severity:'high', time_threshold_sec:3, context:'' });
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { getRules().then(setRules).catch(()=>{}); }, []);

  const submit = async () => {
    if (!form.name || !form.prompt) return;
    setLoading(true);
    try {
      if (editId) {
        const updated = await updateRule(editId, form);
        setRules(r => r.map(x => x.id===editId ? updated : x));
      } else {
        const rule = await createRule(form);
        setRules(r => [...r, rule]);
      }
      setShowForm(false); setEditId(null);
      setForm({ name:'', prompt:'', severity:'high', time_threshold_sec:3, context:'' });
    } catch(e) { alert('Error saving rule'); }
    setLoading(false);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    await deleteRule(id);
    setRules(r => r.filter(x => x.id!==id));
  };

  const startEdit = (rule) => {
    setForm({ name:rule.name, prompt:rule.prompt, severity:rule.severity, time_threshold_sec:rule.time_threshold_sec, context:rule.context||'' });
    setEditId(rule.id); setShowForm(true);
  };

  const useSuggestion = (s) => setForm(f => ({ ...f, prompt: s, name: f.name || s.slice(0,40) }));

  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#f1f5f9', margin:0 }}>Vision Rules</h1>
          <p style={{ color:'#64748b', margin:'4px 0 0', fontSize:13 }}>Write plain-English rules — the AI watches your videos for you.</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name:'', prompt:'', severity:'high', time_threshold_sec:3, context:'' }); }}
          style={{ display:'flex', alignItems:'center', gap:8, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', color:'white', borderRadius:8, padding:'10px 18px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> New Rule
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background:'#1e293b', borderRadius:12, padding:24, border:'1px solid #6366f1', marginBottom:24 }}>
          <h3 style={{ margin:'0 0 16px', color:'#e2e8f0', fontSize:15 }}>{editId ? 'Edit Rule' : 'Create Rule'}</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            <div>
              <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Rule Name *</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                placeholder="e.g. Phone Usage Detection"
                style={{ width:'100%', background:'#0f172a', border:'1px solid #334155', borderRadius:8, padding:'10px 12px', color:'#e2e8f0', fontSize:14, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Severity</label>
              <select value={form.severity} onChange={e=>setForm(f=>({...f,severity:e.target.value}))}
                style={{ width:'100%', background:'#0f172a', border:'1px solid #334155', borderRadius:8, padding:'10px 12px', color:'#e2e8f0', fontSize:14 }}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Rule Prompt * (plain English)</label>
            <textarea value={form.prompt} onChange={e=>setForm(f=>({...f,prompt:e.target.value}))}
              placeholder="e.g. Alert if the driver is using a mobile phone while driving"
              rows={3}
              style={{ width:'100%', background:'#0f172a', border:'1px solid #334155', borderRadius:8, padding:'10px 12px', color:'#e2e8f0', fontSize:14, resize:'vertical', boxSizing:'border-box' }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            <div>
              <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Time Threshold (seconds)</label>
              <input type="number" min={1} value={form.time_threshold_sec} onChange={e=>setForm(f=>({...f,time_threshold_sec:+e.target.value}))}
                style={{ width:'100%', background:'#0f172a', border:'1px solid #334155', borderRadius:8, padding:'10px 12px', color:'#e2e8f0', fontSize:14, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Additional Context (optional)</label>
              <input value={form.context} onChange={e=>setForm(f=>({...f,context:e.target.value}))}
                placeholder="e.g. Truck cabin camera, driver seat area"
                style={{ width:'100%', background:'#0f172a', border:'1px solid #334155', borderRadius:8, padding:'10px 12px', color:'#e2e8f0', fontSize:14, boxSizing:'border-box' }} />
            </div>
          </div>

          {/* Suggestions */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
              <Zap size={13} color="#8b5cf6" />
              <span style={{ fontSize:12, color:'#8b5cf6', fontWeight:600 }}>Quick suggestions</span>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={()=>useSuggestion(s)}
                  style={{ fontSize:11, background:'#1e293b', border:'1px solid #334155', color:'#94a3b8', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>
                  {s.slice(0,50)}{s.length>50?'...':''}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={submit} disabled={loading}
              style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', color:'white', borderRadius:8, padding:'10px 20px', cursor:'pointer', fontWeight:600, fontSize:14, display:'flex', alignItems:'center', gap:6 }}>
              <Check size={15} /> {loading ? 'Saving...' : editId ? 'Update Rule' : 'Create Rule'}
            </button>
            <button onClick={()=>{setShowForm(false);setEditId(null);}}
              style={{ background:'#334155', border:'none', color:'#94a3b8', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', gap:6 }}>
              <X size={15} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {rules.length === 0
        ? <div style={{ background:'#1e293b', borderRadius:12, padding:40, textAlign:'center', color:'#475569', border:'1px dashed #334155' }}>
            No rules yet. Create your first rule to get started.
          </div>
        : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {rules.map(rule => (
              <div key={rule.id} style={{ background:'#1e293b', borderRadius:12, padding:20, border:'1px solid #334155', display:'flex', alignItems:'flex-start', gap:16 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                    <span style={{ fontSize:15, fontWeight:600, color:'#e2e8f0' }}>{rule.name}</span>
                    <Tag label={rule.severity} color={SEV_COLOR[rule.severity]||'#6366f1'} />
                  </div>
                  <div style={{ fontSize:13, color:'#94a3b8', marginBottom:4, fontStyle:'italic' }}>"{rule.prompt}"</div>
                  <div style={{ fontSize:12, color:'#475569' }}>Threshold: {rule.time_threshold_sec}s · {rule.context || 'No additional context'}</div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>startEdit(rule)} style={{ background:'#334155', border:'none', color:'#94a3b8', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}><Edit2 size={14}/></button>
                  <button onClick={()=>del(rule.id)} style={{ background:'#450a0a', border:'none', color:'#ef4444', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}
