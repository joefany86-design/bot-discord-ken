module.exports = {
  apps: [
    {
      name: 'bot-2026',
      script: './index.js',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '750M',
      autorestart: true,
      watch: false,
    }
  ],
};

