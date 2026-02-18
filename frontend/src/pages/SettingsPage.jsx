// Fichier: frontend/src/pages/SettingsPage.jsx
import React, { useState } from 'react';
import { User, Lock, Bell, Palette, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useStadiumZone } from '../context/BackgroundContext';
import PageTransition from '../components/layout/PageTransition';

const SettingsPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('profile');
    const [saving, setSaving] = useState(false);

    // Profile settings
    const [username, setUsername] = useState(user?.username || '');
    const [email, setEmail] = useState(user?.email || '');

    // Password settings
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Notification settings
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [tournamentReminders, setTournamentReminders] = useState(true);

    // Activer la zone du stade
    useStadiumZone('locker-room');

    const handleSaveProfile = async () => {
        setSaving(true);
        // Simulate API call
        setTimeout(() => {
            toast({ title: 'Succès', description: 'Profil mis à jour avec succès.' });
            setSaving(false);
        }, 1000);
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            toast({ title: 'Erreur', description: 'Les mots de passe ne correspondent pas.', variant: 'destructive' });
            return;
        }
        setSaving(true);
        // Simulate API call
        setTimeout(() => {
            toast({ title: 'Succès', description: 'Mot de passe modifié avec succès.' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setSaving(false);
        }, 1000);
    };

    const handleSaveNotifications = async () => {
        setSaving(true);
        // Simulate API call
        setTimeout(() => {
            toast({ title: 'Succès', description: 'Préférences de notification mises à jour.' });
            setSaving(false);
        }, 1000);
    };

    const tabs = [
        { id: 'profile', label: 'Profil', icon: User },
        { id: 'security', label: 'Sécurité', icon: Lock },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'appearance', label: 'Apparence', icon: Palette },
    ];

    return (
        <PageTransition>
            <div className="space-y-8">
                {/* HEADER */}
                <motion.div
                    className="FM-header-banner"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <User className="w-8 h-8 text-blue-400" />
                            <h1 className="text-4xl font-bold text-white">Paramètres</h1>
                        </div>
                        <p className="text-zinc-400">Gérez votre compte et vos préférences</p>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* SIDEBAR TABS */}
                    <div className="lg:col-span-1">
                        <div className="FM-card p-4 space-y-2">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab.id
                                            ? 'bg-blue-500/10 text-blue-400 border-l-3 border-blue-400'
                                            : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                                            }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="font-medium">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* CONTENT */}
                    <div className="lg:col-span-3">
                        <motion.div
                            key={activeTab}
                            className="FM-card p-8"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* PROFILE TAB */}
                            {activeTab === 'profile' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-2">Informations du Profil</h2>
                                        <p className="text-zinc-400 text-sm">Mettez à jour vos informations personnelles</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <Label htmlFor="username" className="EF-label">Nom d'utilisateur</Label>
                                            <Input
                                                id="username"
                                                type="text"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                className="EF-input"
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="email" className="EF-label">Email</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="EF-input"
                                            />
                                        </div>

                                        <div>
                                            <Label className="EF-label">Rôle</Label>
                                            <div className="px-4 py-3 bg-[#141414] rounded-xl border border-white/5">
                                                <span className="text-white font-medium">
                                                    {user?.role === 'super_admin' ? 'Super Administrateur' : 'Organisateur'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <Button onClick={handleSaveProfile} disabled={saving} className="FM-btn-primary">
                                        {saving ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />}
                                        Enregistrer les modifications
                                    </Button>
                                </div>
                            )}

                            {/* SECURITY TAB */}
                            {activeTab === 'security' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-2">Sécurité</h2>
                                        <p className="text-zinc-400 text-sm">Modifiez votre mot de passe</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <Label htmlFor="current-password" className="EF-label">Mot de passe actuel</Label>
                                            <Input
                                                id="current-password"
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="EF-input"
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="new-password" className="EF-label">Nouveau mot de passe</Label>
                                            <Input
                                                id="new-password"
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="EF-input"
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="confirm-password" className="EF-label">Confirmer le mot de passe</Label>
                                            <Input
                                                id="confirm-password"
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="EF-input"
                                            />
                                        </div>
                                    </div>

                                    <Button onClick={handleChangePassword} disabled={saving} className="FM-btn-primary">
                                        {saving ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Lock className="mr-2 h-5 w-5" />}
                                        Changer le mot de passe
                                    </Button>
                                </div>
                            )}

                            {/* NOTIFICATIONS TAB */}
                            {activeTab === 'notifications' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-2">Notifications</h2>
                                        <p className="text-zinc-400 text-sm">Gérez vos préférences de notification</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-[#141414] rounded-xl border border-white/5">
                                            <div>
                                                <p className="text-white font-medium">Notifications par email</p>
                                                <p className="text-zinc-400 text-sm">Recevoir des emails pour les mises à jour importantes</p>
                                            </div>
                                            <button
                                                onClick={() => setEmailNotifications(!emailNotifications)}
                                                className={`relative w-12 h-6 rounded-full transition-colors ${emailNotifications ? 'bg-blue-500' : 'bg-zinc-700'
                                                    }`}
                                            >
                                                <span
                                                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${emailNotifications ? 'translate-x-6' : ''
                                                        }`}
                                                />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-[#141414] rounded-xl border border-white/5">
                                            <div>
                                                <p className="text-white font-medium">Rappels de tournoi</p>
                                                <p className="text-zinc-400 text-sm">Recevoir des rappels avant les tournois</p>
                                            </div>
                                            <button
                                                onClick={() => setTournamentReminders(!tournamentReminders)}
                                                className={`relative w-12 h-6 rounded-full transition-colors ${tournamentReminders ? 'bg-blue-500' : 'bg-zinc-700'
                                                    }`}
                                            >
                                                <span
                                                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${tournamentReminders ? 'translate-x-6' : ''
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    <Button onClick={handleSaveNotifications} disabled={saving} className="FM-btn-primary">
                                        {saving ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />}
                                        Enregistrer les préférences
                                    </Button>
                                </div>
                            )}

                            {/* APPEARANCE TAB */}
                            {activeTab === 'appearance' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-2">Apparence</h2>
                                        <p className="text-zinc-400 text-sm">Personnalisez l'apparence de l'application</p>
                                    </div>

                                    <div className="p-6 bg-[#141414] rounded-xl border border-white/5 text-center">
                                        <Palette className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                                        <p className="text-white font-semibold mb-2">Thème Football Manager</p>
                                        <p className="text-zinc-400 text-sm">Le thème actuel est optimisé pour une expérience professionnelle</p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default SettingsPage;
