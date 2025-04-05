import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/home.css';
import Sidebar from '../components/Sidebar';

const Home = () => {
  const navigate = useNavigate();
  const [currencies] = useState(['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'HKD', 'SGD', 'MXN', 'BRL', 'RUB', 'ZAR', 'TRY', 'KRW', 'NZD']);
  const [state, setState] = useState({
    baseCurrency: '',
    targetCurrency: '',
    exchangeRate: null,
    loading: false,
    error: ''
  });

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    const fetchRate = async () => {
      const { baseCurrency, targetCurrency } = state;
      if (!baseCurrency || !targetCurrency) {
        setState(s => ({...s, exchangeRate: null}));
        return;
      }

      setState(s => ({...s, loading: true, error: ''}));
      
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get(`http://localhost:5000/api/currencies/check-rate`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { base: baseCurrency, target: targetCurrency }
        });
        setState(s => ({...s, exchangeRate: data.exchange_rate}));
      } catch (err) {
        setState(s => ({
          ...s, 
          error: 'Unable to fetch exchange rate. Please try again.',
          exchangeRate: null
        }));
      } finally {
        setState(s => ({...s, loading: false}));
      }
    };

    fetchRate();
  }, [state.baseCurrency, state.targetCurrency]);

  const handleSaveToWallet = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/currencies/save-to-wallet', 
        { 
          base_currency: state.baseCurrency, 
          target_currency: state.targetCurrency 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Currency pair saved to wallet!');
    } catch (err) {
      alert('Failed to save to wallet. Please try again.');
    }
  };

  const formatRate = rate => rate ? parseFloat(rate).toFixed(4) : '';

  return (
    <div className="main-container">
      <Sidebar />
      <div className="content-area">
        <div className="currency-converter">
          <h2>Currency Exchange</h2>
          
          <div className="converter-container">
            <div className="currency-selectors">
              <div className="currency-box">
                <label>Base Currency</label>
                <select 
                  value={state.baseCurrency}
                  onChange={e => setState(s => ({...s, baseCurrency: e.target.value}))}
                >
                  <option value="">Select</option>
                  {currencies.map(c => (
                    <option key={`base-${c}`} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              
              <div className="exchange-icon">
                <span>⇄</span>
              </div>
              
              <div className="currency-box">
                <label>Target Currency</label>
                <select
                  value={state.targetCurrency}
                  onChange={e => setState(s => ({...s, targetCurrency: e.target.value}))}
                >
                  <option value="">Select</option>
                  {currencies.map(c => (
                    <option key={`target-${c}`} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="exchange-rate-display">
              {state.loading ? (
                <div className="loading">Loading...</div>
              ) : state.error ? (
                <div className="error">{state.error}</div>
              ) : state.exchangeRate ? (
                <div className="rate">
                  <span>1 {state.baseCurrency} = {formatRate(state.exchangeRate)} {state.targetCurrency}</span>
                  <button className="save-button" onClick={handleSaveToWallet}>
                    Save to Wallet
                  </button>
                </div>
              ) : (
                <div className="placeholder">
                  {state.baseCurrency && state.targetCurrency 
                    ? "Fetching exchange rate..." 
                    : "Select currencies to see exchange rate"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;