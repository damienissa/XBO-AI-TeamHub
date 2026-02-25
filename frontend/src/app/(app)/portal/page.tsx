"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Building2,
  CreditCard,
  Wallet,
  Camera,
  Megaphone,
  Code2,
  Scale,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Department {
  id: string;
  slug: string;
  name: string;
}

// Map slugs to icons and descriptions
const DEPT_META: Record<string, { icon: React.ElementType; description: string }> = {
  cashier: {
    icon: CreditCard,
    description: "Point-of-sale operations and cashier systems",
  },
  fintech360: {
    icon: Wallet,
    description: "Financial technology and payment processing",
  },
  xbo_studio: {
    icon: Camera,
    description: "Creative production and media studio",
  },
  xbo_marketing: {
    icon: Megaphone,
    description: "Marketing campaigns and brand strategy",
  },
  xbo_dev: {
    icon: Code2,
    description: "Software development and engineering",
  },
  xbo_legal: {
    icon: Scale,
    description: "Legal affairs and compliance",
  },
  xbo_hr: {
    icon: Users,
    description: "Human resources and people operations",
  },
};

async function fetchDepartments(): Promise<Department[]> {
  const res = await fetch(`${API}/api/departments`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json();
}

export default function PortalPage() {
  const router = useRouter();
  const { data: departments, isPending, isError } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
    staleTime: 300_000,
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Department Portal</h1>
        <p className="text-slate-500 mt-1">
          Submit a new request on behalf of any department.
        </p>
      </div>

      {isPending && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <div className="p-6 text-red-500 text-sm">
          Failed to load departments. Please refresh and try again.
        </div>
      )}

      {departments && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {departments.map((dept) => {
            const meta = DEPT_META[dept.slug] ?? { icon: Building2, description: "" };
            const Icon = meta.icon;
            return (
              <Card
                key={dept.id}
                className="cursor-pointer hover:shadow-md hover:border-slate-300 transition-all duration-150 group"
                onClick={() => router.push(`/portal/${dept.slug}`)}
              >
                <CardHeader className="pb-2">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors mb-2">
                    <Icon className="h-5 w-5 text-slate-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    {dept.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-xs leading-relaxed">
                    {meta.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
