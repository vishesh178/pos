module.exports = {
  apps: [
    {
      name: 'pos-erp',
      script: 'server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '750M',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
    },
  ],
};
