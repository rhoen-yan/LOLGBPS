import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }) =>
  [
    'px-3 py-1.5 rounded-lg text-sm font-semibold transition',
    isActive
      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent',
  ].join(' ');

export default function AppNav() {
  return (
    <nav className="flex gap-2 mb-6">
      <NavLink to="/" end className={linkClass}>
        模擬器
      </NavLink>
      <NavLink to="/analytics" className={linkClass}>
        分析
      </NavLink>
      <NavLink to="/settings" className={linkClass}>
        設置
      </NavLink>
    </nav>
  );
}
