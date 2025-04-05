import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ProfileModal from './ProfileModal';
import '../styles/Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const openProfileModal = () => {
    setIsProfileModalOpen(true);
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <>
      <div className="mobile-navbar">
        <div className="mobile-logo">ForexTracker</div>
        <button className="menu-toggle" onClick={toggleMobileMenu}>
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      <div className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">FX</div>
        
        <div className="sidebar-menu">
          <Link 
            to="/" 
            className={`sidebar-item ${isActive('/') ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div className="sidebar-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
            <span className="sidebar-text">Home</span>
          </Link>
          
          <Link 
            to="/wallet" 
            className={`sidebar-item ${isActive('/wallet') ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div className="sidebar-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <circle cx="12" cy="12" r="2"></circle>
                <path d="M16 8v8"></path>
                <path d="M8 8v8"></path>
              </svg>
            </div>
            <span className="sidebar-text">Wallet</span>
          </Link>
        </div>
        
        <div className="sidebar-footer">
          <button 
            className={`sidebar-item`}
            onClick={openProfileModal}
          >
            <div className="sidebar-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <span className="sidebar-text">Profile</span>
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={closeProfileModal} 
      />
    </>
  );
};

export default Sidebar;