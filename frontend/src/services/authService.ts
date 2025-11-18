import axios from "axios";

const API_URL = "http://localhost:5000/api/auth";

export const registerUser = async (fullName: string, email: string, password: string) => {
  const response = await axios.post(`${API_URL}/register`, {
    fullName,
    email,
    password,
  });
  return response.data;
};

export const loginUser = async (email: string, password: string) => {
  const response = await axios.post(`${API_URL}/dev-login`, {
    email,
    password,
  });
  return response.data;
};
