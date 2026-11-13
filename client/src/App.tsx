import { useEffect } from 'react'; import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api } from './lib/api'; import { useAuth } from './store/auth'; import { useUI } from './store/ui'; import Login from './pages/Login'; import Shell from './pages/Shell'; import { Toasts } from './components/Modal';
const Protected = ({ children }: { children: JSX.Element }) => useAuth(s => s.user) ? children : <Navigate to="/login" replace />;
function Join() { const { code } = useParams(); const nav = useNavigate(); const toast = useUI(s => s.toast);
  useEffect(() => { api(`/groups/join/${code}`, { method: 'POST', body: {} }).then(r => toast(`Joined ${r.name}`, 'success')).catch(e => toast(e.message, 'error')).finally(() => nav('/', { replace: true })); }, [code]); return null; }
export default function App() {
  useEffect(() => { useAuth.getState().applyFrom(useAuth.getState().user); }, []);
  return (<BrowserRouter><Routes><Route path="/login" element={<><Login /><Toasts /></>} /><Route path="/join/:code" element={<Protected><><Join /><Toasts /></></Protected>} /><Route path="/*" element={<Protected><Shell /></Protected>} /></Routes></BrowserRouter>);
}
