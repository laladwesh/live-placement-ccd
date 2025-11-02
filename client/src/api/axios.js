// src/api/axios.js
import axios from "axios";

const BASE_PATH = process.env.REACT_APP_BASE_PATH || "/dday";
const api = axios.create({
  baseURL: BASE_PATH ? `${BASE_PATH}/api` : "/api",
  withCredentials: false
});

// attach token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (err) => Promise.reject(err));

export default api;
