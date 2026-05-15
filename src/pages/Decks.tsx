import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDecksStore } from '@/store/useDecksStore';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import type { Deck } from '@/types';

const PRESET_COLORS = [
  '#534AB7',
  '#1D9E75',
  '#D85A30',
  '#2563EB',
  '#DB2777',
  '#D97706',
  '#059669',
  '#7C3AED',
];

const DEFAULT_ICONS = ['📚', '💻', '⚗️', '🔬', '🌍', '🎵', '📐', '🏛️'];

interface DeckFormState {
  name: string;
  description: string;
  color: string;
  icon: string;
}

const EMPTY_FORM: DeckFormState = { name: '', description: '', color: '#534AB7', icon: '📚' };

export default function Decks() {
  const { decks, loading, error, fetchDecks, createDeck, updateDeck, deleteDeck } = useDecksStore();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Deck | null>(null);
  const [form, setForm] = useState<DeckFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(deck: Deck) {
    setEditing(deck);
    setForm({
      name: deck.name,
      description: deck.description ?? '',
      color: deck.color,
      icon: deck.icon ?? '📚',
    });
    setModalOpen(true);
    setMenuOpen(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este mazo y todas sus tarjetas?')) return;
    await deleteDeck(id);
    setMenuOpen(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const input = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color,
      icon: form.icon,
    };
    if (editing) {
      await updateDeck(editing.id, input);
    } else {
      await createDeck(input);
    }
    setSaving(false);
    setModalOpen(false);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-semibold">Mis mazos</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/import')} size="sm" variant="ghost">
            📥 Importar
          </Button>
          <Button onClick={openCreate} size="sm">
            + Nuevo
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-4 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && decks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-3">📭</p>
          <p className="font-medium">No tienes mazos aún</p>
          <p className="text-sm mt-1">Crea tu primer mazo para empezar a estudiar</p>
          <Button onClick={openCreate} className="mt-5">
            Crear primer mazo
          </Button>
        </div>
      )}

      {!loading && decks.length > 0 && (
        <ul className="space-y-3">
          {decks.map((deck) => (
            <li key={deck.id} className="relative">
              <button
                className="w-full text-left flex items-center gap-4 bg-white dark:bg-white/5 rounded-2xl px-4 py-4 shadow-sm hover:shadow-md transition-shadow"
                onClick={() => navigate(`/study?deck=${deck.id}`)}
                style={{ borderLeft: `4px solid ${deck.color}` }}
              >
                <span className="text-2xl">{deck.icon ?? '📚'}</span>
                <div className="flex-1 min-w-0 pr-8">
                  <p className="font-semibold truncate">{deck.name}</p>
                  {deck.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {deck.description}
                    </p>
                  )}
                </div>
              </button>

              <div className="absolute top-3 right-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(menuOpen === deck.id ? null : deck.id);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 text-lg"
                >
                  ⋯
                </button>
                {menuOpen === deck.id && (
                  <div className="absolute right-0 top-9 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-lg py-1 z-10 min-w-[140px]">
                    <button
                      onClick={() => {
                        setMenuOpen(null);
                        navigate(`/decks/${deck.id}/cards/new`);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/10"
                    >
                      + Nueva tarjeta
                    </button>
                    <button
                      onClick={() => openEdit(deck)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/10"
                    >
                      Editar mazo
                    </button>
                    <button
                      onClick={() => handleDelete(deck.id)}
                      className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-0" onClick={() => setMenuOpen(null)} aria-hidden />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar mazo' : 'Nuevo mazo'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Git avanzado"
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Descripción (opcional)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ej: Comandos avanzados de Git"
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Ícono</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {DEFAULT_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, icon: emoji }))}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center border-2 transition-colors ${
                    form.icon === emoji
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-transparent hover:border-gray-200 dark:hover:border-white/20'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="O escribe un emoji"
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              maxLength={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color }))}
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: form.color === color ? 'white' : 'transparent',
                    boxShadow: form.color === color ? `0 0 0 2px ${color}` : undefined,
                  }}
                  aria-label={color}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={saving || !form.name.trim()}>
              {saving ? 'Guardando…' : editing ? 'Guardar' : 'Crear mazo'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
