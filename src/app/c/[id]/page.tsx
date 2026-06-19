import { Metadata } from "next";
import { prisma } from "@/lib/db";
import SourcingDashboard from "@/components/SourcingDashboard";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  
  if (!id) {
    return { title: "Shared Chat | Kapruka AI" };
  }

  try {
    const session = await prisma.chatSession.findUnique({
      where: { id },
      select: { title: true },
    });

    if (session) {
      return {
        title: `${session.title} | Kapruka AI`,
        description: "View this shared Kapruka AI sourcing chat.",
        openGraph: {
          title: `${session.title} | Kapruka AI`,
          description: "View this shared Kapruka AI sourcing chat.",
          images: [
            {
              url: "https://kapruka.com/images/kapruka_logo.jpg", // Default or specific OG image
              width: 1200,
              height: 630,
              alt: "Kapruka AI Shared Chat",
            },
          ],
        },
      };
    }
  } catch (error) {
    console.error("Error generating metadata:", error);
  }

  return { title: "Shared Chat | Kapruka AI" };
}

export default async function SessionPage({ params }: Props) {
  const { id } = await params;
  return <SourcingDashboard initialSessionId={id} />;
}
