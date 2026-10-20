export interface PublicAssistantInfo {
  organizationName: string;
}

function isPublicAssistantInfo(value: unknown): value is PublicAssistantInfo {
  return (
    typeof value === "object" &&
    value !== null &&
    "organizationName" in value &&
    typeof value.organizationName === "string"
  );
}

export async function getPublicAssistantInfo(
  publicId: string,
): Promise<PublicAssistantInfo | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is required to load the assistant");
  }

  const response = await fetch(
    `${apiUrl}/public/assistants/${encodeURIComponent(publicId)}`,
    { cache: "no-store" },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to load this assistant.");
  }

  const data: unknown = await response.json();

  if (!isPublicAssistantInfo(data)) {
    throw new Error("The assistant returned invalid public information.");
  }

  return data;
}
