import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/ProfileModal.css';

const ProfileModal = ({ isOpen, onClose }) => {
  const [userData, setUserData] = useState({
    username: '',
    email: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [originalData, setOriginalData] = useState({});
  const [isDataChanged, setIsDataChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const modalRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchUserData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isEditing) {
      const hasChanged = 
        userData.username !== originalData.username || 
        userData.email !== originalData.email;
      
      setIsDataChanged(hasChanged);
    }
  }, [userData, originalData, isEditing]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isEditing]);

  const fetchUserData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUserData(response.data);
      setOriginalData(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData({ ...userData, [name]: value });
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        'http://localhost:5000/api/auth/update',
        {
          username: userData.username,
          email: userData.email
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setOriginalData(response.data.user);
      setUserData(response.data.user);
      setIsEditing(false);
      
      // Update local storage with new username if needed
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (currentUser.username !== response.data.user.username) {
        localStorage.setItem('user', JSON.stringify({
          ...currentUser,
          username: response.data.user.username
        }));
      }
      
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error.response?.data?.message || 'Failed to update profile');
      setUserData(originalData); // Revert changes on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setUserData(originalData);
    setIsEditing(false);
    setError('');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onClose();
    navigate('/login');
  };

  if (!isOpen) return null;

  return (
    <div className="profile-modal-overlay">
      <div className="profile-modal" ref={modalRef}>
        <div className="profile-modal-header">
          <h2>User Profile</h2>
          {!isEditing && (
            <button className="profile-modal-close-button" onClick={onClose}>×</button>
          )}
        </div>

        {error && <div className="profile-modal-error">{error}</div>}

        {isLoading ? (
          <div className="profile-modal-loading">
            <div className="profile-modal-spinner"></div>
            <p>Loading profile...</p>
          </div>
        ) : (
          <form className="profile-modal-form" onSubmit={(e) => e.preventDefault()}>
            <div className="profile-modal-form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={userData.username || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="profile-modal-input"
              />
            </div>

            <div className="profile-modal-form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={userData.email || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="profile-modal-input"
              />
            </div>

            <div className="profile-modal-form-actions">
              {isEditing ? (
                <>
                  <button 
                    className={`profile-modal-save-button ${isDataChanged ? 'active' : 'disabled'}`}
                    onClick={handleSave}
                    disabled={!isDataChanged}
                    type="button"
                  >
                    ✓
                  </button>
                  <button 
                    className="profile-modal-cancel-button"
                    onClick={handleCancel}
                    type="button"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <button 
                  className="profile-modal-edit-button"
                  onClick={handleEdit}
                  type="button"
                >
                  ✎
                </button>
              )}
            </div>

            <button 
              className="profile-modal-logout-button"
              onClick={handleLogout}
              type="button"
            >
              Log Out
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;