"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, Microscope, Briefcase, Landmark, BarChart2, TrendingUp, ShieldCheck, FileText, Palette, Pen, Headphones, ArrowLeftRight, Server, DollarSign, UserPlus, Users, Scale, UserCheck, Package, Trophy, Wrench, BookOpen, Monitor } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;
interface Department { id: string; slug: string; name: string; }

const DEPT_META: Record<string, { icon: React.ElementType; description: string }> = {
  rnd:               { icon: Microscope,     description: "Research and development initiatives" },
  back_office:       { icon: Briefcase,      description: "Back office operations" },
  banking:           { icon: Landmark,       description: "Banking operations and financial services" },
  bi:                { icon: BarChart2,      description: "Business intelligence and analytics" },
  bizdev_sales:      { icon: TrendingUp,     description: "Business development and sales strategy" },
  cashier:           { icon: CreditCard,     description: "Point-of-sale and cashier systems" },
  compliance:        { icon: ShieldCheck,    description: "Regulatory compliance and risk" },
  content:           { icon: FileText,       description: "Content creation and editorial" },
  creative_studio:   { icon: Palette,        description: "Creative production and media" },
  design:            { icon: Pen,            description: "Visual design and brand identity" },
  customer_support:  { icon: Headphones,     description: "Customer support and client relations" },
  dealing:           { icon: ArrowLeftRight, description: "Trading and dealing operations" },
  devops_it:         { icon: Server,         description: "DevOps, infrastructure and IT" },
  finance:           { icon: DollarSign,     description: "Financial planning and accounting" },
  hr_recruitment_cy: { icon: UserPlus,       description: "HR and recruitment (Cyprus)" },
  hr_recruitment_ukr:{ icon: Users,          description: "HR and recruitment (Ukraine)" },
  legal:             { icon: Scale,          description: "Legal affairs and contracts" },
  onboarding:        { icon: UserCheck,      description: "Client and employee onboarding" },
  product_xbo:       { icon: Package,        description: "Product management and roadmap" },
  success:           { icon: Trophy,         description: "Customer success management" },
  technical_support: { icon: Wrench,         description: "Technical support and troubleshooting" },
  technical_writers: { icon: BookOpen,       description: "Technical documentation" },
  ui_ux:             { icon: Monitor,        description: "UI/UX design" },
};

async function fetchDepartments(): Promise<Department[]> {
  const res = await fetch(`${API}/api/departments`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json();
}

export default function PortalPage() {
  const router = useRouter();
  const { data: departments, isPending, isError } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments, staleTime: 300_000 });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6 animate-enter">
        <h1 className="text-2xl font-bold" style={{ color: "#37352F" }}>Project creation</h1>
        <p className="text-sm mt-1" style={{ color: "#9B9A97" }}>Select a department to submit a new project request.</p>
      </div>

      {isPending && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 23 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border bg-white animate-pulse" style={{ borderColor: "#E9E9E6" }} />
          ))}
        </div>
      )}

      {isError && <p className="text-sm text-red-500">Failed to load departments.</p>}

      {departments && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 animate-enter-1">
          {departments.map((dept) => {
            const meta = DEPT_META[dept.slug] ?? { icon: Building2, description: "" };
            const Icon = meta.icon;
            return (
              <button
                key={dept.id}
                onClick={() => router.push(`/portal/${dept.slug}`)}
                className="group text-left rounded-xl border bg-white p-4 transition-all duration-150 hover:shadow-md focus:outline-none"
                style={{ borderColor: "#E9E9E6" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#2383E2"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E9E9E6"; }}
              >
                <div className="h-9 w-9 rounded-lg flex items-center justify-center mb-3" style={{ background: "#EEF4FD" }}>
                  <Icon className="h-4 w-4" style={{ color: "#2383E2" }} />
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: "#37352F" }}>{dept.name}</p>
                <p className="text-xs leading-relaxed" style={{ color: "#9B9A97" }}>{meta.description}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
