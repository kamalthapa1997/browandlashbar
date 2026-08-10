import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginAdmin } from "../api/authService";
import Modal from "../components/Modal/Modal";
import "./Login.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [destination, setDestination] = useState(null);
  const navigate = useNavigate();

  const closeTo = (path) => {
    setDestination(path);
    setIsOpen(false);
  };

  const handleClose = () => {
    closeTo("/");
  };

  const submitHandler = async (event) => {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    try {
      setLoading(true);

      await loginAdmin({
        username: username.trim(),
        password,
      });

      closeTo("/admin");
    } catch (err) {
      if (err?.status === 401) {
        setError("Invalid username or password.");
      } else if (err?.status === 403) {
        setError("You do not have permission to access the admin area.");
      } else if (err?.status === 429) {
        setError("Too many login attempts. Please try again later.");
      } else {
        setError("Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      onExitComplete={() => destination && navigate(destination)}
      maxWidth="520px"
    >
      <section className="login__card" aria-label="Admin login form">
        <h1 className="login__title">Admin Login</h1>
        <p className="login__subtitle">
          Sign in to manage gallery, services, and settings.
        </p>

        {error && <div className="login__error">{error}</div>}

        <form className="login__form" onSubmit={submitHandler}>
          <label className="login__label" htmlFor="login-username">
            Username
          </label>
          <input
            id="login-username"
            type="text"
            className="login__input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
          />

          <label className="login__label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            className="login__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
          />

          <button className="login__button" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="login__help">
          Need the admin password? Contact the site owner for access.
        </p>
      </section>
    </Modal>
  );
}

export default Login;
