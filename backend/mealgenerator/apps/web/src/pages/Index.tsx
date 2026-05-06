// This page is no longer used as the main landing page
// Redirect to Landing component
import { Navigate } from 'react-router-dom';

const Index = () => {
  return <Navigate to="/" replace />;
};

export default Index;
