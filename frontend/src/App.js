import './App.css';
import { useState } from 'react';
import Login from './components/login';
import Register from './components/register';
import Home from './components/Home';
import { AuthProvider, useAuth } from './context/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';

function AppContent() {
  const { isAuthenticated, user, token, logout, loading } = useAuth();
  const [currentView, setCurrentView] = useState('login'); // 'login' or 'register'

  const handleSwitchToRegister = () => {
    setCurrentView('register');
  };

  const handleSwitchToLogin = () => {
    setCurrentView('login');
  };

  if (loading) {
    return (
      <div className="App">
        <div className="container mt-5">
          <div className="row justify-content-center">
            <div className="col-md-6">
              <div className="card">
                <div className="card-body text-center">
                  <div className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3">Loading...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated()) {
    return (
      <div className="App">
        <Home user={user} token={token} onLogout={logout} />
      </div>
    );
  }

  return (
    <div className="App">
      {currentView === 'login' ? (
        <Login onSwitchToRegister={handleSwitchToRegister} />
      ) : (
        <Register onSwitchToLogin={handleSwitchToLogin} />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
