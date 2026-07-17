import DocScannerClient from "./DocScannerClient";

export const metadata = {
  title: "Document Scanner | VeloRoute",
  description: "Convert images, PDFs, PPTX and scanned documents to text or Word format using AI.",
};

export default function DocScannerPage() {
  return <DocScannerClient />;
}
