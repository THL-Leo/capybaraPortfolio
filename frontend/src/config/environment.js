// Environment configuration and validation
const requiredEnvVars = [
  'REACT_APP_API_URL'
];

// Validate all required environment variables are present
const validateEnvironment = () => {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }
};

// Validate on import
validateEnvironment();

// Export validated configuration
export const config = {
  apiUrl: process.env.REACT_APP_API_URL,
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

// Prevent accidental exposure of sensitive data
if (config.isDevelopment) {
  console.log('Environment configuration loaded:', {
    apiUrl: config.apiUrl,
    environment: process.env.NODE_ENV
  });
} 