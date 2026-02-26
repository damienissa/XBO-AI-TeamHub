"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Building2,
  CreditCard,
  Microscope,
  Briefcase,
  Landmark,
  BarChart2,
  TrendingUp,
  ShieldCheck,
  FileText,
  Palette,
  Pen,
  Headphones,
  ArrowLeftRight,
  Server,
  DollarSign,
  UserPlus,
  Users,
  Scale,
  UserCheck,
  Package,
  Trophy,
  Wrench,
  BookOpen,
  Monitor,
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
  rnd: {
    icon: Microscope,
    description: "Research and development initiatives",
  },
  back_office: {
    icon: Briefcase,
    description: "Back office operations and administration",
  },
  banking: {
    icon: Landmark,
    description: "Banking operations and financial services",
  },
  bi: {
    icon: BarChart2,
    description: "Business intelligence and data analytics",
  },
  bizdev_sales: {
    icon: TrendingUp,
    description: "Business development and sales strategy",
  },
  cashier: {
    icon: CreditCard,
    description: "Point-of-sale operations and cashier systems",
  },
  compliance: {
    icon: ShieldCheck,
    description: "Regulatory compliance and risk management",
  },
  content: {
    icon: FileText,
    description: "Content creation and editorial management",
  },
  creative_studio: {
    icon: Palette,
    description: "Creative production and media studio",
  },
  design: {
    icon: Pen,
    description: "Visual design and brand identity",
  },
  customer_support: {
    icon: Headphones,
    description: "Customer support and client relations",
  },
  dealing: {
    icon: ArrowLeftRight,
    description: "Trading and dealing desk operations",
  },
  devops_it: {
    icon: Server,
    description: "DevOps, infrastructure and IT operations",
  },
  finance: {
    icon: DollarSign,
    description: "Financial planning and accounting",
  },
  hr_recruitment_cy: {
    icon: UserPlus,
    description: "Human resources and recruitment (Cyprus)",
  },
  hr_recruitment_ukr: {
    icon: Users,
    description: "Human resources and recruitment (Ukraine)",
  },
  legal: {
    icon: Scale,
    description: "Legal affairs and contract management",
  },
  onboarding: {
    icon: UserCheck,
    description: "Client and employee onboarding processes",
  },
  product_xbo: {
    icon: Package,
    description: "Product management and roadmap",
  },
  success: {
    icon: Trophy,
    description: "Customer success and account management",
  },
  technical_support: {
    icon: Wrench,
    description: "Technical support and troubleshooting",
  },
  technical_writers: {
    icon: BookOpen,
    description: "Technical documentation and writing",
  },
  ui_ux: {
    icon: Monitor,
    description: "User interface and experience design",
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
        <h1 className="text-2xl font-bold text-slate-900">Project creation</h1>
        <p className="text-slate-500 mt-1">
          Select a department to submit a new project request.
        </p>
      </div>

      {isPending && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 23 }).map((_, i) => (
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
