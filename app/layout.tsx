import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veredillas FM — Panel de Administración",
  description: "Panel de gestión de contenidos (Episodios, Blog, Invitados, Medios R2) para Veredillas FM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
