/* eslint-disable */
import axios from 'axios';

module.exports = async function () {
  const port = process.env.PORT ?? '8199';
  axios.defaults.baseURL = `http://localhost:${port}`;
};
