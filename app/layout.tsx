import type { Metadata } from "next";

import "../styles/globals.css";
import { brandName } from "@/config/app";

export const metadata: Metadata = {
  title: brandName,
  description: "Страница оформления заказа на торты."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <div className="page-shell">{children}</div>
      </body>
    </html>
  );
}
