import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CardFeed from './pages/CardFeed';
import NewCard from './pages/NewCard';
import CardDetail from './pages/CardDetail';
import Settings from './pages/Settings';
import WorkDetail from './pages/WorkDetail';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CardFeed />} />
        <Route path="/new" element={<NewCard />} />
        <Route path="/cards/:id" element={<CardDetail />} />
        <Route path="/works/:id" element={<WorkDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
