import React, { createContext, useContext, useState, useRef } from 'react';

const BackgroundContext = createContext();

export const useBackground = () => {
    const context = useContext(BackgroundContext);
    if (!context) {
        throw new Error('useBackground must be used within a BackgroundProvider');
    }
    return context;
};

export const BackgroundProvider = ({ children }) => {
    const [currentZone, setCurrentZone] = useState('exterior');
    const [previousZone, setPreviousZone] = useState(null);

    const setZone = (zone) => {
        if (zone !== currentZone) {
            setPreviousZone(currentZone);
            setCurrentZone(zone);
        }
    };

    return (
        <BackgroundContext.Provider value={{ currentZone, previousZone, setZone }}>
            {children}
        </BackgroundContext.Provider>
    );
};

// Hook helper pour les pages
export const useStadiumZone = (zone) => {
    const { setZone } = useBackground();

    React.useEffect(() => {
        setZone(zone);
    }, [zone, setZone]);
};
