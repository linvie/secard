import { BrowserRouter, Routes, Route, useParams, Link } from 'react-router-dom';
import CardFeed from './pages/CardFeed';
import NewCard from './pages/NewCard';
import './App.css';

function CardDetailPlaceholder() {
  const { id } = useParams();
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px' }}>
      <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>← 返回</Link>
      <p style={{ marginTop: 24, color: 'var(--text)' }}>卡片 #{id} 详情页（待实现）</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CardFeed />} />
        <Route path="/new" element={<NewCard />} />
        <Route path="/cards/:id" element={<CardDetailPlaceholder />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
