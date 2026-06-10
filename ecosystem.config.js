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
    },
    {
      name: 'admin-panel-2026',
      script: './admin-panel/server.js',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '200M',
      autorestart: true,
      watch: false,
    }
  ],
};
