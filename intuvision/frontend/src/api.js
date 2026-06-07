// v1780854282
import axios from 'axios';
const BASE = process.env.REACT_APP_API_URL || 'https://intuvizion.onrender.com';
const api = axios.create({ baseURL: BASE });

export const getRules    = ()       => api.get('/api/rules').then(r=>r.data);
export const createRule  = (data)   => api.post('/api/rules', data).then(r=>r.data);
export const deleteRule  = (id)     => api.delete(`/api/rules/${id}`).then(r=>r.data);
export const updateRule  = (id,data)=> api.put(`/api/rules/${id}`, data).then(r=>r.data);

export const getVideos   = ()       => api.get('/api/videos').then(r=>r.data);
export const uploadVideo = (form)   => api.post('/api/videos', form, {headers:{'Content-Type':'multipart/form-data'}}).then(r=>r.data);
export const deleteVideo = (id)     => api.delete(`/api/videos/${id}`).then(r=>r.data);

export const startAnalysis = (data) => api.post('/api/analyze', data).then(r=>r.data);
export const getJob      = (id)     => api.get(`/api/jobs/${id}`).then(r=>r.data);
export const listJobs    = ()       => api.get('/api/jobs').then(r=>r.data);

export const getAlerts   = (params) => api.get('/api/alerts', {params}).then(r=>r.data);
export const deleteAlert = (id)     => api.delete(`/api/alerts/${id}`).then(r=>r.data);
export const clearAlerts = (params) => api.delete('/api/alerts', {params}).then(r=>r.data);

export const getStats    = ()       => api.get('/api/stats').then(r=>r.data);

export const snapshotUrl = (alertId) => `${BASE}/api/media/snapshot/${alertId}`;
export const clipUrl     = (alertId) => `${BASE}/api/media/clip/${alertId}`;
