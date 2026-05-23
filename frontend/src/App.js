import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/login';
import Register from './components/register';
import Home from './components/Home';
import Upload from './components/Upload';
import Accounts from './components/Accounts';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

function AppContent() {
  const { user, csrfToken, logout } = useAuth();

  return (
    <div className="App">
      <Routes>
        {/* Home route - protected, redirects to /login if not authenticated */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Home user={user} csrfToken={csrfToken} onLogout={logout} />
            </ProtectedRoute>
          } 
        />
        
        <Route
          path="/accounts"
          element={
            <ProtectedRoute>
              <Accounts csrfToken={csrfToken} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <Upload user={user} csrfToken={csrfToken} />
            </ProtectedRoute>
          }
        />
        
        {/* Login route */}
        <Route path="/login" element={<Login />} />
        
        {/* Register route */}
        <Route path="/register" element={<Register />} />
        
        {/* Catch all other routes and redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
