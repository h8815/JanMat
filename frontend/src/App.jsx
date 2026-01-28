import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import OperatorDashboard from './pages/operator/OperatorDashboard';
import PrivateRoute from './components/PrivateRoute';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route element={<PrivateRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
          </Route>

          <Route element={<PrivateRoute allowedRoles={['OPERATOR']} />}>
            <Route path="/operator-dashboard" element={<OperatorDashboard />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
