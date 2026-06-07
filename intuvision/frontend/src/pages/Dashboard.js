import React, { useEffect, useState } from 'react';
import { getStats, getAlerts } from '../api';
import { AlertTriangle, Shield, Video, List } from 'lucide-react';

const SEV_COLOR = { critical:'#ef4444', high:'#f97316', medium:'#eab308', low:'#22c55e' };
const SEV_BG    = { critical:'#450a0a', high:'#431407', medium:'#422006', low:'#052e16' };

function StatCard({ icon: Icon, label, value, color='#6366f1', sub }) {
  return (
    <div style={{ background:'#1e293b', borderRadius:12, padding:'20px 24px', border:'1px solid #334155' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
        <div style={{ background:`${color}22`, borderRadius:8, padding:8 }}>
          <Icon size={20} color={color} />
        </div>
        <span style={{ color:'#94a3b8', fontSize:13 }}>{label}</span>
      </div>
      <div style={{ fontSize:32, fontWeight:700, color:'#f1f5f9' }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard({ setPage }) {
  const [stats, setStats] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);

  useEffect(() => {
    getStats().then(setStats).catch(()=>{});
    getAlerts().then(a => setRecentAlerts(a.slice(0,5))).catch(()=>{});
  }, []);

  const sev = stats?.severity_breakdown || {};

  return (
    <div style={{ padding:32 }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:24, fontWeight:700, color:'#f1f5f9', margin:0 }}>Control Tower</h1>
        <p style={{ color:'#64748b', margin:'6px 0 0', fontSize:14 }}>Video intelligence overview</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <StatCard icon={Shield}        label="Total Alerts"  value={stats?.total_alerts ?? '—'}  color="#6366f1" />
        <StatCard icon={List}          label="Active Rules"  value={stats?.total_rules ?? '—'}   color="#8b5cf6" />
        <StatCard icon={Video}         label="Videos"        value={stats?.total_videos ?? '—'}  color="#06b6d4" />
        <StatCard icon={AlertTriangle} label="Critical"      value={sev.critical ?? 0}           color="#ef4444" />
      </div>

      {/* Severity breakdown */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:28 }}>
        <div style={{ background:'#1e293b', borderRadius:12, padding:24, border:'1px solid #334155' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:600, color:'#e2e8f0' }}>Severity Breakdown</h3>
          {Object.entries(sev).map(([k,v]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:SEV_COLOR[k] }} />
              <span style={{ flex:1, color:'#94a3b8', fontSize:13, textTransform:'capitalize' }}>{k}</span>
              <div style={{ background:SEV_BG[k], color:SEV_COLOR[k], borderRadius:6, padding:'2px 10px', fontSize:12, fontWeight:600 }}>{v}</div>
            </div>
          ))}
          {!stats && <div style={{ color:'#475569', fontSize:13 }}>Loading...</div>}
        </div>

        <div style={{ background:'#1e293b', borderRadius:12, padding:24, border:'1px solid #334155' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:600, color:'#e2e8f0' }}>Alerts by Rule</h3>
          {stats?.alerts_by_rule && Object.entries(stats.alerts_by_rule).length > 0
            ? Object.entries(stats.alerts_by_rule).slice(0,5).map(([rule,count]) => (
                <div key={rule} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ flex:1, color:'#94a3b8', fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{rule}</span>
                  <div style={{ background:'#312e81', color:'#a5b4fc', borderRadius:6, padding:'2px 10px', fontSize:12, fontWeight:600 }}>{count}</div>
                </div>
              ))
            : <div style={{ color:'#475569', fontSize:13 }}>No alerts yet. Run your first analysis.</div>
          }
        </div>
      </div>

      {/* Recent alerts */}
      <div style={{ background:'#1e293b', borderRadius:12, padding:24, border:'1px solid #334155' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:600, color:'#e2e8f0' }}>Recent Alerts</h3>
          <button onClick={() => setPage('alerts')} style={{ background:'none', border:'1px solid #334155', color:'#94a3b8', borderRadius:6, padding:'4px 12px', cursor:'pointer', fontSize:12 }}>
            View all
          </button>
        </div>
        {recentAlerts.length === 0
          ? <div style={{ color:'#475569', fontSize:13 }}>No alerts yet. Upload a video and run analysis.</div>
          : recentAlerts.map(a => (
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #1e293b' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:SEV_COLOR[a.severity]||'#6366f1', flexShrink:0 }} />
                <div style={{ flex:1, overflow:'hidden' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.rule_name}</div>
                  <div style={{ fontSize:12, color:'#64748b' }}>{a.video_label} · {a.start_time}s–{a.end_time}s</div>
                </div>
                <div style={{ fontSize:11, color:SEV_COLOR[a.severity], background:SEV_BG[a.severity], padding:'2px 8px', borderRadius:5, fontWeight:600, textTransform:'uppercase' }}>{a.severity}</div>
              </div>
            ))
        }
      </div>
    </div>
  );
}
