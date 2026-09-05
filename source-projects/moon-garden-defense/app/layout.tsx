import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '月光花园守卫战',
  description: '种下奇妙植物，守护月光下的花园。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
