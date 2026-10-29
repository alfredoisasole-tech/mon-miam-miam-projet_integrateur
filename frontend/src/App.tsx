import { Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<h1>Mon Miam Miam</h1>} />
    </Routes>
  );
}