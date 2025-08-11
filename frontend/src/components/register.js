import React, { useState } from 'react';

const Register = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    inviteCode: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Client-side validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          invite_code: formData.inviteCode
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Registration successful! You can now log in.');
        console.log('Registration successful:', data);
        // Clear form
        setFormData({
          username: '',
          password: '',
          confirmPassword: '',
          inviteCode: ''
        });
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Register</h2>
              
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="alert alert-success" role="alert">
                  {success}
                </div>
              )}
              
              <form onSubmit={handleSubmit}>
                {/* Username input */}
                <div className="mb-3">
                  <label htmlFor="username" className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {/* Password input */}
                <div className="mb-3">
                  <label htmlFor="password" className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    minLength="6"
                  />
                  <div className="form-text">Password must be at least 6 characters long.</div>
                </div>

                {/* Confirm Password input */}
                <div className="mb-3">
                  <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                  <input
                    type="password"
                    className="form-control"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {/* Invite Code input */}
                <div className="mb-3">
                  <label htmlFor="inviteCode" className="form-label">Invite Code</label>
                  <input
                    type="text"
                    className="form-control"
                    id="inviteCode"
                    name="inviteCode"
                    value={formData.inviteCode}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your invite code"
                  />
                </div>

                {/* Submit button */}
                <button type="submit" className="btn btn-primary w-100 mb-4" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Register'}
                </button>

                {/* Login link */}
                <div className="text-center">
                  <p>Already have an account? 
                    <button 
                      type="button" 
                      className="btn btn-link p-0 ms-1"
                      onClick={onSwitchToLogin}
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
