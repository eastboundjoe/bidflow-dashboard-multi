import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: {
    default: "BidFlow | Amazon Placement Optimizer",
    template: "%s | BidFlow",
  },
  description:
    "Optimize your Amazon advertising placements with data-driven insights. Analyze Top of Search, Rest of Search, and Product Page performance.",
  keywords: [
    "Amazon Ads",
    "PPC",
    "Placement Optimization",
    "Amazon Advertising",
    "ACOS",
    "Bid Management",
  ],
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
