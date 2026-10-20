import { PublicAssistant } from "@/components/public-assistant";
import { notFound } from "next/navigation";
import { getPublicAssistantInfo } from "@/lib/public-assistant";

export default async function PublicAssistantPage({
  params,
}: PageProps<"/assistant/[publicId]">) {
  const { publicId } = await params;
  const info = await getPublicAssistantInfo(publicId);

  if (!info) {
    notFound();
  }

  return (
    <PublicAssistant
      publicId={publicId}
      title={`Ask ${info.organizationName}`}
    />
  );
}
