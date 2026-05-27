"use client";

import { useParams } from "next/navigation";
import { ProjectTabs } from "@/components/layout/project-tabs";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const projectId = params.projectId as string;

  return (
    <div className="space-y-4">
      <ProjectTabs projectId={projectId} />
      {children}
    </div>
  );
}
