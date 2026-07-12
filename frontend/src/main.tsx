import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import { AuthProvider } from "./context/AuthContext.js";
import { UIProvider } from "./context/UIContext.js";
import { ConfirmProvider } from "./context/ConfirmContext.js";
import "./css/index.css";
import "./css/home.css";
import "./css/lesson.css";
import "./css/document.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <UIProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </UIProvider>
    </AuthProvider>
  </BrowserRouter>
);
