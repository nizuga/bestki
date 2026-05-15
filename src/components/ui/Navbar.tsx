import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Inicio' },
  { to: '/decks', label: 'Mazos' },
  { to: '/stats', label: 'Stats' },
  { to: '/settings', label: 'Config' },
];

export default function Navbar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-black/10 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-neutral-900/95 pb-safe">
      <ul className="mx-auto flex max-w-md">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex h-16 items-center justify-center text-sm font-medium transition-colors ${
                  isActive ? 'text-primary' : 'opacity-60 hover:opacity-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
