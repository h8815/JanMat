import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
import Landing from './pages/Landing';
import About from './pages/About';
import PolicyPage from './pages/PolicyPage';
import ResourcesPage from './pages/ResourcesPage';
import Login from './pages/auth/Login';
import ForcePasswordChange from './pages/auth/ForcePasswordChange';
import AdminDashboard from './pages/admin/AdminDashboard';
import OperatorDashboard from './pages/operator/OperatorDashboard';
import VoterVerification from './pages/operator/VoterVerification';
import FraudReport from './pages/operator/FraudReport';
import PrivateRoute from './components/PrivateRoute';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';

import { ThemeProvider } from './context/ThemeContext';
import { FontSizeProvider } from './context/FontSizeContext';
import SessionMonitor from './components/common/SessionMonitor';
import { ROLES } from './constants/roles';

function App() {
  return (
    <FontSizeProvider>
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <SessionMonitor />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<PolicyPage />} />
            <Route path="/privacy" element={<PolicyPage />} />
            <Route path="/copyright" element={<PolicyPage />} />
            <Route path="/disclaimer" element={<PolicyPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/setup-password" element={<ForcePasswordChange />} />

            {/* Protected Routes */}
            <Route element={<PrivateRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERUSER]} />}>
              <Route path="/admin-dashboard" element={
                <NotificationProvider>
                  <AdminDashboard />
                </NotificationProvider>
              } />
            </Route>

            <Route element={<PrivateRoute allowedRoles={[ROLES.OPERATOR]} />}>
              <Route path="/operator-dashboard" element={<OperatorDashboard />} />
              <Route path="/operator/verify" element={<VoterVerification />} />
              <Route path="/operator/report-fraud" element={<FraudReport />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ThemeProvider>
    </FontSizeProvider>
  );
}

export default App;
