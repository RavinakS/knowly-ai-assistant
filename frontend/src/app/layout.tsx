import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knowly — AI Knowledge & Decision Assistant",
  description:
    "Make your organization's knowledge easier to find and put to use.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
