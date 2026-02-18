import React from 'react';
import { motion } from 'framer-motion';

const PageTransition = ({ children }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            transition={{
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1], // Custom cubic-bezier for "swift" feel
                delay: 0.1
            }}
            className="w-full min-h-screen relative z-10"
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;
