import { Inter } from "next/font/google";
import "./globals.css";
import TitleBar from "./components/TitleBar";
import ClientLayout from "./components/ClientLayout";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "IsuDeck",
  description: "Open Source Stream Deck Alternative",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased bg-[#1a1a1a] text-white h-screen w-screen overflow-hidden select-none flex flex-col`}
      >
        <TitleBar />
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
