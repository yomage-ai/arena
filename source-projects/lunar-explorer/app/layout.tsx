import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'SELENE · 月面漫游',
  description: '在真实光影的立体月面中，跟随玉衡号探测车缓慢巡航。自由旋转、缩放与探索。',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
