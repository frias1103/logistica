export const metadata = {
  title: "Seguimiento de Logística",
  description: "Control diario de órdenes sin movimiento",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, sans-serif",
          background: "#0f172a",
          color: "#e2e8f0",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
