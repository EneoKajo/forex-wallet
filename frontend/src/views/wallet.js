import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Wallet.css';
import Sidebar from '../components/Sidebar';

const Wallet = () => {
  const navigate = useNavigate();
  const [walletItems, setWalletItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState({});
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    } else {
      fetchWalletItems();
    }
  }, [navigate]);

  const fetchWalletItems = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/currencies/wallet', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWalletItems(response.data);
    } catch (error) {
      console.error('Error fetching wallet items:', error);
      setError('Unable to fetch your saved currencies. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const refreshAllRates = async () => {
    setIsRefreshingAll(true);
    
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/currencies/update-wallet', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await fetchWalletItems();
    } catch (error) {
      console.error('Error refreshing all rates:', error);
      setError('Failed to refresh rates. Please try again.');
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const refreshRate = async (baseCurrency, targetCurrency, index) => {
    setRefreshing(prev => ({ ...prev, [index]: true }));
    
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/currencies/save-to-wallet', 
        { base_currency: baseCurrency, target_currency: targetCurrency },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      await fetchWalletItems();
    } catch (error) {
      console.error('Error refreshing rate:', error);
      setError('Failed to refresh rate. Please try again.');
    } finally {
      setRefreshing(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/currencies/wallet/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setWalletItems(walletItems.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('Failed to delete item. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const options = { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="main-container wallet-page">
      <Sidebar />
      <div className="content-area">
        <div className="wallet-content">
          <div className="wallet-header">
            <div className="refresh-container">
              <button 
                className={`refresh-all-button ${isRefreshingAll ? 'refreshing' : ''}`}
                onClick={refreshAllRates}
                title="Refresh all rates"
                disabled={isRefreshingAll}
              >
                ↻
              </button>
              <span className="refresh-all-text">Refresh all</span>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading your currency rates...</p>
            </div>
          ) : walletItems.length === 0 ? (
            <div className="empty-wallet">
              <div className="empty-wallet-icon">💰</div>
              <h3>Your wallet is empty</h3>
              <p>Add currency pairs from the exchange page to track them here.</p>
              <button 
                className="add-currency-button"
                onClick={() => navigate('/')}
              >
                Go to Exchange
              </button>
            </div>
          ) : (
            <div className="wallet-list">
              {walletItems.map((item, index) => (
                <div className="rate-row" key={index} data-id={item.id || index}>
                  <div className="currency-pair">
                    {item.base_currency} / {item.target_currency}
                  </div>
                  <div className="rate-value">
                    {parseFloat(item.exchange_rate).toFixed(4)}
                  </div>
                  <div className="last-updated-time">
                    {formatDate(item.last_updated)}
                  </div>
                  <div className="row-actions">
                    <button 
                      className={`rate-refresh-button ${refreshing[index] ? 'refreshing' : ''}`}
                      onClick={() => refreshRate(item.base_currency, item.target_currency, index)}
                      disabled={refreshing[index]}
                      title="Refresh rate"
                    >
                      ↻
                    </button>
                    <button 
                      className="rate-delete-button"
                      onClick={() => handleDeleteItem(item.id)}
                      title="Remove from wallet"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Wallet;