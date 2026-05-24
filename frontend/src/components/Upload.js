import React, { useState } from 'react';
import DashboardNav from './DashboardNav';

const Upload = ({ user, csrfToken, onLogout }) => {
  const [selectedBrokerage, setSelectedBrokerage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const brokerages = [
    { value: 'schwab', label: 'Charles Schwab' }
  ];

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
      setError('');
    } else {
      setError('Please select a valid CSV file.');
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedBrokerage) {
      setError('Please select a brokerage.');
      return;
    }

    if (!selectedFile) {
      setError('Please select a CSV file.');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    const formData = new FormData();
    formData.append('csv_file', selectedFile);
    formData.append('brokerage', selectedBrokerage);

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-TOKEN': csrfToken,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || 'File uploaded successfully!');
        setSelectedFile(null);
        setSelectedBrokerage('');
        // Reset file input
        document.getElementById('csv-file-input').value = '';
      } else {
        setError(data.error || 'Upload failed. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <DashboardNav username={user?.username} onLogout={onLogout} />

      <div className="dashboard-page">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="capy-card">
              <div className="capy-card-header">
                <h5 className="mb-0">Upload Transaction CSV</h5>
              </div>
              <div className="capy-card-body">
                <div className="mb-3">
                  <label htmlFor="brokerage-select" className="form-label">
                    Select Brokerage
                  </label>
                  <select
                    id="brokerage-select"
                    className="form-select"
                    value={selectedBrokerage}
                    onChange={(e) => setSelectedBrokerage(e.target.value)}
                  >
                    <option value="">Choose a brokerage...</option>
                    {brokerages.map((brokerage) => (
                      <option key={brokerage.value} value={brokerage.value}>
                        {brokerage.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label htmlFor="csv-file-input" className="form-label">
                    Select CSV File
                  </label>
                  <input
                    id="csv-file-input"
                    type="file"
                    className="form-control"
                    accept=".csv"
                    onChange={handleFileSelect}
                  />
                  <div className="form-text">
                    Please select a CSV file exported from your brokerage.
                  </div>
                </div>

                {selectedFile && (
                  <div className="mb-3">
                    <div className="alert alert-info">
                      <strong>Selected file:</strong> {selectedFile.name}
                      <br />
                      <small>Size: {(selectedFile.size / 1024).toFixed(2)} KB</small>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="alert alert-success" role="alert">
                    {message}
                  </div>
                )}

                <div className="d-grid">
                  <button
                    className="btn btn-primary"
                    onClick={handleUpload}
                    disabled={uploading || !selectedBrokerage || !selectedFile}
                  >
                    {uploading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Uploading...
                      </>
                    ) : (
                      'Upload CSV'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="capy-card mt-4">
              <div className="capy-card-header">
                <h5 className="mb-0">Upload Instructions</h5>
              </div>
              <div className="capy-card-body">
                <ol>
                  <li>Select Charles Schwab from the dropdown above</li>
                  <li>Choose the CSV file you exported from Schwab</li>
                  <li>Click "Upload CSV" to process your transactions</li>
                  <li>Your transactions will be imported and available on the Dashboard</li>
                </ol>
                <div className="alert alert-info">
                  <strong>Currently Supported:</strong> Only Charles Schwab CSV exports are supported at this time.
                </div>
                <div className="alert alert-warning">
                  <strong>Note:</strong> The system will import BUY, SELL, and DIVIDEND transactions. Stock splits, transfers, and other transaction types are not currently imported.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
