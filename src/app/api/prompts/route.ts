import { NextResponse } from "next/server";
import { listPrompts, upsertPrompt, deletePrompt } from "@/lib/prompts-store";

export const dynamic = "force-dynamic";

const MAX_NAME = 120;
const MAX_TEXT = 4000;

export async function GET() {
  return NextResponse.json(listPrompts());
}

export async function POST(request: Request) {
  const body = await request.json();

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (body.name.length > MAX_NAME) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }
  if (body.text.length > MAX_TEXT) {
    return NextResponse.json({ error: "Text too long" }, { status: 400 });
  }
  if (body.id !== undefined && typeof body.id !== "string") {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const saved = upsertPrompt({
    id: body.id,
    name: body.name.trim(),
    text: body.text.trim(),
  });
  return NextResponse.json(saved);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const removed = deletePrompt(id);
  if (!removed) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
