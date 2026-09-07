module.exports = {
  apps: [
    {
      name: 'nexar-bot',
      script: 'src/index.js',
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
