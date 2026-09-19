import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Editor from './pages/Editor';
import Print from './pages/Print';
import ClassesPage from './pages/signup/ClassesPage';
import ClassDetailPage from './pages/signup/ClassDetailPage';
import RosterPage from './pages/signup/RosterPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="/print/:id" element={<Print />} />
        <Route path="/classes" element={<ClassesPage />} />
        <Route path="/classes/:id" element={<ClassDetailPage />} />
        <Route path="/classes/:id/roster" element={<RosterPage />} />
      </Routes>
    </HashRouter>
  );
}
