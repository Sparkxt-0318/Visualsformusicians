import { useState } from 'react';
import SetupScreen from './components/SetupScreen';
import PerformanceView from './components/PerformanceView';

export default function App() {
  const [started, setStarted] = useState(false);
  return started ? (
    <PerformanceView />
  ) : (
    <SetupScreen onStart={() => setStarted(true)} />
  );
}
