// Fichier: frontend/src/components/StadiumBackground.jsx
import React from 'react';
import { motion } from 'framer-motion';

/**
 * Composant wrapper qui applique un background de stade avec overlay
 * @param {string} zone - Nom de la zone du stade (exterior, entrance, locker-room, etc.)
 * @param {ReactNode} children - Contenu de la page
 * @param {number} overlayOpacity - Opacité de l'overlay sombre (0-1), défaut 0.85
 */
const StadiumBackground = ({ zone, children, overlayOpacity = 0.85 }) => {
    const backgroundImages = {
        'exterior': '/backgrounds/stadium-exterior.jpg',
        'entrance': '/backgrounds/stadium-entrance.jpg',
        'locker-room': '/backgrounds/locker-room.jpg',
        'tactical-room': '/backgrounds/tactical-room.jpg',
        'player-tunnel': '/backgrounds/player-tunnel.jpg',
        'pitch-warmup': '/backgrounds/pitch-warmup.jpg',
        'pitch-match': '/backgrounds/pitch-match.jpg',
        'pitch-final': '/backgrounds/pitch-final.jpg',
        'victory-podium': '/backgrounds/victory-podium.jpg',
    };

    const backgroundImage = backgroundImages[zone] || backgroundImages['exterior'];

    return (
        <div className="relative min-h-screen w-full overflow-hidden">
            {/* Background Image avec Parallax */}
            <motion.div
                className="fixed inset-0 z-0"
                initial={{ scale: 1.1, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{
                    backgroundImage: `url(${backgroundImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                }}
            />

            {/* Overlay sombre pour lisibilité */}
            <div
                className="fixed inset-0 z-10 bg-black"
                style={{ opacity: overlayOpacity }}
            />

            {/* Contenu de la page */}
            <div className="relative z-20">
                {children}
            </div>
        </div>
    );
};

export default StadiumBackground;
