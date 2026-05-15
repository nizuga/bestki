import { Routes, Route } from 'react-router-dom';
import Navbar from '@/components/ui/Navbar';
import Home from '@/pages/Home';
import Decks from '@/pages/Decks';
import Study from '@/pages/Study';
import CardEditor from '@/pages/CardEditor';
import Import from '@/pages/Import';
import Stats from '@/pages/Stats';
import SettingsPage from '@/pages/Settings';

export default function App() {
  return (
    <div className="min-h-screen pb-20">
      <main className="mx-auto max-w-md px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/decks" element={<Decks />} />
          <Route path="/study" element={<Study />} />
          <Route path="/decks/:deckId/cards/new" element={<CardEditor />} />
          <Route path="/cards/:cardId/edit" element={<CardEditor />} />
          <Route path="/import" element={<Import />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <Navbar />
    </div>
  );
}
