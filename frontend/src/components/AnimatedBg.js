import React, { Children } from 'react';
import '../styles/background.css';

const AnimatedBg = ({ children }) => {
    return (
        <>
        <div className="animated-background"></div>
        <div className="auth-container">{children}</div>
        </>
    )
}

export default AnimatedBg;
