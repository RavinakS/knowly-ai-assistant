import { notFound } from "next/navigation";
import { PublicAssistant } from "@/components/public-assistant";

interface PublicAssistantInfo {
  name: string;
}

function isPublicAssistantInfo(value: unknown): value is PublicAssistantInfo {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string"
  );
}

export default async function EmbeddedAssistantPage({
  params,
}: PageProps<"/embed/assistant/[publicId]">) {
  const { publicId } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is required to load the assistant.");
  }

  const response = await fetch(
    `${apiUrl}/public/assistants/${encodeURIComponent(publicId)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error("Unable to load this assistant.");
  }

  const info: unknown = await response.json();
  if (!isPublicAssistantInfo(info)) {
    throw new Error("The assistant returned invalid public information.");
  }

  return (
    <PublicAssistant
      publicId={publicId}
      embedded
      title={info.name}
    />
  );
}
