import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ allowedRoles }) => {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // If Admin tries to access Operator, redirect to dashboard?
        return <Navigate to="/unauthorized" replace />;
    }

    return <Outlet />;
};

export default PrivateRoute;
