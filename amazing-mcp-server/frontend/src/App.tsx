import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { Dashboard } from './components/Dashboard';
import { WebSocketProvider } from './contexts/WebSocketContext';
import './App.css';

// Configure axios defaults
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <div className="min-h-screen bg-surface-content">
          <Dashboard />
        </div>
      </WebSocketProvider>
    </QueryClientProvider>
  );
}

export default App;
