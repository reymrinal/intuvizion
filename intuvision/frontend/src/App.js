import React, { useState } from 'react';
import { Shield, Video, Bell, BarChart2, List, Play } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Rules from './pages/Rules';
import Videos from './pages/Videos';
import Alerts from './pages/Alerts';
import Analyze from './pages/Analyze';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
  { id: 'rules',     label: 'Rules',     icon: List },
  { id: 'videos',    label: 'Videos',    icon: Video },
  { id: 'analyze',   label: 'Analyze',   icon: Play },
  { id: 'alerts',    label: 'Alerts',    icon: Bell },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:'Inter,system-ui,sans-serif', background:'#0f172a', color:'#e2e8f0' }}>
      {/* Sidebar */}
      <div style={{ width:220, background:'#1e293b', display:'flex', flexDirection:'column', borderRight:'1px solid #334155' }}>
        <div style={{ padding:'24px 20px 16px', borderBottom:'1px solid #334155' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:10, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Shield size={20} color="white" />
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#f1f5f9' }}>IntuVision</div>
              <div style={{ fontSize:11, color:'#64748b' }}>AI Rules Engine</div>
            </div>
          </div>
        </div>
        <nav style={{ flex:1, padding:'12px 10px' }}>
          {NAV.map(n => {
            const Icon = n.icon;
            const active = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)}
                style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', borderRadius:8, border:'none', cursor:'pointer', marginBottom:4,
                  background: active ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent',
                  color: active ? 'white' : '#94a3b8', fontWeight: active ? 600 : 400, fontSize:14, transition:'all .2s' }}>
                <Icon size={18} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div style={{ padding:'16px 20px', borderTop:'1px solid #334155', fontSize:11, color:'#475569' }}>
          Powered by Gemini Vision AI
        </div>
      </div>
      {/* Main */}
      <div style={{ flex:1, overflow:'auto', background:'#0f172a' }}>
        {page === 'dashboard' && <Dashboard setPage={setPage} />}
        {page === 'rules'     && <Rules />}
        {page === 'videos'    && <Videos />}
        {page === 'analyze'   && <Analyze />}
        {page === 'alerts'    && <Alerts />}
      </div>
    </div>
  );
}
