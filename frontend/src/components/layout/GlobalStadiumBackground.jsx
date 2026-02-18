import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackground } from '../../context/BackgroundContext';

// Ordre des zones pour déterminer la direction du slide
const ZONE_ORDER = [
    'exterior',
    'entrance',
    'player-tunnel',
    'locker-room',
    'tactical-room',
    'pitch-warmup',
    'pitch-match',
    'pitch-final',
    'victory-podium',
];

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

const GlobalStadiumBackground = ({ overlayOpacity = 0.82 }) => {
    const { currentZone, previousZone } = useBackground();

    const backgroundImage = backgroundImages[currentZone] || backgroundImages['exterior'];

    // Calculer la direction du slide selon l'ordre des zones
    const currentIndex = ZONE_ORDER.indexOf(currentZone);
    const previousIndex = ZONE_ORDER.indexOf(previousZone || currentZone);
    const direction = currentIndex >= previousIndex ? 1 : -1;

    // Effet "tourner la tête" : slide horizontal lent, comme un panoramique de caméra
    const variants = {
        enter: (dir) => ({
            x: dir > 0 ? '8%' : '-8%',
            opacity: 0,
            scale: 1.05,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
        },
        exit: (dir) => ({
            x: dir > 0 ? '-8%' : '8%',
            opacity: 0,
            scale: 0.98,
        }),
    };

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-black">
            <AnimatePresence initial={false} custom={direction} mode="crossfade">
                <motion.div
                    key={currentZone}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                        duration: 1.0,
                        ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quart, fluide et naturel
                    }}
                    className="absolute inset-0"
                >
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${backgroundImage})` }}
                    />
                    {/* Dark Overlay */}
                    <div
                        className="absolute inset-0 bg-black"
                        style={{ opacity: overlayOpacity }}
                    />
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default GlobalStadiumBackground;
