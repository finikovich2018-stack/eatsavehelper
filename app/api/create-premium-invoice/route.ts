import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    const res = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "EatSave Premium",
        description: "Месячная подписка Premium",
        payload: `premium_${userId}`,
        provider_token: "",
        currency: "XTR",
        prices: [
          { label: "Premium (1 месяц)", amount: 149 }
        ]
      })
    });

    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json({ error: data.description }, { status: 400 });
    }

    return NextResponse.json({ invoiceLink: data.result });
  } catch (error) {
    return NextResponse.json({ error: "Ошибка создания счёта" }, { status: 500 });
  }
}