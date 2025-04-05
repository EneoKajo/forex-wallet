import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './views/login';
import Register from './views/register';
import Home from './views/home';
import Sidebar from './components/Sidebar';
import './App.css';
import './styles/Layout.css';
import Wallet from './views/wallet';

function App() {
  const isAuthenticated = () => {
    return localStorage.getItem('token') !== null;
  };

  const ProtectedRoute = ({ children }) => {
    return isAuthenticated() ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <>
                <Sidebar />
                <div className="main-content">
                  <Home />
                </div>
              </>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/wallet" 
          element={
            <ProtectedRoute>
              <>
                <Sidebar />
                <div className="main-content">
                  <Wallet />
                </div>
              </>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <>
                <Sidebar />
                <div className="main-content">
                  <h1>Profile Page</h1>
                  <p>Your profile information will be displayed here.</p>
                </div>
              </>
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;