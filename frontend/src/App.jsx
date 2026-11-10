import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout.jsx';
import Login from './Login';
import OverviewPage from './pages/OverviewPage.jsx';
import ServiceStatusPage from './pages/ServiceStatusPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

// Shows your existing Login page and signs in through the backend.
function LoginRoute() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const goTo = location.state?.from && location.state.from !== '/login' ? location.state.from : '/';

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to={goTo} replace />;

  async function handleLogin(_mode, email, password) {
    setError('');
    setSubmitting(true);
    try {
      await login(email.toLowerCase(), password);
      navigate(goTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Login
      mode="Any"
      usernameLabel="Email"
      onLogin={handleLogin}
      error={error}
      submitting={submitting}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="status" element={<ServiceStatusPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}