import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Trophy, Users, LayoutDashboard, Settings, LogOut, PlusCircle, Shield } from 'lucide-react';

const DashboardLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const isAdmin = user?.role === 'super_admin';

    return (
        <div className="min-h-screen font-sans flex flex-col">
            {/* TOPBAR */}
            <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
                    {/* Left: Title + Badge */}
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-300 to-blue-500 flex items-center justify-center flex-shrink-0">
                            <span className="font-bold text-black text-sm">FC</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-white font-bold text-base leading-none">Tableau de Bord</span>
                                {isAdmin && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500 text-white leading-none">
                                        Super Admin
                                    </span>
                                )}
                            </div>
                            <p className="text-zinc-500 text-xs mt-0.5">Bienvenue, {user?.username}</p>
                        </div>
                    </div>

                    {/* Right: Nav + Actions */}
                    <nav className="flex items-center gap-1">
                        <NavLink
                            to="/dashboard"
                            end
                            className={({ isActive }) =>
                                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive
                                    ? 'bg-white/10 text-white'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`
                            }
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            <span className="hidden sm:inline">Dashboard</span>
                        </NavLink>

                        <NavLink
                            to="/tournaments"
                            className={({ isActive }) =>
                                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive
                                    ? 'bg-white/10 text-white'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`
                            }
                        >
                            <Trophy className="w-4 h-4" />
                            <span className="hidden sm:inline">Tournois</span>
                        </NavLink>

                        <NavLink
                            to="/players"
                            className={({ isActive }) =>
                                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive
                                    ? 'bg-white/10 text-white'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`
                            }
                        >
                            <Users className="w-4 h-4" />
                            <span className="hidden sm:inline">Joueurs</span>
                        </NavLink>

                        {isAdmin && (
                            <NavLink
                                to="/admin"
                                className={({ isActive }) =>
                                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive
                                        ? 'bg-white/10 text-white'
                                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                    }`
                                }
                            >
                                <Shield className="w-4 h-4" />
                                <span className="hidden sm:inline">Administration</span>
                            </NavLink>
                        )}

                        <NavLink
                            to="/settings"
                            className={({ isActive }) =>
                                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive
                                    ? 'bg-white/10 text-white'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`
                            }
                        >
                            <Settings className="w-4 h-4" />
                            <span className="hidden sm:inline">Mon Profil</span>
                        </NavLink>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Déconnexion</span>
                        </button>

                        <button
                            onClick={() => navigate('/create-tournament')}
                            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                        >
                            <PlusCircle className="w-4 h-4" />
                            <span>Créer un tournoi</span>
                        </button>
                    </nav>
                </div>
            </header>

            {/* PAGE CONTENT */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
                <Outlet />
            </main>
        </div>
    );
};

export default DashboardLayout;
