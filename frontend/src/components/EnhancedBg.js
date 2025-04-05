import React, { useEffect, useState } from 'react';
import '../styles/bacground.css';
import '../styles/enhancedbg.css';

const EnhancedBg = ({ children }) => {
  const [activeGradient, setActiveGradient] = useState(0);
  const totalGradients = 4;
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveGradient((prev) => (prev + 1) % totalGradients);
    }, 8000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="enhanced-background">
        <div 
          className="gradient-layer gradient-1" 
          style={{ opacity: activeGradient === 0 ? 1 : 0 }}
        ></div>
        <div 
          className="gradient-layer gradient-2" 
          style={{ opacity: activeGradient === 1 ? 1 : 0 }}
        ></div>
        <div 
          className="gradient-layer gradient-3" 
          style={{ opacity: activeGradient === 2 ? 1 : 0 }}
        ></div>
        <div 
          className="gradient-layer gradient-4" 
          style={{ opacity: activeGradient === 3 ? 1 : 0 }}
        ></div>
      </div>
      <div className="auth-container">
        {children}
      </div>
    </>
  );
};

export default EnhancedBg;