// src/api/axios.js
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: false
});

// attach token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (err) => Promise.reject(err));

export default api;
