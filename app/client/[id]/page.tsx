import ClientGallery from "./ClientGallery";

export function generateStaticParams() {
  return [{ id: "index" }];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ClientGallery params={params} />;
}
