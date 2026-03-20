import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CardFeed from './pages/CardFeed';
import NewCard from './pages/NewCard';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CardFeed />} />
        <Route path="/new" element={<NewCard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
