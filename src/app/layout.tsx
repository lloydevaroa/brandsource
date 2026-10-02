import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/lib/cart";
import { getMenuCategories } from "@/lib/categories";
import { MenuCategoriesProvider } from "@/lib/menu-categories";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BRANDSource — Trade Show & Events merch, NZ suppliers",
  description:
    "Branded event merch fulfilled in New Zealand. Configure online, human proofing, flat clear pricing.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const menuCategories = await getMenuCategories();
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <html lang="en-NZ">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <CartProvider>
          <MenuCategoriesProvider categories={menuCategories}>
            {clerkKey ? <ClerkProvider publishableKey={clerkKey}>{children}</ClerkProvider> : children}
          </MenuCategoriesProvider>
        </CartProvider>
      </body>
    </html>
  );
}
