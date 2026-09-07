module.exports = {
  apps: [
    {
      name: "exceed-reality-bot",
      script: "./src/index.js",
      cwd: "/home/oliverlarkin/exceed-reality-bot",
      interpreter: "node",
      autorestart: true,
      watch: false,
      max_restarts: 100,
      min_uptime: "10s",
      restart_delay: 5000,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production"
      },
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true
    }
  ]
};
