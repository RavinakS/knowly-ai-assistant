import { PublicAssistant } from "@/components/public-assistant";

export default async function PublicAssistantPage({
  params,
}: PageProps<"/assistant/[publicId]">) {
  const { publicId } = await params;
  return <PublicAssistant publicId={publicId} />;
}
