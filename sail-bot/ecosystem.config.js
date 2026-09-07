module.exports = {
  apps: [
    {
      name: 'sail-bot',
      script: 'index.js',
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
