import axios from "axios";

const apiClient = axios.create({
  baseURL: "/", // đi qua Vite Proxy tới http://localhost:3001
  headers: {
    "Content-Type": "application/json",
  },
});

// Hàm để cập nhật token cho Axios
export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common["Authorization"];
  }
};

export default apiClient;
