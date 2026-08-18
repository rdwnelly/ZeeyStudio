import ClientGallery from "./ClientGallery";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ClientGallery params={params} />;
}
