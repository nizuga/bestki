import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDecksStore } from '@/store/useDecksStore';
import { supabase } from '@/lib/supabase';
import { validateImportPayload, type ImportError, type ImportCard } from '@/lib/cardImport';
import { buildAIPrompt } from '@/lib/aiPrompt';
import Button from '@/components/ui/Button';
import type { Deck } from '@/types';

const NEW_DECK = '__new__';

const inputCls =
  'w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

export default function Import() {
  const { decks, fetchDecks } = useDecksStore();
  const navigate = useNavigate();

  const [deckSelRaw, setDeckSel] = useState<string>('');
  const deckSel = deckSelRaw || (decks[0]?.id ?? '');
  const [newDeckName, setNewDeckName] = useState('');
  const [topic, setTopic] = useState('');
  const [json, setJson] = useState('');
  const [validated, setValidated] = useState<ImportCard[] | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  function resetValidation() {
    setValidated(null);
    setErrors([]);
    setDone(null);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(buildAIPrompt(topic));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleValidate() {
    resetValidation();
    const result = validateImportPayload(json);
    if (result.ok) setValidated(result.cards);
    else setErrors(result.errors);
  }

  async function handleImport() {
    if (!validated || validated.length === 0) return;
    if (deckSel === NEW_DECK && !newDeckName.trim()) return;

    setImporting(true);
    try {
      let deckId = deckSel;

      if (deckSel === NEW_DECK) {
        const { data, error } = await supabase
          .from('decks')
          .insert({ name: newDeckName.trim(), color: '#534AB7', icon: '📚' })
          .select()
          .single();
        if (error || !data) throw new Error(error?.message ?? 'Error al crear el mazo');
        deckId = (data as Deck).id;
        await fetchDecks();
      }

      const payload = validated.map((c) => ({
        deck_id: deckId,
        type: c.type,
        question: c.question,
        content: c.content,
        explanation: c.explanation ?? null,
      }));

      const { error } = await supabase.from('cards').insert(payload);
      if (error) throw new Error(error.message);

      setDone(
        `${validated.length} tarjeta${validated.length === 1 ? '' : 's'} importada${validated.length === 1 ? '' : 's'}`,
      );
      setJson('');
      setValidated(null);
    } catch (e) {
      setErrors([{ index: -1, field: 'supabase', message: (e as Error).message }]);
    } finally {
      setImporting(false);
    }
  }

  const canImport =
    validated !== null &&
    validated.length > 0 &&
    deckSel !== '' &&
    (deckSel !== NEW_DECK || newDeckName.trim().length > 0);

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
        >
          ← Atrás
        </button>
        <h1 className="text-2xl font-semibold">Importar JSON</h1>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Genera tarjetas con IA y pégalas aquí en JSON. Útil para crear muchas tarjetas de golpe.
      </p>

      {/* Paso 1: tema y prompt */}
      <div className="bg-white dark:bg-white/5 rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-sm font-medium">1. Pídele a la IA que genere tarjetas</p>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Tema (opcional, ej: Git avanzado)"
          className={inputCls}
        />
        <Button onClick={copyPrompt} variant="ghost" className="w-full">
          {copied ? '✓ Prompt copiado' : '📋 Copiar prompt para IA'}
        </Button>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Pega el prompt en Claude o ChatGPT y copia su respuesta JSON.
        </p>
      </div>

      {/* Paso 2: deck destino */}
      <div className="bg-white dark:bg-white/5 rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-sm font-medium">2. ¿A qué mazo van?</p>
        <select value={deckSel} onChange={(e) => setDeckSel(e.target.value)} className={inputCls}>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.icon ?? '📚'} {d.name}
            </option>
          ))}
          <option value={NEW_DECK}>+ Crear mazo nuevo</option>
        </select>
        {deckSel === NEW_DECK && (
          <input
            type="text"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            placeholder="Nombre del nuevo mazo"
            className={inputCls}
            autoFocus
          />
        )}
      </div>

      {/* Paso 3: pegar JSON */}
      <div className="bg-white dark:bg-white/5 rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-sm font-medium">3. Pega el JSON</p>
        <textarea
          value={json}
          onChange={(e) => {
            setJson(e.target.value);
            resetValidation();
          }}
          placeholder='{ "cards": [ ... ] }'
          rows={10}
          className={`${inputCls} font-mono text-xs`}
          spellCheck={false}
        />
        <Button onClick={handleValidate} variant="ghost" disabled={!json.trim()} className="w-full">
          Validar
        </Button>
      </div>

      {/* Resultado validación */}
      {validated && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl px-4 py-3 text-sm text-green-800 dark:text-green-200">
          ✓ {validated.length} tarjeta{validated.length === 1 ? '' : 's'} lista
          {validated.length === 1 ? '' : 's'} para importar
        </div>
      )}

      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl px-4 py-3 text-sm text-red-800 dark:text-red-200 space-y-1">
          <p className="font-medium mb-1">Errores ({errors.length}):</p>
          <ul className="space-y-0.5 max-h-60 overflow-y-auto text-xs font-mono">
            {errors.map((e, i) => (
              <li key={i}>
                {e.index >= 0 ? `[#${e.index}] ` : ''}
                <span className="font-semibold">{e.field}</span>: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {done && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl px-4 py-3 text-sm text-green-800 dark:text-green-200">
          ✓ {done}
        </div>
      )}

      {/* Importar */}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={() => navigate('/decks')} className="flex-1">
          Cerrar
        </Button>
        <Button onClick={handleImport} disabled={!canImport || importing} className="flex-1">
          {importing ? 'Importando…' : 'Importar'}
        </Button>
      </div>
    </section>
  );
}
