import { notFound } from "next/navigation";
import { PublicAssistant } from "@/components/public-assistant";
import { getPublicAssistantInfo } from "@/lib/public-assistant";

export default async function EmbeddedAssistantPage({
  params,
}: PageProps<"/embed/assistant/[publicId]">) {
  const { publicId } = await params;

  const info = await getPublicAssistantInfo(publicId);

  if (!info) {
    notFound();
  }

  return (
    <PublicAssistant
      publicId={publicId}
      embedded
      title={`Ask ${info.organizationName}`}
    />
  );
}
