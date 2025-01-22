import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { ToastContainer } from 'react-toastify';
import App from './App';
import { Route, Routes } from 'react-router-dom';
import Positions from './pages/Positions';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <>
    <App />
    <ToastContainer />
  </>
);
