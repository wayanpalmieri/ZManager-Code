import { NextResponse } from "next/server";
import { aggregateTodos } from "@/lib/todo-aggregator";
import { getPlans } from "@/lib/plan-matcher";

export async function GET() {
  const { todos, byProject } = aggregateTodos();
  const plans = getPlans();

  const stats = {
    total: todos.length,
    pending: todos.filter((t) => t.status === "pending").length,
    inProgress: todos.filter((t) => t.status === "in_progress").length,
    completed: todos.filter((t) => t.status === "completed").length,
  };

  return NextResponse.json({ todos, byProject, plans, stats });
}
