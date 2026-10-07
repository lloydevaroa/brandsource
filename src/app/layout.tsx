import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Montserrat } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { CartProvider } from "@/lib/cart";
import { getMenuCategories } from "@/lib/categories";
import { MenuCategoriesProvider } from "@/lib/menu-categories";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
      <body className={`${montserrat.variable} antialiased`}>
        <CartProvider>
          <MenuCategoriesProvider categories={menuCategories}>
            {clerkKey ? <ClerkProvider publishableKey={clerkKey}>{children}</ClerkProvider> : children}
            <SiteFooter />
          </MenuCategoriesProvider>
        </CartProvider>
      </body>
    </html>
  );
}
