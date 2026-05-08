import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Theme = 'light' | 'dark' | 'system';

// ── Helpers ───────────────────────────────────────────────────────────────────
function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', useDark);
  localStorage.setItem('theme', theme);
}

async function saveSetting(key: string, value: unknown) {
  await supabase.from('settings').upsert({ key, value });
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl overflow-hidden shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4 pb-2">
        {title}
      </p>
      <div className="divide-y divide-gray-100 dark:divide-white/10">{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min = 1,
  max = 50,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-center text-lg disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-center text-lg disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
      >
        +
      </button>
    </div>
  );
}

function ThemeSelector({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  const options: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Claro', icon: '☀️' },
    { value: 'system', label: 'Sistema', icon: '💻' },
    { value: 'dark', label: 'Oscuro', icon: '🌙' },
  ];
  return (
    <div className="flex gap-1 bg-gray-100 dark:bg-white/10 rounded-xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === o.value
              ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span>{o.icon}</span>
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') ?? 'system') as Theme,
  );
  const [minCards, setMinCards] = useState(10);
  const [maxFreezes, setMaxFreezes] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase
      .from('settings')
      .select('*')
      .in('key', ['streak_min_cards', 'streak_freezes_per_month'])
      .then(({ data }) => {
        for (const row of data ?? []) {
          if (row.key === 'streak_min_cards') setMinCards(Number(row.value));
          if (row.key === 'streak_freezes_per_month') setMaxFreezes(Number(row.value));
        }
        setLoading(false);
      });
  }, []);

  function handleTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
    saveSetting('theme', t);
    flash();
  }

  async function handleMinCards(v: number) {
    setMinCards(v);
    await saveSetting('streak_min_cards', v);
    flash();
  }

  async function handleMaxFreezes(v: number) {
    setMaxFreezes(v);
    await saveSetting('streak_freezes_per_month', v);
    flash();
  }

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <section className="space-y-5 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Configuración</h1>
        {saved && <span className="text-xs text-green-500 font-medium">✓ Guardado</span>}
      </div>

      <Section title="Apariencia">
        <SettingRow label="Tema" sub="Afecta toda la aplicación">
          <ThemeSelector value={theme} onChange={handleTheme} />
        </SettingRow>
      </Section>

      <Section title="Racha">
        <SettingRow
          label="Mínimo de tarjetas"
          sub="Revisiones diarias para contar como día de racha"
        >
          <Stepper value={minCards} onChange={handleMinCards} min={1} max={50} />
        </SettingRow>
        <SettingRow label="Congeladas por mes" sub="Días de pausa disponibles sin romper la racha">
          <Stepper value={maxFreezes} onChange={handleMaxFreezes} min={0} max={10} />
        </SettingRow>
      </Section>

      <Section title="Información">
        <SettingRow label="Versión" sub="Bestki">
          <span className="text-xs text-gray-400 font-mono">0.1.0</span>
        </SettingRow>
      </Section>
    </section>
  );
}
