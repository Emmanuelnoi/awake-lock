// Basic example demonstrating the core wake lock functionality
import { WakeLock } from '../dist/esm/index.js';

// Create a new WakeLock instance
const wakeLock = new WakeLock({
  debug: true,
  batteryOptimization: true,
  performanceMonitoring: true,
});

// Set up event listeners
wakeLock.on('enabled', ({ type, strategy }) => {
  console.log(`Wake lock enabled: ${type} using ${strategy}`);
});

wakeLock.on('disabled', ({ type, reason }) => {
  console.log(`Wake lock disabled: ${type} (${reason})`);
});

wakeLock.on('error', ({ error }) => {
  console.error('Wake lock error:', error);
});

wakeLock.on('fallback', ({ from, to, reason }) => {
  console.log(`Fallback from ${from} to ${to}: ${reason}`);
});

// Check if wake lock is supported
if (wakeLock.isSupported()) {
  console.log('Wake lock is supported!');
  console.log('Supported strategies:', wakeLock.getSupportedStrategies());
} else {
  console.log('Wake lock is not supported on this device/browser');
}

// Example usage
async function testWakeLock() {
  try {
    // Request a screen wake lock
    console.log('Requesting screen wake lock...');
    const sentinel = await wakeLock.request('screen');

    console.log('Wake lock acquired:', sentinel);
    console.log('Status:', wakeLock.getStatus());

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Release the wake lock
    console.log('Releasing wake lock...');
    await wakeLock.release();

    console.log('Wake lock released');
  } catch (error) {
    console.error('Wake lock test failed:', error);
  }
}

// Run the test when the page loads
if (typeof window !== 'undefined') {
  window.addEventListener('load', testWakeLock);
} else {
  // Node.js environment
  console.log('Running in Node.js environment - wake lock not available');
}
