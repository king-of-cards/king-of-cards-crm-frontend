import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const linkClasses = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
  }`;

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#0c1220] text-slate-100">
      <header className="border-b border-white/10 bg-[#101827]/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <NavLink to="/" className="flex items-center gap-3" aria-label="King of Cards CRM home">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-300 text-lg font-black text-slate-950">K</span>
            <span>
              <span className="block text-sm font-semibold tracking-wide text-white">KING OF CARDS</span>
              <span className="block text-xs text-slate-400">Cross-Selling CRM · Beta</span>
            </span>
          </NavLink>

          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Main navigation" className="flex items-center gap-2">
              <NavLink to="/" end className={linkClasses}>Overview</NavLink>
              <NavLink to="/status" className={linkClasses}>Service status</NavLink>
            </nav>

            <span aria-hidden="true" className="mx-2 hidden h-6 w-px bg-white/10 sm:block" />

            {user && (
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">
                  {(user.name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-medium text-white">{user.name}</span>
                  <span className="block text-xs text-slate-400">{user.role}</span>
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="ml-1 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-7xl px-5 pb-8 text-xs text-slate-500 sm:px-8">
        Development environment · Synthetic data only
      </footer>
    </div>
  );
}