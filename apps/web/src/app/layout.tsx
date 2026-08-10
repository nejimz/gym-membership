import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { SettingsProvider } from '@/lib/settings';
import { DocumentFavicon } from '@/components/DocumentFavicon';

export const metadata: Metadata = {
  title: 'Ironleaf Gym Membership',
  description: 'Gym membership, attendance, progress, and reports',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SettingsProvider>
          <DocumentFavicon />
          <AuthProvider>{children}</AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
