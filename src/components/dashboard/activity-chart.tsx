"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { DailyActivity } from "@/types/project";
import { format } from "date-fns";

export function ActivityChart({ data }: { data: DailyActivity[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a84ff" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#0a84ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), "MMM d")} stroke="#48484a" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#48484a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} width={36} />
        <Tooltip
          contentStyle={{ backgroundColor: "#2c2c2e", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px", color: "#f5f5f7", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}
          labelStyle={{ color: "#98989d", fontSize: "11px" }}
          labelFormatter={(d) => format(new Date(d as string), "MMM d, yyyy")}
          cursor={{ stroke: "rgba(10,132,255,0.15)" }}
        />
        <Area type="monotone" dataKey="messageCount" stroke="#0a84ff" fill="url(#msgGradient)" strokeWidth={1.5} name="Messages" dot={false} activeDot={{ r: 3.5, fill: "#0a84ff", stroke: "#1c1c1e", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
