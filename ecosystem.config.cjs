export default {
  apps: [
    {
      name: "ew-events-bot",
      script: "src/index.js",
      cwd: import.meta.dirname,
      interpreter: "node",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
