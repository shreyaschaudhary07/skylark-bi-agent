import "./globals.css";

export const metadata = {
  title: "Skylark Drones — Executive BI Command Center",
  description: "AI-powered 3D Business Intelligence Command Center querying Monday.com live boards for pipeline, revenue, and drone flight execution metrics.",
  keywords: "skylark drones, monday.com, business intelligence, 3D executive HUD, pipeline analytics",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#05060a" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚁</text></svg>" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
