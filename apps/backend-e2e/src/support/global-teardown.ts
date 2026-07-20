/* eslint-disable */
module.exports = async function () {
  const server = (globalThis as any).__SERVER__;
  if (server) server.kill();
};
