module.exports = {
  apps: [
    {
      name: "ew-events-bot",
      script: "src/index.js",
      cwd: __dirname,
      interpreter: "node",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
