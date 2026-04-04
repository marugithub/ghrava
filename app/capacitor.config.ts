import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ghrava.app',
  appName: 'Ghrava',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    url: 'http://YOUR_NAS_IP:3001' // Replace with your actual NAS IP
  }
};

export default config;